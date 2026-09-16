import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCcl, getQuotes, type PricedInstrument } from "@/lib/quotes";
import type { AssetType, Transaction } from "@serruchito/core";

// Fuerza un refresh de precios y CCL contra las fuentes públicas, ignorando
// el cache. Pensado para el indicador "actualizado hace Xm" del dashboard y
// para la watchlist de Mercado, que comparte este mismo botón/auto-refresh.
export async function POST() {
  const db = await getDb();
  const [transactionsResult, watchlistResult] = await Promise.all([
    db.query<Transaction>(`SELECT * FROM transactions`),
    db.query<{ ticker: string; asset_type: AssetType }>(`SELECT ticker, asset_type FROM watchlist`),
  ]);

  const positionsKey = new Set<string>();
  const positions: PricedInstrument[] = [];
  for (const t of [...transactionsResult.rows, ...watchlistResult.rows]) {
    const k = `${t.ticker}::${t.asset_type}`;
    if (!positionsKey.has(k)) {
      positionsKey.add(k);
      positions.push({ ticker: t.ticker, asset_type: t.asset_type });
    }
  }

  const ccl = await getCcl(true);
  const quotes = await getQuotes(positions, true);
  // Si una fuente no respondió, getQuotes devuelve el último precio cacheado
  // marcado `stale` en vez de romper -> esto le permite al frontend avisar
  // que el refresh no fue completo, en vez de mostrarlo como éxito silencioso.
  const staleCount = [...quotes.values()].filter((q) => q.stale).length;

  return NextResponse.json({
    updated: quotes.size,
    staleCount,
    ok: staleCount === 0 && !ccl.stale,
    ccl: ccl.value,
    cclStale: ccl.stale,
  });
}
