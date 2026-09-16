import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getWatchlist } from "@/lib/watchlist";
import type { AssetType, WatchlistItem } from "@serruchito/core";

const ASSET_TYPES: AssetType[] = ["cedear", "accion_arg", "stock_us", "etf", "bono", "otro"];

export async function GET(req: NextRequest) {
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
  const { rows, pricesFetchedAt, pricesStale } = await getWatchlist(forceRefresh);
  return NextResponse.json({ rows, pricesFetchedAt, pricesStale });
}

// Agrega un ticker a la watchlist. Si viene con `name`/`market`/etc. (lo que
// ya trae el buscador de /api/instruments/search), se upsertea también en
// `instruments` para que quede el catálogo completo, no solo la lista.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ticker, asset_type, name, market, underlying_ticker, cedear_ratio, note } = body;

  if (!ticker || !asset_type) {
    return NextResponse.json({ error: "ticker y asset_type son obligatorios." }, { status: 400 });
  }
  if (!ASSET_TYPES.includes(asset_type)) {
    return NextResponse.json({ error: "asset_type inválido." }, { status: 400 });
  }

  const db = await getDb();
  const upperTicker = String(ticker).toUpperCase();

  const existing = await db.query(`SELECT id FROM watchlist WHERE ticker = $1 AND asset_type = $2`, [upperTicker, asset_type]);
  if (existing.rowCount && existing.rowCount > 0) {
    return NextResponse.json({ error: "Ese ticker ya está en la watchlist." }, { status: 409 });
  }

  if (name || market || underlying_ticker || cedear_ratio) {
    await db.query(
      `INSERT INTO instruments (ticker, name, asset_type, cedear_ratio, underlying_ticker, market)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (ticker) DO UPDATE SET
         name = COALESCE(instruments.name, excluded.name),
         cedear_ratio = COALESCE(instruments.cedear_ratio, excluded.cedear_ratio),
         underlying_ticker = COALESCE(instruments.underlying_ticker, excluded.underlying_ticker),
         market = COALESCE(instruments.market, excluded.market)`,
      [upperTicker, name ?? null, asset_type, cedear_ratio ?? null, underlying_ticker ?? null, market ?? null]
    );
  }

  const result = await db.query<WatchlistItem>(
    `INSERT INTO watchlist (ticker, asset_type, sort_order, note)
     VALUES ($1, $2, COALESCE((SELECT MAX(sort_order) + 1 FROM watchlist), 0), $3)
     RETURNING id, ticker, asset_type, sort_order, note`,
    [upperTicker, asset_type, note ?? null]
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}
