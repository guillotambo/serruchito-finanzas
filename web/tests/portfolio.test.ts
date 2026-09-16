import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPortfolioSummary, calculatePositions } from "@serruchito/core";
import type { Dividend, Quote, Transaction } from "@serruchito/core";

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    date: "2026-01-01",
    broker: "cocos",
    ticker: "SPY",
    asset_type: "cedear",
    side: "buy",
    quantity: 10,
    price: 500,
    currency: "ARS",
    fees: 0,
    notes: null,
    ...overrides,
  };
}

test("caso conocido: 10 SPY a $500, precio actual $600 -> PPC, P&L y valuación ARS/USD", () => {
  const transactions: Transaction[] = [tx({ id: 1 })];
  const quotes = new Map<string, Quote>([
    ["SPY::cedear", { ticker: "SPY", price: 600, currency: "ARS", source: "test", fetched_at: "now" }],
  ]);
  const dividends: Dividend[] = [];
  const ccl = 1000;

  const summary = buildPortfolioSummary({ transactions, dividends, quotes, ccl, ccpFetchedAt: "now" });

  assert.equal(summary.positions.length, 1);
  const pos = summary.positions[0];
  assert.equal(pos.quantity, 10);
  assert.equal(pos.avgCost, 500);
  assert.equal(pos.marketPrice, 600);
  assert.equal(pos.valueNative, 6000);
  assert.equal(pos.costBasisNative, 5000);
  assert.equal(pos.unrealizedPnlNative, 1000);
  assert.equal(pos.unrealizedPnlPct, 20);
  assert.equal(pos.valueArs, 6000);
  assert.equal(pos.valueUsd, 6); // 6000 ARS / CCL 1000
  assert.equal(summary.totalValueArs, 6000);
  assert.equal(summary.totalUnrealizedPnlArs, 1000);
});

test("venta parcial: PPC ponderado se mantiene y P&L realizado se calcula sobre lo vendido", () => {
  const transactions: Transaction[] = [
    tx({ id: 1, side: "buy", quantity: 10, price: 100 }),
    tx({ id: 2, side: "sell", quantity: 4, price: 150, date: "2026-01-02" }),
  ];
  const { positions, realizedTrades } = calculatePositions(transactions);
  const key = "SPY::cocos";
  const acc = positions.get(key)!;

  assert.equal(acc.quantity, 6);
  assert.equal(acc.totalCost, 600); // 6 restantes * PPC 100
  assert.equal(realizedTrades.length, 1);
  assert.equal(realizedTrades[0].pnlNative, 200); // (150-100)*4
});

test("compras a distinto precio: PPC ponderado por cantidad", () => {
  const transactions: Transaction[] = [
    tx({ id: 1, side: "buy", quantity: 10, price: 100 }),
    tx({ id: 2, side: "buy", quantity: 10, price: 200, date: "2026-01-02" }),
  ];
  const { positions } = calculatePositions(transactions);
  const acc = positions.get("SPY::cocos")!;
  assert.equal(acc.quantity, 20);
  assert.equal(acc.totalCost / acc.quantity, 150); // promedio ponderado
});

test("transferir broker: reasignar broker en las transacciones fusiona la posición con PPC ponderado (mismo cálculo que el UPDATE de move-broker)", () => {
  const transactions: Transaction[] = [
    tx({ id: 1, broker: "cocos", side: "buy", quantity: 10, price: 100 }),
    tx({ id: 2, broker: "cocos", side: "buy", quantity: 5, price: 130, date: "2026-01-02" }),
    tx({ id: 3, broker: "iol", side: "buy", quantity: 5, price: 160, date: "2026-01-03" }),
  ];

  // Estado antes de transferir: dos posiciones separadas por broker.
  const before = calculatePositions(transactions);
  assert.equal(before.positions.get("SPY::cocos")!.quantity, 15);
  assert.equal(before.positions.get("SPY::iol")!.quantity, 5);

  // Simula el UPDATE de /api/transactions/move-broker (reasigna broker
  // 'cocos' -> 'iol' en las transacciones, sin tocar nada más).
  const afterTransfer = transactions.map((t) => (t.broker === "cocos" ? { ...t, broker: "iol" as const } : t));

  const { positions, realizedTrades } = calculatePositions(afterTransfer);

  // La posición de origen desaparece; el destino tiene todo fusionado.
  assert.equal(positions.has("SPY::cocos"), false);
  const merged = positions.get("SPY::iol")!;
  assert.equal(merged.quantity, 20); // 10 + 5 + 5
  assert.equal(merged.totalCost, 10 * 100 + 5 * 130 + 5 * 160);
  assert.equal(merged.totalCost / merged.quantity, 122.5); // PPC ponderado, no un promedio simple

  // Reasignar broker no es una venta: no se genera ningún P&L realizado.
  assert.equal(realizedTrades.length, 0);
});

test("contexts: la primera compra no tiene PPC previo y deja la posición armada", () => {
  const { contexts } = calculatePositions([tx({ id: 1, quantity: 10, price: 100, fees: 50 })]);
  const ctx = contexts.get(1)!;

  assert.equal(ctx.quantityBefore, 0);
  assert.equal(ctx.avgCostBefore, null);
  assert.equal(ctx.quantityAfter, 10);
  assert.equal(ctx.avgCostAfter, 105); // (10*100 + 50 de comisión) / 10
  assert.equal(ctx.realized, null);
});

test("contexts: la segunda compra a otro precio muestra el PPC antes y después", () => {
  const { contexts } = calculatePositions([
    tx({ id: 1, quantity: 10, price: 100 }),
    tx({ id: 2, quantity: 10, price: 200, date: "2026-01-02" }),
  ]);
  const ctx = contexts.get(2)!;

  assert.equal(ctx.quantityBefore, 10);
  assert.equal(ctx.avgCostBefore, 100);
  assert.equal(ctx.quantityAfter, 20);
  assert.equal(ctx.avgCostAfter, 150);
});

test("contexts: una venta parcial informa los mismos números que su realizedTrade", () => {
  const { contexts, realizedTrades } = calculatePositions([
    tx({ id: 1, side: "buy", quantity: 10, price: 100 }),
    tx({ id: 2, side: "sell", quantity: 4, price: 150, date: "2026-01-02" }),
  ]);
  const realized = contexts.get(2)!.realized!;
  const trade = realizedTrades[0];

  assert.equal(trade.txId, 2);
  assert.equal(realized.pnlNative, trade.pnlNative);
  assert.equal(realized.avgCost, trade.buyPrice);
  assert.equal(realized.soldQuantity, trade.quantity);
  assert.equal(realized.proceeds, 600); // 4 * 150, sin comisiones
  assert.equal(realized.costOfSold, 400);
  assert.equal(realized.pnlPct, 50);
  // La posición sigue abierta con el PPC intacto.
  assert.equal(contexts.get(2)!.quantityAfter, 6);
  assert.equal(contexts.get(2)!.avgCostAfter, 100);
});

test("contexts: la venta que cierra la posición deja avgCostAfter en null, no en 0", () => {
  const { contexts } = calculatePositions([
    tx({ id: 1, side: "buy", quantity: 10, price: 10 }),
    tx({ id: 2, side: "sell", quantity: 10, price: 11, date: "2026-01-02" }),
  ]);
  const ctx = contexts.get(2)!;

  assert.equal(ctx.quantityAfter, 0);
  assert.equal(ctx.avgCostAfter, null);
  assert.equal(ctx.realized!.pnlNative, 10); // (11 - 10) * 10
});

test("sin cotización disponible: la posición existe pero no se puede valuar", () => {
  const transactions: Transaction[] = [tx({ id: 1 })];
  const summary = buildPortfolioSummary({
    transactions,
    dividends: [],
    quotes: new Map(),
    ccl: 1000,
    ccpFetchedAt: null,
  });
  const pos = summary.positions[0];
  assert.equal(pos.marketPrice, null);
  assert.equal(pos.valueNative, null);
  assert.equal(pos.unrealizedPnlNative, null);
  assert.equal(summary.totalValueArs, 0);
});

test("posición en USD (stock_us de IBKR) se convierte a ARS con el CCL", () => {
  const transactions: Transaction[] = [
    tx({ id: 1, ticker: "VOO", broker: "ibkr", asset_type: "stock_us", currency: "USD", quantity: 5, price: 400 }),
  ];
  const quotes = new Map<string, Quote>([
    ["VOO::stock_us", { ticker: "VOO", price: 450, currency: "USD", source: "test", fetched_at: "now" }],
  ]);
  const summary = buildPortfolioSummary({ transactions, dividends: [], quotes, ccl: 1000, ccpFetchedAt: "now" });
  const pos = summary.positions[0];
  assert.equal(pos.valueUsd, 2250); // 5 * 450
  assert.equal(pos.valueArs, 2_250_000); // 2250 * CCL 1000
});

test("realizedTrades: la venta parcial queda en el summary con pnlPct/pnlArs/pnlUsd", () => {
  const transactions: Transaction[] = [
    tx({ id: 1, side: "buy", quantity: 10, price: 100 }),
    tx({ id: 2, side: "sell", quantity: 4, price: 150, date: "2026-01-02" }),
  ];
  const summary = buildPortfolioSummary({ transactions, dividends: [], quotes: new Map(), ccl: 1000, ccpFetchedAt: null });

  assert.equal(summary.realizedTrades.length, 1);
  const trade = summary.realizedTrades[0];
  assert.equal(trade.pnlNative, 200); // (150-100)*4
  assert.equal(trade.pnlPct, 50); // 200 / (100*4) * 100
  assert.equal(trade.pnlArs, 200); // ARS nativo, ccl no aplica
  assert.equal(trade.pnlUsd, 0.2); // 200 / ccl 1000
  assert.equal(summary.totalRealizedPnlArs, 200);
});

test("variación del día: con previousClose se calcula dayChange por posición y el total del portafolio", () => {
  const transactions: Transaction[] = [tx({ id: 1, quantity: 10, price: 500 })];
  const quotes = new Map<string, Quote>([
    ["SPY::cedear", { ticker: "SPY", price: 600, currency: "ARS", source: "test", fetched_at: "now", previousClose: 550 }],
  ]);
  const summary = buildPortfolioSummary({ transactions, dividends: [], quotes, ccl: 1000, ccpFetchedAt: "now" });
  const pos = summary.positions[0];

  assert.equal(pos.dayChangeNative, 50); // 600 - 550
  assert.ok(pos.dayChangePct != null && Math.abs(pos.dayChangePct - (50 / 550) * 100) < 1e-9);
  assert.equal(pos.dayChangeArs, 500); // 10 * 50
  assert.equal(summary.totalDayChangeArs, 500);
  // % del portafolio: dayChangeArs / (valueArs - dayChangeArs) = 500 / (6000 - 500)
  assert.ok(summary.totalDayChangePct != null && Math.abs(summary.totalDayChangePct - (500 / 5500) * 100) < 1e-9);
});

test("variación del día: sin previousClose, dayChange es null y no aporta al total", () => {
  const transactions: Transaction[] = [tx({ id: 1, quantity: 10, price: 500 })];
  const quotes = new Map<string, Quote>([
    ["SPY::cedear", { ticker: "SPY", price: 600, currency: "ARS", source: "test", fetched_at: "now" }],
  ]);
  const summary = buildPortfolioSummary({ transactions, dividends: [], quotes, ccl: 1000, ccpFetchedAt: "now" });
  const pos = summary.positions[0];

  assert.equal(pos.dayChangeNative, null);
  assert.equal(pos.dayChangePct, null);
  assert.equal(pos.dayChangeArs, null);
  assert.equal(summary.totalDayChangeArs, 0);
  assert.equal(summary.totalDayChangePct, null);
});

test("mismo ticker en dos asset_type distintos (MSFT CEDEAR en ARS vs. acción directa en USD) no se pisan", () => {
  const transactions: Transaction[] = [
    tx({ id: 1, ticker: "MSFT", broker: "cocos", asset_type: "cedear", currency: "ARS", quantity: 10, price: 20000 }),
    tx({ id: 2, ticker: "MSFT", broker: "ibkr", asset_type: "stock_us", currency: "USD", quantity: 2, price: 400 }),
  ];
  const quotes = new Map<string, Quote>([
    ["MSFT::cedear", { ticker: "MSFT", price: 21000, currency: "ARS", source: "test", fetched_at: "now" }],
    ["MSFT::stock_us", { ticker: "MSFT", price: 410, currency: "USD", source: "test", fetched_at: "now" }],
  ]);
  const summary = buildPortfolioSummary({ transactions, dividends: [], quotes, ccl: 1000, ccpFetchedAt: "now" });

  const cedear = summary.positions.find((p) => p.broker === "cocos")!;
  const stockUs = summary.positions.find((p) => p.broker === "ibkr")!;

  assert.equal(cedear.marketPrice, 21000); // no contaminado por el precio USD
  assert.equal(cedear.costCurrency, "ARS");
  assert.equal(stockUs.marketPrice, 410); // no contaminado por el precio ARS
  assert.equal(stockUs.costCurrency, "USD");
});
