import assert from "node:assert/strict";
import { test } from "node:test";
import { buildActivityFeed, buildMovementDetail, buildPortfolioSummary } from "@serruchito/core";
import type { ActivityEvent, Dividend, Position, Quote, Transaction } from "@serruchito/core";

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    date: "2026-01-01",
    broker: "balanz",
    ticker: "AAPL",
    asset_type: "cedear",
    side: "buy",
    quantity: 10,
    price: 10,
    currency: "ARS",
    fees: 0,
    notes: null,
    ...overrides,
  };
}

function div(overrides: Partial<Dividend>): Dividend {
  return {
    id: 1,
    date: "2026-02-01",
    broker: "balanz",
    ticker: "AAPL",
    amount: 50,
    currency: "ARS",
    notes: null,
    ...overrides,
  };
}

// Las posiciones se derivan del motor real en vez de escribirse a mano: si el
// shape de Position cambia, estos tests se enteran.
function positionsFor(transactions: Transaction[], marketPrice: number | null): Position[] {
  const quotes = new Map<string, Quote>();
  if (marketPrice != null) {
    quotes.set("AAPL::cedear", {
      ticker: "AAPL",
      price: marketPrice,
      currency: "ARS",
      source: "test",
      fetched_at: "now",
    });
  }
  return buildPortfolioSummary({ transactions, dividends: [], quotes, ccl: 1000, ccpFetchedAt: "now" }).positions;
}

function eventFor(transactions: Transaction[], dividends: Dividend[], key: string): ActivityEvent {
  const event = buildActivityFeed({ transactions, dividends, cashHoldings: [] }).find((e) => e.key === key);
  assert.ok(event, `no se encontró el evento ${key}`);
  return event;
}

test("caso del pedido: compré 10 a $10 en balanz y vendí 10 a $11 -> +$10 (+10%)", () => {
  const transactions = [
    tx({ id: 1, side: "buy", quantity: 10, price: 10 }),
    tx({ id: 2, side: "sell", quantity: 10, price: 11, date: "2026-01-02" }),
  ];
  const detail = buildMovementDetail({
    event: eventFor(transactions, [], "sell-2"),
    transactions,
    dividends: [],
    positions: positionsFor(transactions, 12),
    ccl: 1000,
  });

  assert.equal(detail.realized!.pnlNative, 10);
  assert.equal(detail.realized!.pnlPct, 10);
  assert.equal(detail.realized!.avgCost, 10);
  assert.equal(detail.realized!.sellPrice, 11);
  assert.equal(detail.realized!.proceeds, 110);
  assert.equal(detail.realized!.costOfSold, 100);
  assert.equal(detail.realized!.pnlArs, 10);
  assert.equal(detail.realized!.pnlUsd, 0.01); // 10 ARS / CCL 1000
  // Una venta no muestra variación no realizada: el resultado ya se tomó.
  assert.equal(detail.unrealized, null);
  assert.equal(detail.context!.quantityAfter, 0);
});

test("compra con posición abierta: la variación se mide contra el precio de mercado", () => {
  const transactions = [tx({ id: 1, quantity: 10, price: 10 })];
  const detail = buildMovementDetail({
    event: eventFor(transactions, [], "buy-1"),
    transactions,
    dividends: [],
    positions: positionsFor(transactions, 12.5),
    ccl: 1000,
  });

  assert.equal(detail.unrealized!.status, "open");
  assert.equal(detail.unrealized!.pricePaid, 10);
  assert.equal(detail.unrealized!.marketPrice, 12.5);
  assert.equal(detail.unrealized!.changePerUnit, 2.5);
  assert.equal(detail.unrealized!.changeTotal, 25);
  assert.equal(detail.unrealized!.changePct, 25);
  assert.equal(detail.realized, null);
});

test("compra de una posición ya cerrada: no se inventa un no realizado", () => {
  const transactions = [
    tx({ id: 1, side: "buy", quantity: 10, price: 10 }),
    tx({ id: 2, side: "sell", quantity: 10, price: 11, date: "2026-01-02" }),
  ];
  const detail = buildMovementDetail({
    event: eventFor(transactions, [], "buy-1"),
    transactions,
    dividends: [],
    positions: positionsFor(transactions, 12),
    ccl: 1000,
  });

  assert.equal(detail.unrealized!.status, "closed");
  assert.equal(detail.unrealized!.marketPrice, null); // la posición ya no existe
  assert.equal(detail.unrealized!.changeTotal, null);
});

test("compra con venta parcial posterior: la posición queda partially_sold", () => {
  const transactions = [
    tx({ id: 1, side: "buy", quantity: 10, price: 10 }),
    tx({ id: 2, side: "sell", quantity: 4, price: 11, date: "2026-01-02" }),
  ];
  const detail = buildMovementDetail({
    event: eventFor(transactions, [], "buy-1"),
    transactions,
    dividends: [],
    positions: positionsFor(transactions, 12),
    ccl: 1000,
  });

  assert.equal(detail.unrealized!.status, "partially_sold");
  assert.equal(detail.unrealized!.changeTotal, 20); // (12 - 10) * 10 compradas
});

test("sin cotización: la compra no puede medir variación pero sigue mostrando la operación", () => {
  const transactions = [tx({ id: 1, quantity: 10, price: 10, fees: 5 })];
  const detail = buildMovementDetail({
    event: eventFor(transactions, [], "buy-1"),
    transactions,
    dividends: [],
    positions: positionsFor(transactions, null),
    ccl: 1000,
  });

  assert.equal(detail.unrealized!.marketPrice, null);
  assert.equal(detail.unrealized!.changePerUnit, null);
  assert.equal(detail.unrealized!.changePct, null);
  assert.equal(detail.breakdown.gross, 100);
  assert.equal(detail.breakdown.fees, 5);
  assert.equal(detail.breakdown.net, 105);
});

test("sin CCL: el monto en la otra moneda queda en null, no en 0", () => {
  const transactions = [tx({ id: 1, quantity: 10, price: 10 })];
  const detail = buildMovementDetail({
    event: eventFor(transactions, [], "buy-1"),
    transactions,
    dividends: [],
    positions: positionsFor(transactions, 12),
    ccl: null,
  });

  assert.equal(detail.breakdown.netArs, 100);
  assert.equal(detail.breakdown.netUsd, null);
});

test("dividendo con posición viva: yield sobre el costo de la tenencia y total cobrado", () => {
  const transactions = [tx({ id: 1, quantity: 10, price: 10 })]; // costo 100
  const dividends = [div({ id: 1, amount: 5 }), div({ id: 2, amount: 3, date: "2026-03-01" })];
  const detail = buildMovementDetail({
    event: eventFor(transactions, dividends, "dividend-1"),
    transactions,
    dividends,
    positions: positionsFor(transactions, 12),
    ccl: 1000,
  });

  assert.equal(detail.dividend!.amount, 5);
  assert.equal(detail.dividend!.yieldOnCostPct, 5); // 5 sobre un costo de 100
  assert.equal(detail.dividend!.totalCollected, 8);
  assert.equal(detail.realized, null);
  assert.equal(detail.context, null);
});

test("dividendo de una posición cerrada: sin costo vivo, el yield es null y no 0", () => {
  const transactions = [
    tx({ id: 1, side: "buy", quantity: 10, price: 10 }),
    tx({ id: 2, side: "sell", quantity: 10, price: 11, date: "2026-01-02" }),
  ];
  const dividends = [div({ id: 1, amount: 5 })];
  const detail = buildMovementDetail({
    event: eventFor(transactions, dividends, "dividend-1"),
    transactions,
    dividends,
    positions: positionsFor(transactions, 12),
    ccl: 1000,
  });

  assert.equal(detail.dividend!.yieldOnCostPct, null);
  assert.equal(detail.dividend!.totalCollected, 5);
});

test("tickerSummary acumula invertido, vendido y dividendos del ticker", () => {
  const transactions = [
    tx({ id: 1, side: "buy", quantity: 10, price: 10, fees: 5 }),
    tx({ id: 2, side: "buy", quantity: 10, price: 20, date: "2026-01-02" }),
    tx({ id: 3, side: "sell", quantity: 5, price: 30, date: "2026-01-03", fees: 2 }),
    // Otro ticker: no tiene que contaminar el resumen.
    tx({ id: 4, ticker: "MSFT", quantity: 1, price: 999, date: "2026-01-04" }),
  ];
  const dividends = [div({ id: 1, amount: 7 })];
  const detail = buildMovementDetail({
    event: eventFor(transactions, dividends, "buy-1"),
    transactions,
    dividends,
    positions: positionsFor(transactions, 30),
    ccl: 1000,
  });

  const summary = detail.tickerSummary!;
  assert.equal(summary.ticker, "AAPL");
  assert.equal(summary.invested, 305); // (10*10 + 5) + (10*20)
  assert.equal(summary.sold, 148); // 5*30 - 2
  assert.equal(summary.dividends, 7);
  assert.equal(summary.quantityHeld, 15);
  assert.equal(summary.movementCount, 4); // 3 transacciones de AAPL + 1 dividendo
});

test("un movimiento de efectivo no tiene P&L ni ticker asociado", () => {
  const cashHoldings = [
    { id: 1, label: "Plata en el banco", broker: null, amount: 1000, currency: "ARS" as const, notes: null, created_date: "2026-01-05" },
  ];
  const event = buildActivityFeed({ transactions: [], dividends: [], cashHoldings }).find((e) => e.key === "cash-1")!;
  const detail = buildMovementDetail({ event, transactions: [], dividends: [], positions: [], ccl: 1000 });

  assert.equal(detail.realized, null);
  assert.equal(detail.unrealized, null);
  assert.equal(detail.dividend, null);
  assert.equal(detail.tickerSummary, null);
  assert.equal(detail.breakdown.net, 1000);
  assert.equal(detail.breakdown.netUsd, 1);
});
