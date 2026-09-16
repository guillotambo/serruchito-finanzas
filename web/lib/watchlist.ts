import { getDb } from "@/lib/db";
import { getQuotes, type PricedInstrument } from "@/lib/quotes";
import { getSparklines, refreshHistories } from "@/lib/history";
import { nativeCurrency } from "@serruchito/core";
import type { AssetType, Currency, WatchlistItem } from "@serruchito/core";

/**
 * Arma la lista de "Mercado": combina la tabla `watchlist` con precios en
 * vivo (mismo servicio que usa la Cartera) y el sparkline de cada
 * instrumento. No distingue si el ticker está en cartera o no para pedir el
 * precio -> getQuotes() ya es agnóstico de eso.
 */

const SPARKLINE_POINTS = 30;
const MAX_HISTORY_REFRESH_PER_LOAD = 6; // ver MAX_REFRESH_PER_REQUEST en lib/history.ts

export type WatchlistRow = WatchlistItem & {
  name: string | null;
  price: number | null;
  currency: Currency | null;
  previousClose: number | null;
  dayChangePct: number | null;
  priceStale: boolean;
  fetchedAt: string | null;
  sparkline: number[];
  inPortfolio: boolean;
};

export async function getWatchlist(forceRefresh = false): Promise<{
  rows: WatchlistRow[];
  pricesFetchedAt: string | null;
  pricesStale: boolean;
}> {
  const db = await getDb();

  const [itemsResult, portfolioTickersResult] = await Promise.all([
    db.query<WatchlistItem & { name: string | null }>(
      `SELECT w.id, w.ticker, w.asset_type, w.sort_order, w.note, i.name
       FROM watchlist w
       LEFT JOIN instruments i ON i.ticker = w.ticker AND i.asset_type = w.asset_type
       ORDER BY w.sort_order ASC, w.id ASC`
    ),
    db.query<{ ticker: string; asset_type: AssetType }>(`SELECT DISTINCT ticker, asset_type FROM transactions`),
  ]);

  const items = itemsResult.rows;
  if (items.length === 0) {
    return { rows: [], pricesFetchedAt: null, pricesStale: false };
  }

  const portfolioKeys = new Set(portfolioTickersResult.rows.map((r) => `${r.ticker}::${r.asset_type}`));

  const priced: PricedInstrument[] = items.map((i) => ({ ticker: i.ticker, asset_type: i.asset_type }));
  const quotes = await getQuotes(priced, forceRefresh);

  const sparklineInstruments = items.map((i) => ({ ticker: i.ticker, asset_type: i.asset_type, currency: nativeCurrency(i.asset_type) }));
  // El refresh de históricos es best-effort y acotado: si falla o tarda, el
  // sparkline simplemente sale vacío para esa fila, no rompe la respuesta.
  await refreshHistories(sparklineInstruments, MAX_HISTORY_REFRESH_PER_LOAD).catch(() => null);
  const sparklines = await getSparklines(sparklineInstruments, SPARKLINE_POINTS);

  const rows: WatchlistRow[] = items.map((item) => {
    const quote = quotes.get(`${item.ticker}::${item.asset_type}`);
    const price = quote?.price ?? null;
    const previousClose = quote?.previousClose ?? null;
    const dayChangePct = price != null && previousClose != null && previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : null;
    const sparkKey = `${item.ticker}::${item.asset_type}::${nativeCurrency(item.asset_type)}`;

    return {
      id: item.id,
      ticker: item.ticker,
      asset_type: item.asset_type,
      sort_order: item.sort_order,
      note: item.note,
      name: item.name,
      price,
      currency: quote?.currency ?? null,
      previousClose,
      dayChangePct,
      priceStale: quote?.stale ?? true,
      fetchedAt: quote?.fetched_at ?? null,
      sparkline: sparklines.get(sparkKey) ?? [],
      inPortfolio: portfolioKeys.has(`${item.ticker}::${item.asset_type}`),
    };
  });

  const fetchedTimestamps = rows.map((r) => r.fetchedAt).filter((t): t is string => !!t);
  const pricesFetchedAt = fetchedTimestamps.length > 0 ? fetchedTimestamps.sort().at(-1)! : null;
  const pricesStale = rows.some((r) => r.priceStale);

  return { rows, pricesFetchedAt, pricesStale };
}
