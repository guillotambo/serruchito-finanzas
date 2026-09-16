import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRealizedSummary } from "@serruchito/core";
import type { Dividend, RealizedTrade } from "@serruchito/core";

function trade(overrides: Partial<RealizedTrade>): RealizedTrade {
  return {
    txId: 1,
    ticker: "SPY",
    broker: "cocos",
    date: "2026-01-15",
    quantity: 10,
    buyPrice: 100,
    sellPrice: 150,
    currency: "ARS",
    pnlNative: 500,
    pnlPct: 50,
    pnlArs: 500,
    pnlUsd: 0.5,
    ...overrides,
  };
}

function div(overrides: Partial<Dividend>): Dividend {
  return {
    id: 1,
    date: "2026-01-10",
    broker: "cocos",
    ticker: "SPY",
    amount: 100,
    currency: "ARS",
    notes: null,
    ...overrides,
  };
}

test("filtro por período: mes, año e histórico", () => {
  const trades: RealizedTrade[] = [
    trade({ date: "2026-01-15" }),
    trade({ date: "2026-02-01" }),
    trade({ date: "2025-12-01" }),
  ];
  const today = "2026-01-30";

  const month = buildRealizedSummary({ trades, dividends: [], ccl: 1000, period: "month", today });
  assert.equal(month.trades.length, 1);
  assert.equal(month.trades[0].date, "2026-01-15");

  const year = buildRealizedSummary({ trades, dividends: [], ccl: 1000, period: "year", today });
  assert.equal(year.trades.length, 2);

  const all = buildRealizedSummary({ trades, dividends: [], ccl: 1000, period: "all", today });
  assert.equal(all.trades.length, 3);
});

test("agregación por ticker: unifica brokers y monedas distintas para el mismo ticker", () => {
  const trades: RealizedTrade[] = [
    trade({ ticker: "MSFT", broker: "cocos", currency: "ARS", buyPrice: 20000, sellPrice: 21000, quantity: 10, pnlNative: 10000, pnlArs: 10000, pnlUsd: 10 }),
    trade({ ticker: "MSFT", broker: "ibkr", currency: "USD", buyPrice: 400, sellPrice: 410, quantity: 2, pnlNative: 20, pnlArs: 20000, pnlUsd: 20 }),
  ];
  const summary = buildRealizedSummary({ trades, dividends: [], ccl: 1000, period: "all", today: "2026-01-30" });

  assert.equal(summary.byTicker.length, 1);
  const msft = summary.byTicker[0];
  assert.equal(msft.tradeCount, 2);
  assert.equal(msft.quantity, 12);
  assert.equal(msft.pnlArs, 30000); // 10000 + 20000
  assert.equal(msft.costArs, 200000 + 800000); // 20000*10 + (400*2)*ccl 1000
  assert.ok(msft.pnlPct != null && Math.abs(msft.pnlPct - (30000 / 1_000_000) * 100) < 1e-9);
});

test("byTicker: orden descendente por pnlArs", () => {
  const trades: RealizedTrade[] = [
    trade({ ticker: "AAA", pnlArs: 100 }),
    trade({ ticker: "BBB", pnlArs: -50 }),
    trade({ ticker: "CCC", pnlArs: 500 }),
  ];
  const summary = buildRealizedSummary({ trades, dividends: [], ccl: 1000, period: "all", today: "2026-01-30" });
  assert.deepEqual(
    summary.byTicker.map((t) => t.ticker),
    ["CCC", "AAA", "BBB"]
  );
});

test("acumulado: mergea ventas y dividendos intercalados en orden ascendente", () => {
  const trades: RealizedTrade[] = [
    trade({ date: "2026-01-20", pnlArs: 500 }),
    trade({ date: "2026-01-05", pnlArs: 300 }),
  ];
  const dividends: Dividend[] = [div({ date: "2026-01-10", amount: 100, currency: "ARS" })];
  const summary = buildRealizedSummary({ trades, dividends, ccl: 1000, period: "all", today: "2026-01-30" });

  assert.equal(summary.cumulative.length, 3);
  assert.deepEqual(
    summary.cumulative.map((p) => p.date),
    ["2026-01-05", "2026-01-10", "2026-01-20"]
  );
  assert.equal(summary.cumulative[0].realizedArs, 300);
  assert.equal(summary.cumulative[0].totalArs, 300);
  assert.equal(summary.cumulative[1].dividendsArs, 100);
  assert.equal(summary.cumulative[1].totalArs, 400); // 300 realizado + 100 dividendo
  assert.equal(summary.cumulative[2].realizedArs, 800); // 300 + 500
  assert.equal(summary.cumulative[2].totalArs, 900);
});

test("período sin movimientos: totales en 0, sin romper", () => {
  const summary = buildRealizedSummary({
    trades: [trade({ date: "2025-06-01" })],
    dividends: [div({ date: "2025-06-01" })],
    ccl: 1000,
    period: "month",
    today: "2026-01-30",
  });
  assert.equal(summary.trades.length, 0);
  assert.equal(summary.realizedPnlArs, 0);
  assert.equal(summary.dividendsArs, 0);
  assert.equal(summary.totalCashedArs, 0);
  assert.equal(summary.byTicker.length, 0);
  assert.equal(summary.cumulative.length, 0);
});

test("realizado + dividendos: totalCashed suma ambos", () => {
  const trades: RealizedTrade[] = [trade({ pnlArs: 500, pnlUsd: 0.5 })];
  const dividends: Dividend[] = [div({ amount: 100, currency: "ARS" })];
  const summary = buildRealizedSummary({ trades, dividends, ccl: 1000, period: "all", today: "2026-01-30" });
  assert.equal(summary.totalCashedArs, 600); // 500 + 100
  assert.equal(summary.totalCashedUsd, 0.6); // 0.5 + 100/1000
  assert.equal(summary.winners, 1);
  assert.equal(summary.losers, 0);
});

test("ccl null: costArs y pnlUsd de un ticker con ventas en USD quedan null", () => {
  const trades: RealizedTrade[] = [
    trade({ ticker: "VOO", currency: "USD", buyPrice: 400, sellPrice: 410, quantity: 2, pnlNative: 20, pnlArs: null, pnlUsd: 20 }),
  ];
  const summary = buildRealizedSummary({ trades, dividends: [], ccl: null, period: "all", today: "2026-01-30" });
  const voo = summary.byTicker[0];
  assert.equal(voo.costArs, null); // no hay CCL para convertir el costo en USD a ARS
  assert.equal(voo.pnlArs, null);
  assert.equal(voo.pnlPct, null);
  assert.equal(summary.realizedPnlArs, 0); // no suma nada al ARS porque pnlArs es null
  assert.equal(summary.realizedPnlUsd, 20);
});
