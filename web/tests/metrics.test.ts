import assert from "node:assert/strict";
import { test } from "node:test";
import { computeBenchmarkComparison, computeConcentration, computeConcentrationByDimension, computeDividendMetrics, computeFeesSummary, computeHHI, computeMaxDrawdown, computePeriodReturn, computeTwr, computeVolatility, computeWeeklyPnl, computeXirr } from "@serruchito/core";
import type { Dividend, PortfolioSnapshot, Position, Transaction } from "@serruchito/core";

function pos(overrides: Partial<Position>): Position {
  return {
    ticker: "SPY",
    broker: "cocos",
    asset_type: "etf",
    quantity: 1,
    avgCost: 100,
    costCurrency: "ARS",
    marketPrice: 100,
    priceStale: false,
    valueNative: 100,
    costBasisNative: 100,
    unrealizedPnlNative: 0,
    unrealizedPnlPct: 0,
    valueArs: 100,
    valueUsd: null,
    costBasisArs: 100,
    costBasisUsd: null,
    unrealizedPnlArs: 0,
    unrealizedPnlUsd: null,
    dayChangeNative: null,
    dayChangePct: null,
    dayChangeArs: null,
    ...overrides,
  };
}

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    date: "2025-01-01",
    broker: "cocos",
    ticker: "SPY",
    asset_type: "etf",
    side: "buy",
    quantity: 1,
    price: 100,
    currency: "ARS",
    fees: 0,
    notes: null,
    ...overrides,
  };
}

function snapshot(date: string, totalValueArs: number, overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return {
    date,
    total_value_ars: totalValueArs,
    total_value_usd: 0,
    total_cost_ars: null,
    ccl: null,
    spy_usd: null,
    by_broker: {},
    ...overrides,
  };
}

function div(overrides: Partial<Dividend>): Dividend {
  return { id: 1, date: "2025-01-01", broker: "cocos", ticker: "SPY", amount: 10, currency: "ARS", notes: null, ...overrides };
}

test("concentración: top 3 de 4 activos con distinto peso", () => {
  const positions = [
    pos({ ticker: "A", valueArs: 500 }),
    pos({ ticker: "B", valueArs: 300 }),
    pos({ ticker: "C", valueArs: 150 }),
    pos({ ticker: "D", valueArs: 50 }),
  ];
  const result = computeConcentration(positions, 3);
  assert.ok(result);
  // (500+300+150) / 1000 = 95%
  assert.equal(result!.topSharePct, 95);
  assert.deepEqual(result!.topTickers, ["A", "B", "C"]);
});

test("concentración: sin posiciones valuadas devuelve null", () => {
  const positions = [pos({ valueArs: null })];
  assert.equal(computeConcentration(positions), null);
});

test("XIRR: caso conocido, invertís $1000 y un año después vale $1100 -> ~10%", () => {
  const transactions: Transaction[] = [tx({ date: "2025-01-01", side: "buy", quantity: 10, price: 100 })];
  const dividends: Dividend[] = [];
  const rate = computeXirr({ transactions, dividends, currentValueArs: 1100, ccl: null, asOfDate: "2026-01-01" });
  assert.ok(rate != null);
  assert.ok(Math.abs(rate! - 10) < 0.5, `esperaba ~10%, dio ${rate}`);
});

test("XIRR: sin transacciones ni dividendos devuelve null", () => {
  const rate = computeXirr({ transactions: [], dividends: [], currentValueArs: 1000, ccl: null });
  assert.equal(rate, null);
});

test("volatilidad: menos de 3 meses de historial devuelve null", () => {
  const snapshots = [snapshot("2026-01-05", 1000), snapshot("2026-01-20", 1050)];
  assert.equal(computeVolatility(snapshots), null);
});

test("volatilidad: retornos mensuales constantes -> desvío 0", () => {
  const snapshots = [
    snapshot("2026-01-31", 1000),
    snapshot("2026-02-28", 1100),
    snapshot("2026-03-31", 1210),
    snapshot("2026-04-30", 1331),
  ];
  const vol = computeVolatility(snapshots);
  assert.ok(vol != null);
  assert.ok(Math.abs(vol!) < 1e-9, `esperaba ~0, dio ${vol}`);
});

test("caída máxima: pico en el medio, valle después", () => {
  const snapshots = [
    snapshot("2026-01-01", 1000),
    snapshot("2026-01-02", 1200), // pico
    snapshot("2026-01-03", 900), // valle: (900-1200)/1200 = -25%
    snapshot("2026-01-04", 1100),
  ];
  const dd = computeMaxDrawdown(snapshots);
  assert.ok(dd != null);
  assert.ok(Math.abs(dd! - -25) < 1e-9, `esperaba -25, dio ${dd}`);
});

test("caída máxima: con un solo snapshot devuelve null", () => {
  assert.equal(computeMaxDrawdown([snapshot("2026-01-01", 1000)]), null);
});

test("retorno de período: ventana de 7 días toma el snapshot más cercano por debajo del corte", () => {
  const snapshots = [
    snapshot("2026-01-01", 1000),
    snapshot("2026-01-10", 1100),
    snapshot("2026-01-20", 1210),
  ];
  // último = 20/01 (1210); corte = 20/01 - 7d = 13/01 -> baseline = 10/01 (1100)
  const result = computePeriodReturn(snapshots, 7);
  assert.ok(result);
  assert.equal(result!.changeArs, 110);
  assert.ok(Math.abs(result!.changePct! - 10) < 1e-9);
  assert.equal(result!.baselineDate, "2026-01-10");
});

test("retorno de período: historial completo compara contra el primer snapshot", () => {
  const snapshots = [snapshot("2026-01-01", 1000), snapshot("2026-06-01", 1500)];
  const result = computePeriodReturn(snapshots, null);
  assert.ok(result);
  assert.equal(result!.changeArs, 500);
  assert.equal(result!.baselineDate, "2026-01-01");
});

test("retorno de período: con un solo snapshot devuelve null", () => {
  assert.equal(computePeriodReturn([snapshot("2026-01-01", 1000)], 7), null);
});

test("ganancia por semana: dos semanas consecutivas generan una barra", () => {
  const snapshots = [
    snapshot("2026-01-05", 1000), // lunes
    snapshot("2026-01-09", 1100), // viernes misma semana -> última de esa semana
    snapshot("2026-01-16", 1250), // viernes semana siguiente
  ];
  const weeks = computeWeeklyPnl(snapshots);
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].pnlArs, 150); // 1250 - 1100
});

test("ganancia por semana: con un solo snapshot no genera barras", () => {
  assert.deepEqual(computeWeeklyPnl([snapshot("2026-01-01", 1000)]), []);
});

test("HHI: cartera pareja de 4 posiciones cae en el límite de 'concentrado'", () => {
  const positions = [
    pos({ ticker: "A", valueArs: 250 }),
    pos({ ticker: "B", valueArs: 250 }),
    pos({ ticker: "C", valueArs: 250 }),
    pos({ ticker: "D", valueArs: 250 }),
  ];
  const result = computeHHI(positions);
  assert.ok(result);
  // 4 * 25^2 = 2500
  assert.equal(result!.hhi, 2500);
  assert.equal(result!.interpretation, "concentrado");
});

test("HHI: 10 posiciones parejas cae en 'diversificado'", () => {
  const positions = Array.from({ length: 10 }, (_, i) => pos({ ticker: `T${i}`, valueArs: 100 }));
  const result = computeHHI(positions);
  assert.ok(result);
  // 10 * 10^2 = 1000
  assert.equal(result!.hhi, 1000);
  assert.equal(result!.interpretation, "diversificado");
});

test("HHI: una sola posición da el máximo (10000, concentrado)", () => {
  const result = computeHHI([pos({ ticker: "A", valueArs: 100 })]);
  assert.ok(result);
  assert.equal(result!.hhi, 10000);
  assert.equal(result!.interpretation, "concentrado");
});

test("HHI: sin posiciones valuadas devuelve null", () => {
  assert.equal(computeHHI([pos({ valueArs: null })]), null);
});

test("concentración por broker: dos brokers con distinto peso", () => {
  const positions = [
    pos({ ticker: "A", broker: "cocos", valueArs: 700 }),
    pos({ ticker: "B", broker: "balanz", valueArs: 300 }),
  ];
  const result = computeConcentrationByDimension(positions, "broker");
  assert.deepEqual(result, [
    { key: "cocos", sharePct: 70 },
    { key: "balanz", sharePct: 30 },
  ]);
});

test("comisiones: suma fees de compras y ventas, % sobre el bruto comprado", () => {
  const transactions: Transaction[] = [
    tx({ side: "buy", quantity: 10, price: 100, fees: 50 }), // bruto comprado: 1000
    tx({ side: "sell", quantity: 5, price: 110, fees: 20 }),
  ];
  const result = computeFeesSummary(transactions, null);
  assert.ok(result);
  assert.equal(result!.totalArs, 70);
  assert.ok(Math.abs(result!.pctOfCostBasis! - 7) < 1e-9);
});

test("comisiones: sin transacciones devuelve null", () => {
  assert.equal(computeFeesSummary([], null), null);
});

test("benchmark: cartera +20% vs S&P 500 +10% en USD -> diferencia +10pp", () => {
  const snapshots = [
    snapshot("2026-01-01", 0, { total_value_usd: 1000, spy_usd: 500 }),
    snapshot("2026-02-01", 0, { total_value_usd: 1200, spy_usd: 550 }),
  ];
  const result = computeBenchmarkComparison(snapshots, null);
  assert.ok(result);
  assert.equal(result!.portfolioReturnPct, 20);
  assert.ok(Math.abs(result!.benchmarkReturnPct - 10) < 1e-9);
  assert.ok(Math.abs(result!.diffPp - 10) < 1e-9);
});

test("benchmark: sin spy_usd en algún extremo devuelve null", () => {
  const snapshots = [
    snapshot("2026-01-01", 0, { total_value_usd: 1000, spy_usd: null }),
    snapshot("2026-02-01", 0, { total_value_usd: 1200, spy_usd: 550 }),
  ];
  assert.equal(computeBenchmarkComparison(snapshots, null), null);
});

test("TWR: retorno parejo del 10% mensual sin aportes -> ~10% mensual anualizado", () => {
  const snapshots = [
    snapshot("2026-01-31", 1000, { total_cost_ars: 1000 }),
    snapshot("2026-02-28", 1100, { total_cost_ars: 1000 }),
    snapshot("2026-03-31", 1210, { total_cost_ars: 1000 }),
    snapshot("2026-04-30", 1331, { total_cost_ars: 1000 }),
  ];
  const twr = computeTwr(snapshots);
  assert.ok(twr != null);
  // (1.10^12 - 1) * 100 ≈ 213.8%
  assert.ok(Math.abs(twr! - 213.8) < 1, `esperaba ~213.8, dio ${twr}`);
});

test("TWR: un aporte grande en el tramo no infla el retorno (se neutraliza)", () => {
  const snapshots = [
    snapshot("2026-01-31", 1000, { total_cost_ars: 1000 }),
    // Aportaste 1000 más y el valor subió 10% real sobre el total: 1000*1.1 + 1000 = 2100
    snapshot("2026-02-28", 2100, { total_cost_ars: 2000 }),
    snapshot("2026-03-31", 2310, { total_cost_ars: 2000 }),
  ];
  const twr = computeTwr(snapshots);
  assert.ok(twr != null);
  assert.ok(Math.abs(twr! - 213.8) < 1, `esperaba ~213.8 (10% mensual neto de aportes), dio ${twr}`);
});

test("TWR: menos de 3 meses de historial devuelve null", () => {
  assert.equal(computeTwr([snapshot("2026-01-05", 1000), snapshot("2026-01-20", 1050)]), null);
});

test("dividendos: yield on cost y calendario con dos meses distintos", () => {
  const dividends: Dividend[] = [div({ date: "2026-01-15", amount: 50 }), div({ date: "2026-02-15", amount: 50 })];
  const result = computeDividendMetrics({
    dividends,
    totalCostArs: 1000,
    totalValueArs: 2000,
    ccl: null,
    asOfDate: "2026-03-01",
  });
  assert.ok(result);
  assert.equal(result!.income12mArs, 100);
  assert.equal(result!.yieldOnCostPct, 10);
  assert.equal(result!.currentYieldPct, 5);
  assert.deepEqual(result!.byMonth, [
    { month: "2026-01", amountArs: 50 },
    { month: "2026-02", amountArs: 50 },
  ]);
});

test("dividendos: sin dividendos devuelve null", () => {
  assert.equal(computeDividendMetrics({ dividends: [], totalCostArs: 1000, totalValueArs: 2000, ccl: null }), null);
});
