import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Instrument } from "@serruchito/core";

export async function GET() {
  const db = await getDb();
  const result = await db.query<Instrument>(`SELECT * FROM instruments ORDER BY ticker ASC`);
  return NextResponse.json(result.rows);
}

// Alta/edición de un instrumento (upsert). Se usa para agregar tickers que
// no están en el seed o para corregir un ratio de CEDEAR desactualizado.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ticker, name, asset_type, cedear_ratio, underlying_ticker, market } = body;

  if (!ticker || !asset_type) {
    return NextResponse.json({ error: "ticker y asset_type son obligatorios." }, { status: 400 });
  }

  const db = await getDb();
  const upperTicker = String(ticker).toUpperCase();
  const result = await db.query<Instrument>(
    `INSERT INTO instruments (ticker, name, asset_type, cedear_ratio, underlying_ticker, market)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (ticker) DO UPDATE SET
       name = excluded.name,
       asset_type = excluded.asset_type,
       cedear_ratio = excluded.cedear_ratio,
       underlying_ticker = excluded.underlying_ticker,
       market = excluded.market
     RETURNING *`,
    [upperTicker, name ?? null, asset_type, cedear_ratio ?? null, underlying_ticker ?? null, market ?? null]
  );
  return NextResponse.json(result.rows[0], { status: 200 });
}
