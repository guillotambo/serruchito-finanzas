import type { Broker, Currency, Dividend, PortfolioSummary, Position, Quote, RealizedTrade, Transaction } from "./types";

/**
 * Motor de cálculo del portafolio. Funciones puras: reciben transacciones +
 * precios + CCL y devuelven posiciones, P&L y valuación. No tocan la DB ni
 * la red, así son fáciles de testear con casos conocidos.
 *
 * Método de costeo: costo promedio ponderado (estándar para inversores
 * retail en Argentina). En cada venta se realiza P&L contra el PPC vigente
 * y el costo restante se reduce proporcionalmente, preservando el PPC.
 */

type PositionAccumulator = {
  ticker: string;
  broker: Broker;
  asset_type: string;
  quantity: number;
  totalCost: number; // costo total acumulado de lo que queda en cartera (moneda nativa)
  currency: Currency;
};

// Trade cerrado sin las conversiones ARS/USD todavía: calculatePositions no
// recibe el CCL (es una función pura sobre transacciones), esas conversiones
// se agregan después en buildPortfolioSummary.
export type RawRealizedTrade = Omit<RealizedTrade, "pnlPct" | "pnlArs" | "pnlUsd">;

/**
 * Estado de la posición alrededor de UNA transacción puntual: cómo estaba
 * antes y cómo quedó después. Es lo que permite explicar un movimiento
 * individual ("esta venta te dejó +$10 contra un PPC de $10") sin volver a
 * recorrer las transacciones por afuera, que es la única forma de garantizar
 * que el detalle diga exactamente los mismos números que la Cartera.
 */
export type TransactionContext = {
  txId: number;
  quantityBefore: number;
  quantityAfter: number;
  // null cuando no hay tenencia contra la cual promediar: antes de la primera
  // compra, o después de una venta que dejó la posición cerrada.
  avgCostBefore: number | null;
  avgCostAfter: number | null;
  // Solo en ventas: los mismos números que se pushean a realizedTrades.
  realized: {
    // Puede ser menor a tx.quantity si los datos cargados venden más de lo
    // que había en cartera (ver el clamp de abajo).
    soldQuantity: number;
    avgCost: number; // PPC contra el que se realizó el resultado
    costOfSold: number;
    proceeds: number; // soldQuantity * price - fees
    pnlNative: number;
    pnlPct: number | null; // null si el costo de lo vendido era 0
  } | null;
};

export function calculatePositions(transactions: Transaction[]): {
  positions: Map<string, PositionAccumulator>;
  realizedTrades: RawRealizedTrade[];
  contexts: Map<number, TransactionContext>;
} {
  const positions = new Map<string, PositionAccumulator>();
  const realizedTrades: RawRealizedTrade[] = [];
  const contexts = new Map<number, TransactionContext>();

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  for (const tx of sorted) {
    const key = `${tx.ticker}::${tx.broker}`;
    let acc = positions.get(key);
    if (!acc) {
      acc = {
        ticker: tx.ticker,
        broker: tx.broker,
        asset_type: tx.asset_type,
        quantity: 0,
        totalCost: 0,
        currency: tx.currency,
      };
      positions.set(key, acc);
    }

    // Snapshot previo: se toma acá y no dentro de cada rama porque el
    // acumulador se muta más abajo.
    const quantityBefore = acc.quantity;
    const avgCostBefore = acc.quantity > 0 ? acc.totalCost / acc.quantity : null;
    let realized: TransactionContext["realized"] = null;

    if (tx.side === "buy") {
      acc.quantity += tx.quantity;
      acc.totalCost += tx.quantity * tx.price + tx.fees;
    } else {
      // Venta: no permitir cantidad negativa por datos inconsistentes.
      const sellQty = Math.min(tx.quantity, acc.quantity);
      const avgCost = acc.quantity > 0 ? acc.totalCost / acc.quantity : 0;
      const proceeds = sellQty * tx.price - tx.fees;
      const costOfSold = avgCost * sellQty;
      const pnlNative = proceeds - costOfSold;

      realizedTrades.push({
        txId: tx.id,
        ticker: tx.ticker,
        broker: tx.broker,
        date: tx.date,
        quantity: sellQty,
        buyPrice: avgCost,
        sellPrice: tx.price,
        currency: tx.currency,
        pnlNative,
      });

      realized = {
        soldQuantity: sellQty,
        avgCost,
        costOfSold,
        proceeds,
        pnlNative,
        pnlPct: costOfSold > 0 ? (pnlNative / costOfSold) * 100 : null,
      };

      acc.quantity -= sellQty;
      acc.totalCost -= costOfSold;
      if (acc.quantity <= 1e-9) {
        acc.quantity = 0;
        acc.totalCost = 0;
      }
    }

    contexts.set(tx.id, {
      txId: tx.id,
      quantityBefore,
      quantityAfter: acc.quantity,
      avgCostBefore,
      avgCostAfter: acc.quantity > 0 ? acc.totalCost / acc.quantity : null,
      realized,
    });
  }

  return { positions, realizedTrades, contexts };
}

export function convert(amount: number, currency: Currency, ccl: number | null): { ars: number | null; usd: number | null } {
  if (currency === "ARS") {
    return { ars: amount, usd: ccl ? amount / ccl : null };
  }
  return { ars: ccl ? amount * ccl : null, usd: amount };
}

export function buildPortfolioSummary(params: {
  transactions: Transaction[];
  dividends: Dividend[];
  quotes: Map<string, Quote>; // clave: `${ticker}::${asset_type}` (ver lib/quotes.ts)
  ccl: number | null;
  ccpFetchedAt: string | null;
}): PortfolioSummary {
  const { transactions, dividends, quotes, ccl, ccpFetchedAt } = params;
  const { positions: accMap, realizedTrades } = calculatePositions(transactions);

  const positions: Position[] = [];
  let totalValueArs = 0;
  let totalValueUsd = 0;
  let totalCostArs = 0;
  let totalCostUsd = 0;
  let totalUnrealizedPnlArs = 0;
  let totalUnrealizedPnlUsd = 0;
  let totalDayChangeArs = 0;
  let totalPreviousValueArs = 0; // solo posiciones con previousClose conocido, para el % del día

  for (const acc of accMap.values()) {
    if (acc.quantity <= 0) continue;

    const avgCost = acc.totalCost / acc.quantity;
    const quote = quotes.get(`${acc.ticker}::${acc.asset_type}`);
    const marketPrice = quote ? quote.price : null;
    const priceStale = quote?.stale ?? true;
    const previousClose = quote?.previousClose ?? null;

    const valueNative = marketPrice != null ? acc.quantity * marketPrice : null;
    const costBasisNative = acc.totalCost;
    const unrealizedPnlNative = valueNative != null ? valueNative - costBasisNative : null;
    const unrealizedPnlPct = valueNative != null && costBasisNative > 0 ? (unrealizedPnlNative! / costBasisNative) * 100 : null;

    const costCurrency = acc.currency;
    const valueConv = valueNative != null ? convert(valueNative, costCurrency, ccl) : { ars: null, usd: null };
    const costConv = convert(costBasisNative, costCurrency, ccl);
    const pnlConv = unrealizedPnlNative != null ? convert(unrealizedPnlNative, costCurrency, ccl) : { ars: null, usd: null };

    const dayChangeNative = marketPrice != null && previousClose != null ? marketPrice - previousClose : null;
    const dayChangePct = dayChangeNative != null && previousClose! > 0 ? (dayChangeNative / previousClose!) * 100 : null;
    const dayChangeTotalNative = dayChangeNative != null ? acc.quantity * dayChangeNative : null;
    const dayChangeConv = dayChangeTotalNative != null ? convert(dayChangeTotalNative, costCurrency, ccl) : { ars: null, usd: null };

    positions.push({
      ticker: acc.ticker,
      broker: acc.broker,
      asset_type: acc.asset_type as Position["asset_type"],
      quantity: acc.quantity,
      avgCost,
      costCurrency,
      marketPrice,
      priceStale,
      valueNative,
      costBasisNative,
      unrealizedPnlNative,
      unrealizedPnlPct,
      valueArs: valueConv.ars,
      valueUsd: valueConv.usd,
      costBasisArs: costConv.ars,
      costBasisUsd: costConv.usd,
      unrealizedPnlArs: pnlConv.ars,
      unrealizedPnlUsd: pnlConv.usd,
      dayChangeNative,
      dayChangePct,
      dayChangeArs: dayChangeConv.ars,
    });

    if (valueConv.ars != null) totalValueArs += valueConv.ars;
    if (valueConv.usd != null) totalValueUsd += valueConv.usd;
    if (costConv.ars != null) totalCostArs += costConv.ars;
    if (costConv.usd != null) totalCostUsd += costConv.usd;
    if (pnlConv.ars != null) totalUnrealizedPnlArs += pnlConv.ars;
    if (pnlConv.usd != null) totalUnrealizedPnlUsd += pnlConv.usd;
    if (dayChangeConv.ars != null && valueConv.ars != null) {
      totalDayChangeArs += dayChangeConv.ars;
      totalPreviousValueArs += valueConv.ars - dayChangeConv.ars;
    }
  }

  const totalDayChangePct = totalPreviousValueArs > 0 ? (totalDayChangeArs / totalPreviousValueArs) * 100 : null;

  let totalRealizedPnlArs = 0;
  let totalRealizedPnlUsd = 0;
  const enrichedRealizedTrades: RealizedTrade[] = [];
  for (const trade of realizedTrades) {
    const conv = convert(trade.pnlNative, trade.currency, ccl);
    if (conv.ars != null) totalRealizedPnlArs += conv.ars;
    if (conv.usd != null) totalRealizedPnlUsd += conv.usd;

    const costOfSold = trade.buyPrice * trade.quantity;
    enrichedRealizedTrades.push({
      ...trade,
      pnlPct: costOfSold > 0 ? (trade.pnlNative / costOfSold) * 100 : null,
      pnlArs: conv.ars,
      pnlUsd: conv.usd,
    });
  }
  // Más reciente primero: es un ledger, la lectura natural es "qué cerré
  // últimamente", no un orden cronológico ascendente.
  enrichedRealizedTrades.sort((a, b) => b.date.localeCompare(a.date));

  let totalDividendsArs = 0;
  let totalDividendsUsd = 0;
  for (const div of dividends) {
    const conv = convert(div.amount, div.currency, ccl);
    if (conv.ars != null) totalDividendsArs += conv.ars;
    if (conv.usd != null) totalDividendsUsd += conv.usd;
  }

  positions.sort((a, b) => (b.valueArs ?? 0) - (a.valueArs ?? 0));

  return {
    positions,
    totalValueArs,
    totalValueUsd,
    totalCostArs,
    totalCostUsd,
    totalUnrealizedPnlArs,
    totalUnrealizedPnlUsd,
    totalRealizedPnlArs,
    totalRealizedPnlUsd,
    totalDividendsArs,
    totalDividendsUsd,
    totalDayChangeArs,
    totalDayChangePct,
    ccl,
    ccpFetchedAt,
    realizedTrades: enrichedRealizedTrades,
  };
}
