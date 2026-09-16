import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fetchWithTimeout, getLiveSymbols } from "@/lib/quotes";
import { stripSettlementSuffixes } from "@serruchito/core";
import type { AssetType, Instrument, InstrumentSearchResult } from "@serruchito/core";

/**
 * Buscador de tickers para agregar a la watchlist. Cascada de 3 capas,
 * dedupeadas por `${ticker}::${asset_type}` en orden de prioridad:
 *
 * 1. `instruments` (catálogo canónico, ~40 filas seeded): da nombre,
 *    asset_type, market, underlying_ticker sin tocar la red.
 * 2. Paneles live de data912 (CEDEARs y acciones argentinas): más cobertura,
 *    pero sin nombre.
 * 3. Yahoo Finance, solo si 1 y 2 no dieron nada: cualquier ticker de EE.UU.
 */

const TICKER_LIKE = /^[A-Z.\-]{1,6}$/;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toUpperCase();
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20)));

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const db = await getDb();
  const [instrumentsResult, watchlistResult] = await Promise.all([
    db.query<Instrument>(
      `SELECT * FROM instruments
       WHERE ticker ILIKE $1 || '%' OR name ILIKE '%' || $1 || '%'
       ORDER BY (ticker ILIKE $1 || '%') DESC, ticker ASC
       LIMIT $2`,
      [q, limit]
    ),
    db.query<{ ticker: string; asset_type: AssetType }>(`SELECT ticker, asset_type FROM watchlist`),
  ]);
  const inWatchlistKeys = new Set(watchlistResult.rows.map((r) => `${r.ticker}::${r.asset_type}`));
  const seenKeys = new Set<string>();
  const results: InstrumentSearchResult[] = [];

  const push = (result: InstrumentSearchResult) => {
    const key = `${result.ticker}::${result.asset_type}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    results.push({ ...result, inWatchlist: inWatchlistKeys.has(key) });
  };

  for (const instrument of instrumentsResult.rows) {
    push({
      ticker: instrument.ticker,
      name: instrument.name,
      asset_type: instrument.asset_type,
      market: instrument.market,
      origin: "instruments",
      price: null,
      currency: null,
      underlying_ticker: instrument.underlying_ticker,
      inWatchlist: false,
    });
  }

  if (results.length < limit) {
    try {
      const liveSymbols = await getLiveSymbols();
      const bySymbol = new Map(liveSymbols.map((s) => [s.symbol, s]));
      const matchingSymbols = stripSettlementSuffixes(
        liveSymbols.filter((s) => s.symbol.startsWith(q)).map((s) => s.symbol)
      );
      for (const symbol of matchingSymbols) {
        if (results.length >= limit) break;
        const live = bySymbol.get(symbol);
        if (!live) continue;
        push({
          ticker: symbol,
          name: null,
          asset_type: live.panel === "arg_cedears" ? "cedear" : "accion_arg",
          market: null,
          origin: live.panel === "arg_cedears" ? "data912_cedear" : "data912_stock",
          price: live.price,
          currency: "ARS",
          underlying_ticker: null,
          inWatchlist: false,
        });
      }
    } catch {
      // data912 caído: seguir solo con lo que ya haya de instruments.
    }
  }

  if (results.length === 0 && TICKER_LIKE.test(q)) {
    try {
      const res = await fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        if (typeof meta?.regularMarketPrice === "number") {
          push({
            ticker: q,
            name: meta.shortName ?? meta.longName ?? null,
            asset_type: "stock_us",
            market: meta.fullExchangeName ?? meta.exchangeName ?? null,
            origin: "yahoo",
            price: meta.regularMarketPrice,
            currency: "USD",
            underlying_ticker: null,
            inWatchlist: false,
          });
        }
      }
    } catch {
      // Yahoo caído o timeout: sin resultado, no rompe la búsqueda.
    }
  }

  return NextResponse.json(results.slice(0, limit));
}
