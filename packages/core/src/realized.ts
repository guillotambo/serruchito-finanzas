import { convert } from "./portfolio";
import type { Dividend, RealizedByTicker, RealizedPeriod, RealizedPoint, RealizedSummary, RealizedTrade } from "./types";

/**
 * Ganancia tomada: cortes sobre `realizedTrades` (ya calculado por
 * buildPortfolioSummary, ver portfolio.ts) para responder "cuánto llevo
 * tomado" con distintas lecturas -> por período, por ticker, y su evolución
 * acumulada en el tiempo. Función pura: no toca la DB ni el reloj, `today`
 * entra como parámetro (ISO) para poder testear el filtro de período.
 *
 * Igual que el resto del motor, las conversiones ARS/USD usan el CCL actual
 * pasado por parámetro, no el histórico de cada fecha (ver metrics.ts).
 */

function matchesPeriod(date: string, period: RealizedPeriod, today: string): boolean {
  if (period === "all") return true;
  if (period === "year") return date.startsWith(today.slice(0, 4));
  return date.startsWith(today.slice(0, 7)); // "month"
}

export function buildRealizedSummary(params: {
  trades: RealizedTrade[];
  dividends: Dividend[];
  ccl: number | null;
  period: RealizedPeriod;
  today: string;
}): RealizedSummary {
  const { trades: allTrades, dividends: allDividends, ccl, period, today } = params;

  const trades = allTrades.filter((t) => matchesPeriod(t.date, period, today));
  const dividends = allDividends.filter((d) => matchesPeriod(d.date, period, today));

  let realizedPnlArs = 0;
  let realizedPnlUsd = 0;
  let winners = 0;
  let losers = 0;
  const byTickerMap = new Map<string, { tradeCount: number; quantity: number; costArs: number | null; pnlArs: number | null; pnlUsd: number | null }>();

  for (const t of trades) {
    if (t.pnlArs != null) realizedPnlArs += t.pnlArs;
    if (t.pnlUsd != null) realizedPnlUsd += t.pnlUsd;
    if (t.pnlNative > 0) winners++;
    else if (t.pnlNative < 0) losers++;

    let entry = byTickerMap.get(t.ticker);
    if (!entry) {
      entry = { tradeCount: 0, quantity: 0, costArs: 0, pnlArs: 0, pnlUsd: 0 };
      byTickerMap.set(t.ticker, entry);
    }
    entry.tradeCount += 1;
    entry.quantity += t.quantity;
    const costConv = convert(t.buyPrice * t.quantity, t.currency, ccl);
    entry.costArs = entry.costArs != null && costConv.ars != null ? entry.costArs + costConv.ars : null;
    entry.pnlArs = entry.pnlArs != null && t.pnlArs != null ? entry.pnlArs + t.pnlArs : null;
    entry.pnlUsd = entry.pnlUsd != null && t.pnlUsd != null ? entry.pnlUsd + t.pnlUsd : null;
  }

  const byTicker: RealizedByTicker[] = Array.from(byTickerMap.entries())
    .map(([ticker, v]) => ({
      ticker,
      tradeCount: v.tradeCount,
      quantity: v.quantity,
      costArs: v.costArs,
      pnlArs: v.pnlArs,
      pnlUsd: v.pnlUsd,
      pnlPct: v.pnlArs != null && v.costArs != null && v.costArs > 0 ? (v.pnlArs / v.costArs) * 100 : null,
    }))
    .sort((a, b) => (b.pnlArs ?? 0) - (a.pnlArs ?? 0));

  let dividendsArs = 0;
  let dividendsUsd = 0;
  for (const d of dividends) {
    const conv = convert(d.amount, d.currency, ccl);
    if (conv.ars != null) dividendsArs += conv.ars;
    if (conv.usd != null) dividendsUsd += conv.usd;
  }

  // Curva acumulada: mergea ventas y dividendos como eventos, orden
  // ascendente por fecha (a diferencia de `trades`, que es un ledger
  // "más reciente primero"). Contribución nula (sin CCL para convertir un
  // monto en USD) se trata como 0 para no romper el acumulado.
  type Event = { date: string; realized: number; dividend: number };
  const events: Event[] = [
    ...trades.map((t) => ({ date: t.date, realized: t.pnlArs ?? 0, dividend: 0 })),
    ...dividends.map((d) => ({ date: d.date, realized: 0, dividend: convert(d.amount, d.currency, ccl).ars ?? 0 })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const cumulative: RealizedPoint[] = [];
  let runningRealized = 0;
  let runningDividends = 0;
  for (const e of events) {
    runningRealized += e.realized;
    runningDividends += e.dividend;
    cumulative.push({
      date: e.date,
      realizedArs: runningRealized,
      dividendsArs: runningDividends,
      totalArs: runningRealized + runningDividends,
    });
  }

  return {
    period,
    trades: [...trades].sort((a, b) => b.date.localeCompare(a.date)),
    realizedPnlArs,
    realizedPnlUsd,
    dividendsArs,
    dividendsUsd,
    totalCashedArs: realizedPnlArs + dividendsArs,
    totalCashedUsd: realizedPnlUsd + dividendsUsd,
    winners,
    losers,
    byTicker,
    cumulative,
  };
}
