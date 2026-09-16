import { BROKER_LABELS } from "./format";
import { convert } from "./portfolio";
import type { Broker, CashHolding, Dividend, Position, RealizedTrade, Transaction } from "./types";

/**
 * Filtro de cartera (broker + incluir efectivo), compartido entre Inicio y
 * Cartera en web y mobile: antes cada pantalla lo reimplementaba por su
 * cuenta (y Cartera no lo tenía). Espejo de activity.ts para el feed de
 * Movimientos: mismo patrón de filtros + chips descriptivos.
 */
export type PortfolioFilters = {
  broker: "all" | Broker;
  includeCash: boolean;
};

// Efectivo excluido por default en las dos plataformas: es lo que ya se veía
// en mobile; unificar hacia "incluido" (el default previo de la web) hubiera
// cambiado el número grande que el usuario ve al abrir la app.
export const DEFAULT_PORTFOLIO_FILTERS: PortfolioFilters = {
  broker: "all",
  includeCash: false,
};

export const BROKERS: Broker[] = ["cocos", "balanz", "ibkr", "iol"];

export function parseBrokerFilter(value: string | null | undefined): "all" | Broker {
  return BROKERS.includes(value as Broker) ? (value as Broker) : "all";
}

export function filterPositionsByBroker(positions: Position[], broker: "all" | Broker): Position[] {
  return broker === "all" ? positions : positions.filter((p) => p.broker === broker);
}

// Un saldo sin broker asignado (ej. plata en el banco) cuenta para el
// patrimonio pase lo que pase el filtro; el que sí tiene broker respeta el
// filtro igual que las posiciones. (A diferencia de filterActivity, donde un
// saldo sin broker queda afuera al filtrar: ahí se están listando
// movimientos de una cuenta, acá se está repartiendo patrimonio.)
export function filterCashByBroker(cashHoldings: CashHolding[], broker: "all" | Broker): CashHolding[] {
  return broker === "all" ? cashHoldings : cashHoldings.filter((c) => c.broker == null || c.broker === broker);
}

export function filterRealizedByBroker(trades: RealizedTrade[], broker: "all" | Broker): RealizedTrade[] {
  return broker === "all" ? trades : trades.filter((t) => t.broker === broker);
}

export function filterDividendsByBroker(dividends: Dividend[], broker: "all" | Broker): Dividend[] {
  return broker === "all" ? dividends : dividends.filter((d) => d.broker === broker);
}

export function filterTransactionsByBroker(transactions: Transaction[], broker: "all" | Broker): Transaction[] {
  return broker === "all" ? transactions : transactions.filter((t) => t.broker === broker);
}

export type FilteredPortfolioTotals = {
  totalValueArs: number;
  totalValueUsd: number;
  totalCashArs: number;
  totalCashUsd: number | null;
  totalCostArs: number;
  totalUnrealizedPnlArs: number;
  totalUnrealizedPnlUsd: number | null;
  totalPnlPct: number | null;
  totalDayChangeArs: number;
  totalDayChangeUsd: number | null;
  totalDayChangePct: number | null;
};

/**
 * Recalcula los totales de cartera a partir de un set de posiciones/efectivo
 * ya filtrado por broker, sin volver a pegarle a la API. Mismo cuerpo que
 * antes estaba duplicado entre web/app/page.tsx y mobile/(tabs)/index.tsx;
 * ahora también lo usa Cartera. `cashHoldings` debe venir vacío si
 * `includeCash` es false: esta función no conoce ese switch, solo suma lo
 * que se le pasa.
 */
export function summarizeFilteredPortfolio(params: {
  positions: Position[];
  cashHoldings: CashHolding[];
  ccl: number | null;
}): FilteredPortfolioTotals {
  const { positions, cashHoldings, ccl } = params;

  let totalValueArs = 0;
  let totalValueUsd = 0;
  let totalCostArs = 0;
  let totalUnrealizedPnlArs = 0;
  let totalDayChangeArs = 0;
  let totalPreviousValueArs = 0;

  for (const p of positions) {
    if (p.valueArs != null) totalValueArs += p.valueArs;
    if (p.valueUsd != null) totalValueUsd += p.valueUsd;

    const costArs = convert(p.costBasisNative, p.costCurrency, ccl).ars;
    if (costArs != null) totalCostArs += costArs;

    if (p.unrealizedPnlNative != null) {
      const pnlArs = convert(p.unrealizedPnlNative, p.costCurrency, ccl).ars;
      if (pnlArs != null) totalUnrealizedPnlArs += pnlArs;
    }

    if (p.dayChangeArs != null && p.valueArs != null) {
      totalDayChangeArs += p.dayChangeArs;
      totalPreviousValueArs += p.valueArs - p.dayChangeArs;
    }
  }

  let totalCashArs = 0;
  for (const c of cashHoldings) {
    const ars = convert(c.amount, c.currency, ccl).ars;
    if (ars != null) totalCashArs += ars;
  }
  const totalCashUsd = ccl ? totalCashArs / ccl : null;
  totalValueArs += totalCashArs;
  totalValueUsd += totalCashUsd ?? 0;

  const totalPnlPct = totalCostArs > 0 ? (totalUnrealizedPnlArs / totalCostArs) * 100 : null;
  const totalDayChangePct = totalPreviousValueArs > 0 ? (totalDayChangeArs / totalPreviousValueArs) * 100 : null;

  // Equivalentes en USD derivados del mismo CCL usado para convertir
  // posiciones (no hay un total en USD de cada uno desde la API).
  const totalDayChangeUsd = ccl ? totalDayChangeArs / ccl : null;
  const totalUnrealizedPnlUsd = ccl ? totalUnrealizedPnlArs / ccl : null;

  return {
    totalValueArs,
    totalValueUsd,
    totalCashArs,
    totalCashUsd,
    totalCostArs,
    totalUnrealizedPnlArs,
    totalUnrealizedPnlUsd,
    totalPnlPct,
    totalDayChangeArs,
    totalDayChangeUsd,
    totalDayChangePct,
  };
}

// --- Chips -------------------------------------------------------------

export type PortfolioFilterChip = {
  // Qué parte del estado resetea este chip al cerrarse (vuelve al default de
  // esa clave).
  key: "broker" | "cash";
  label: string;
};

export function hasActivePortfolioFilters(filters: PortfolioFilters): boolean {
  return filters.broker !== DEFAULT_PORTFOLIO_FILTERS.broker || filters.includeCash !== DEFAULT_PORTFOLIO_FILTERS.includeCash;
}

export function describePortfolioFilters(filters: PortfolioFilters): PortfolioFilterChip[] {
  const chips: PortfolioFilterChip[] = [];
  if (filters.broker !== "all") {
    chips.push({ key: "broker", label: BROKER_LABELS[filters.broker] ?? filters.broker });
  }
  if (filters.includeCash !== DEFAULT_PORTFOLIO_FILTERS.includeCash) {
    chips.push({ key: "cash", label: "Con efectivo" });
  }
  return chips;
}

// Aclaración que acompaña a los agregados históricos (P&L realizado +
// dividendos) que en Inicio no se pueden filtrar por broker: el payload de
// /api/portfolio no trae ese desglose. Cartera sí puede filtrarlos (tiene
// realizedTrades/dividends con broker) y no necesita esta nota.
export function portfolioFilterNote(filters: PortfolioFilters): string | null {
  return filters.broker === "all" ? null : "histórico, todos los brokers";
}
