import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { refreshHistories } from "@/lib/history";
import { nativeCurrency } from "@serruchito/core";
import type { AssetType, Currency } from "@serruchito/core";

// Cron diario: refresca TODAS las series de la watchlist + posiciones
// abiertas (transactions), en ambas monedas cuando el instrumento tiene
// underlying_ticker cargado. Misma auth que /api/snapshots.
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const body = await req.json().catch(() => null);
  const isManual = body?.manual === true;

  if (cronSecret && !isManual) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const db = await getDb();
  const [watchlistResult, transactionsResult] = await Promise.all([
    db.query<{ ticker: string; asset_type: AssetType }>(`SELECT ticker, asset_type FROM watchlist`),
    db.query<{ ticker: string; asset_type: AssetType }>(`SELECT DISTINCT ticker, asset_type FROM transactions`),
  ]);

  const uniqueByKey = new Map<string, { ticker: string; asset_type: AssetType }>();
  for (const row of [...watchlistResult.rows, ...transactionsResult.rows]) {
    uniqueByKey.set(`${row.ticker}::${row.asset_type}`, row);
  }
  const items = Array.from(uniqueByKey.values());

  const instrumentsResult = await db.query<{ ticker: string; asset_type: AssetType; underlying_ticker: string | null }>(
    `SELECT ticker, asset_type, underlying_ticker FROM instruments`
  );
  const underlyingByKey = new Map(instrumentsResult.rows.map((r) => [`${r.ticker}::${r.asset_type}`, r.underlying_ticker]));

  const instruments: Array<{ ticker: string; asset_type: AssetType; currency: Currency }> = [];
  for (const item of items) {
    const native = nativeCurrency(item.asset_type);
    instruments.push({ ...item, currency: native });
    // Segunda serie en USD para el toggle del detalle, solo si el
    // instrumento tiene subyacente cargado (si no, no hay fuente y
    // refreshOne lo marcaría stale sin conseguir nada).
    if (native === "ARS" && underlyingByKey.get(`${item.ticker}::${item.asset_type}`)) {
      instruments.push({ ...item, currency: "USD" });
    }
  }

  const result = await refreshHistories(instruments);
  return NextResponse.json({ total: instruments.length, ...result });
}
