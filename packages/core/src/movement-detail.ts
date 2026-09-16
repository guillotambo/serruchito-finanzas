import type { ActivityEvent } from "./activity";
import { calculatePositions, convert } from "./portfolio";
import type { TransactionContext } from "./portfolio";
import type { Currency, Dividend, Position, Transaction } from "./types";

/**
 * Detalle de UN movimiento del feed: el desglose de la operación, cómo movió
 * la posición y — lo que motiva todo el módulo — cuánta ganancia o pérdida
 * salió de ahí.
 *
 * El método de costeo del sistema es costo promedio ponderado (ver
 * portfolio.ts), y eso decide qué número es honesto mostrar en cada caso:
 *
 *   - En una VENTA el resultado es exacto: es el mismo P&L realizado que ya
 *     aparece en Cartera y en Rendimiento, calculado contra el PPC vigente al
 *     momento de vender.
 *   - En una COMPRA no existe "la ganancia de esa compra": bajo PPC las
 *     compras se promedian y pierden identidad. Lo que sí es exacto es la
 *     variación de precio entre lo que se pagó y el precio de mercado de hoy,
 *     y como tal se expone (`unrealized`), no como un P&L realizable.
 *
 * Función pura: no lee el reloj ni la red. `positions` y `ccl` entran por
 * parámetro (vienen de /api/portfolio en los dos clientes).
 */

export type MovementBreakdown = {
  // null en dividendos y efectivo, que no tienen cantidad ni precio unitario.
  quantity: number | null;
  price: number | null;
  gross: number | null; // quantity * price, antes de comisiones
  fees: number | null;
  net: number; // lo que efectivamente salió o entró (== event.amount)
  currency: Currency;
  // El neto en las dos monedas. null cuando falta el CCL (mismo criterio que
  // summarizeActivity: un monto que no se puede convertir se informa como "no
  // sé", nunca como 0).
  netArs: number | null;
  netUsd: number | null;
};

/**
 * Qué pasó con la posición desde esta compra hasta hoy. Determina si tiene
 * sentido mostrar una variación no realizada:
 *   open           -> la tenencia nunca bajó de lo que dejó esta compra
 *   partially_sold -> se vendió parte; queda menos de lo que dejó esta compra
 *   closed         -> no queda nada en cartera; el resultado ya se realizó
 */
export type PositionStatus = "open" | "partially_sold" | "closed";

export type MovementUnrealized = {
  status: PositionStatus;
  pricePaid: number; // precio unitario de esta compra (sin prorratear fees)
  marketPrice: number | null; // precio actual de la posición ticker::broker
  priceStale: boolean;
  quantity: number; // la cantidad comprada en esta operación
  // Diferencia de precio por unidad y sobre la cantidad comprada. null si no
  // hay cotización disponible.
  changePerUnit: number | null;
  changeTotal: number | null;
  changePct: number | null;
  currency: Currency;
};

export type MovementRealized = {
  soldQuantity: number;
  sellPrice: number;
  avgCost: number; // PPC contra el que se realizó
  proceeds: number;
  costOfSold: number;
  pnlNative: number;
  pnlPct: number | null;
  pnlArs: number | null;
  pnlUsd: number | null;
  currency: Currency;
};

export type MovementDividendContext = {
  amount: number;
  currency: Currency;
  // amount / costo de la tenencia actual del ticker, en %. null si no queda
  // posición abierta (no hay sobre qué medir el rendimiento) o si el costo es 0.
  yieldOnCostPct: number | null;
  // Todo lo cobrado históricamente de este ticker, en la moneda del dividendo.
  totalCollected: number;
};

// Resumen de todo lo movido con este ticker, para responder "¿y cómo vengo
// con esto en general?" sin salir del detalle.
export type MovementTickerSummary = {
  ticker: string;
  quantityHeld: number; // suma de todos los brokers
  avgCost: number | null; // PPC ponderado entre brokers, null si no queda nada
  currency: Currency;
  invested: number; // total pagado en compras (moneda nativa)
  sold: number; // total recibido en ventas
  dividends: number; // total cobrado
  movementCount: number;
};

export type MovementDetail = {
  event: ActivityEvent;
  breakdown: MovementBreakdown;
  // null en dividendos y efectivo: no son operaciones sobre una posición.
  context: TransactionContext | null;
  realized: MovementRealized | null; // solo ventas
  unrealized: MovementUnrealized | null; // solo compras
  dividend: MovementDividendContext | null;
  // null en efectivo: un saldo manual no pertenece a ningún ticker.
  tickerSummary: MovementTickerSummary | null;
};

export function buildMovementDetail(params: {
  event: ActivityEvent;
  transactions: Transaction[];
  dividends: Dividend[];
  positions: Position[];
  ccl: number | null;
}): MovementDetail {
  const { event, transactions, dividends, positions, ccl } = params;

  const netConv = convert(event.amount, event.currency, ccl);
  const breakdown: MovementBreakdown = {
    quantity: event.quantity,
    price: event.price,
    gross: event.quantity != null && event.price != null ? event.quantity * event.price : null,
    fees: event.fees,
    net: event.amount,
    currency: event.currency,
    netArs: netConv.ars,
    netUsd: netConv.usd,
  };

  if (event.kind === "cash") {
    return { event, breakdown, context: null, realized: null, unrealized: null, dividend: null, tickerSummary: null };
  }

  const tickerTransactions = transactions.filter((t) => t.ticker === event.title);
  const tickerDividends = dividends.filter((d) => d.ticker === event.title);
  const tickerPositions = positions.filter((p) => p.ticker === event.title);
  const tickerSummary = summarizeTicker(event.title, tickerTransactions, tickerDividends, tickerPositions, event.currency);

  if (event.kind === "dividend") {
    return {
      event,
      breakdown,
      context: null,
      realized: null,
      unrealized: null,
      dividend: buildDividendContext(event, tickerDividends, tickerPositions),
      tickerSummary,
    };
  }

  // Compra o venta. El contexto se recalcula sobre las transacciones del
  // ticker (no las de toda la cartera): calculatePositions agrupa por
  // `ticker::broker`, así que restringir el universo da el mismo resultado y
  // evita recorrer un historial completo por cada apertura del detalle.
  const context = calculatePositions(tickerTransactions).contexts.get(event.id) ?? null;
  const position = tickerPositions.find((p) => p.broker === event.broker) ?? null;

  return {
    event,
    breakdown,
    context,
    realized: event.kind === "sell" ? buildRealized(event, context, ccl) : null,
    unrealized: event.kind === "buy" ? buildUnrealized(event, context, position) : null,
    dividend: null,
    tickerSummary,
  };
}

function buildRealized(
  event: ActivityEvent,
  context: TransactionContext | null,
  ccl: number | null
): MovementRealized | null {
  if (!context?.realized || event.price == null) return null;
  const { soldQuantity, avgCost, costOfSold, proceeds, pnlNative, pnlPct } = context.realized;
  const conv = convert(pnlNative, event.currency, ccl);
  return {
    soldQuantity,
    sellPrice: event.price,
    avgCost,
    proceeds,
    costOfSold,
    pnlNative,
    pnlPct,
    pnlArs: conv.ars,
    pnlUsd: conv.usd,
    currency: event.currency,
  };
}

function buildUnrealized(
  event: ActivityEvent,
  context: TransactionContext | null,
  position: Position | null
): MovementUnrealized | null {
  if (event.price == null || event.quantity == null) return null;

  // `quantityAfter` es lo que había en cartera justo después de esta compra;
  // si hoy queda menos, en el medio hubo ventas.
  const heldNow = position?.quantity ?? 0;
  const heldAfterBuy = context?.quantityAfter ?? event.quantity;
  const status: PositionStatus = heldNow <= 0 ? "closed" : heldNow < heldAfterBuy ? "partially_sold" : "open";

  const marketPrice = position?.marketPrice ?? null;
  const changePerUnit = marketPrice != null ? marketPrice - event.price : null;

  return {
    status,
    pricePaid: event.price,
    marketPrice,
    priceStale: position?.priceStale ?? true,
    quantity: event.quantity,
    changePerUnit,
    changeTotal: changePerUnit != null ? changePerUnit * event.quantity : null,
    changePct: changePerUnit != null && event.price > 0 ? (changePerUnit / event.price) * 100 : null,
    currency: event.currency,
  };
}

function buildDividendContext(
  event: ActivityEvent,
  tickerDividends: Dividend[],
  tickerPositions: Position[]
): MovementDividendContext {
  // El costo se suma solo sobre las posiciones que están en la misma moneda
  // que el dividendo: mezclar ARS y USD sin CCL daría un yield inventado.
  let costBasis = 0;
  for (const position of tickerPositions) {
    if (position.costCurrency === event.currency) costBasis += position.costBasisNative;
  }

  let totalCollected = 0;
  for (const dividend of tickerDividends) {
    if (dividend.currency === event.currency) totalCollected += dividend.amount;
  }

  return {
    amount: event.amount,
    currency: event.currency,
    yieldOnCostPct: costBasis > 0 ? (event.amount / costBasis) * 100 : null,
    totalCollected,
  };
}

function summarizeTicker(
  ticker: string,
  tickerTransactions: Transaction[],
  tickerDividends: Dividend[],
  tickerPositions: Position[],
  currency: Currency
): MovementTickerSummary {
  let invested = 0;
  let sold = 0;
  for (const tx of tickerTransactions) {
    if (tx.currency !== currency) continue;
    if (tx.side === "buy") invested += tx.quantity * tx.price + tx.fees;
    else sold += tx.quantity * tx.price - tx.fees;
  }

  let dividendTotal = 0;
  for (const dividend of tickerDividends) {
    if (dividend.currency === currency) dividendTotal += dividend.amount;
  }

  // PPC ponderado entre brokers: el mismo ticker puede estar en dos cuentas
  // con costos distintos y acá se lee como una sola tenencia.
  let quantityHeld = 0;
  let costHeld = 0;
  for (const position of tickerPositions) {
    if (position.costCurrency !== currency) continue;
    quantityHeld += position.quantity;
    costHeld += position.costBasisNative;
  }

  return {
    ticker,
    quantityHeld,
    avgCost: quantityHeld > 0 ? costHeld / quantityHeld : null,
    currency,
    invested,
    sold,
    dividends: dividendTotal,
    movementCount: tickerTransactions.length + tickerDividends.length,
  };
}
