import { CASH_COLUMNS, getDb } from "@/lib/db";
import { getCcl, getQuotes, type PricedInstrument } from "@/lib/quotes";
import { buildPortfolioSummary, convert } from "@serruchito/core";
import type { CashHolding, Dividend, PortfolioSummary, Transaction } from "@serruchito/core";

/**
 * Arma el PortfolioSummary leyendo transacciones/dividendos de la DB y
 * trayendo precios + CCL (cache o fuentes públicas). Compartido por el
 * endpoint del dashboard (app/api/portfolio) y el de snapshots diarios
 * (app/api/snapshots), que necesitan exactamente el mismo cálculo.
 */
export type PortfolioFreshness = {
  cclSource: string | null;
  cclStale: boolean;
  // Timestamp más reciente entre todas las cotizaciones (posiciones + CCL),
  // para el indicador "actualizado hace Xm" del dashboard.
  pricesFetchedAt: string | null;
  // true si al menos una cotización quedó con el último precio cacheado en
  // vez del real (ver lib/quotes.ts) -> el refresh no fue completo.
  pricesStale: boolean;
};

export type CashSummary = {
  cashHoldings: CashHolding[];
  totalCashArs: number;
  totalCashUsd: number;
};

export async function getPortfolioSummary(
  forceRefresh = false
): Promise<PortfolioSummary & PortfolioFreshness & CashSummary> {
  const db = await getDb();
  const [transactionsResult, dividendsResult, cashResult] = await Promise.all([
    db.query<Transaction>(`SELECT * FROM transactions`),
    db.query<Dividend>(`SELECT * FROM dividends`),
    db.query<CashHolding>(`SELECT ${CASH_COLUMNS} FROM cash_holdings ORDER BY id DESC`),
  ]);
  const transactions = transactionsResult.rows;
  const dividends = dividendsResult.rows;
  const cashHoldings = cashResult.rows;

  // Un mismo ticker puede ser un instrumento distinto según el broker (ej.
  // MSFT CEDEAR en Cocos vs. MSFT acción directa en IBKR) -> se piden
  // cotizaciones por (ticker, asset_type), nunca por ticker solo.
  const positionsKey = new Set<string>();
  const positions: PricedInstrument[] = [];
  for (const t of transactions) {
    const k = `${t.ticker}::${t.asset_type}`;
    if (!positionsKey.has(k)) {
      positionsKey.add(k);
      positions.push({ ticker: t.ticker, asset_type: t.asset_type });
    }
  }

  const ccl = await getCcl(forceRefresh);
  const quotes = await getQuotes(positions, forceRefresh);

  const summary = buildPortfolioSummary({
    transactions,
    dividends,
    quotes,
    ccl: ccl.value,
    ccpFetchedAt: ccl.fetchedAt,
  });

  const fetchedTimestamps = [...quotes.values()].map((q) => q.fetched_at).filter((t): t is string => !!t);
  if (ccl.fetchedAt) fetchedTimestamps.push(ccl.fetchedAt);
  const pricesFetchedAt = fetchedTimestamps.length > 0 ? fetchedTimestamps.sort().at(-1)! : null;
  const pricesStale = ccl.stale || [...quotes.values()].some((q) => q.stale);

  let totalCashArs = 0;
  let totalCashUsd = 0;
  for (const cash of cashHoldings) {
    const conv = convert(cash.amount, cash.currency, ccl.value);
    if (conv.ars != null) totalCashArs += conv.ars;
    if (conv.usd != null) totalCashUsd += conv.usd;
  }

  return {
    ...summary,
    cclSource: ccl.source,
    cclStale: ccl.stale,
    pricesFetchedAt,
    pricesStale,
    cashHoldings,
    totalCashArs,
    totalCashUsd,
  };
}
