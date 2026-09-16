import { getDb } from "@/lib/db";
import { getPortfolioSummary } from "@/lib/getPortfolioSummary";
import { fetchBenchmarkPrice } from "@/lib/quotes";

const BENCHMARK_TICKER = "SPY"; // proxy del S&P 500

export type SnapshotCapture = { date: string; totalValueArs: number; totalValueUsd: number };

// Fotografía el patrimonio actual y lo guarda como el snapshot del día
// (upsert: correr esto dos veces el mismo día pisa el valor, no duplica).
// Compartido por el POST del cron diario y por el disparo manual desde la
// pantalla de Rendimiento ("Guardar foto ahora"); forzamos refresh de precios
// para que el snapshot refleje el cierre del día, no un precio cacheado de
// horas antes.
export async function captureSnapshot(): Promise<SnapshotCapture> {
  const [summary, spyUsd] = await Promise.all([getPortfolioSummary(true), fetchBenchmarkPrice(BENCHMARK_TICKER)]);

  const byBroker: Record<string, number> = {};
  for (const p of summary.positions) {
    byBroker[p.broker] = (byBroker[p.broker] ?? 0) + (p.valueArs ?? 0);
  }

  const date = new Date().toISOString().slice(0, 10);
  const db = await getDb();
  await db.query(
    `INSERT INTO portfolio_snapshots (date, total_value_ars, total_value_usd, total_cost_ars, ccl, spy_usd, by_broker)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (date) DO UPDATE SET
       total_value_ars = excluded.total_value_ars,
       total_value_usd = excluded.total_value_usd,
       total_cost_ars = excluded.total_cost_ars,
       ccl = excluded.ccl,
       spy_usd = excluded.spy_usd,
       by_broker = excluded.by_broker`,
    [date, summary.totalValueArs, summary.totalValueUsd, summary.totalCostArs, summary.ccl, spyUsd, JSON.stringify(byBroker)]
  );

  return { date, totalValueArs: summary.totalValueArs, totalValueUsd: summary.totalValueUsd };
}
