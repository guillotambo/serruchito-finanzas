import assert from "node:assert/strict";
import { test } from "node:test";
import {
  consolidatePosition,
  normalizeYahooChart,
  rangeStartDate,
  resampleSeries,
  seriesChange,
  stripSettlementSuffixes,
} from "@serruchito/core";
import type { Position } from "@serruchito/core";

function pos(overrides: Partial<Position>): Position {
  return {
    ticker: "MSFT",
    broker: "cocos",
    asset_type: "cedear",
    quantity: 10,
    avgCost: 100,
    costCurrency: "ARS",
    marketPrice: 120,
    priceStale: false,
    valueNative: 1200,
    costBasisNative: 1000,
    unrealizedPnlNative: 200,
    unrealizedPnlPct: 20,
    valueArs: 1200,
    valueUsd: 1.2,
    costBasisArs: 1000,
    costBasisUsd: 1,
    unrealizedPnlArs: 200,
    unrealizedPnlUsd: 0.2,
    dayChangeNative: null,
    dayChangePct: null,
    dayChangeArs: null,
    ...overrides,
  };
}

test("stripSettlementSuffixes: colapsa especies C/D cuando el base existe en el mismo panel", () => {
  const result = stripSettlementSuffixes(["AAPL", "AAPLC", "AAPLD", "MSFT"]);
  assert.deepEqual(result, ["AAPL", "MSFT"]);
});

test("stripSettlementSuffixes: no toca un ticker terminado en D si su base no está en el panel", () => {
  const result = stripSettlementSuffixes(["YPFD", "GGAL"]);
  assert.deepEqual(result, ["YPFD", "GGAL"]);
});

test("resampleSeries: conserva primer y último punto y no supera maxPoints", () => {
  const points = Array.from({ length: 100 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, "0")}`, close: i }));
  const resampled = resampleSeries(points, 10);
  assert.ok(resampled.length <= 10);
  assert.equal(resampled[0].date, points[0].date);
  assert.equal(resampled[resampled.length - 1].date, points[points.length - 1].date);
});

test("resampleSeries: no toca la serie si ya es más corta que maxPoints", () => {
  const points = [
    { date: "2026-01-01", close: 1 },
    { date: "2026-01-02", close: 2 },
  ];
  assert.deepEqual(resampleSeries(points, 10), points);
});

test("seriesChange: serie de un solo punto -> null (no hay variación que calcular)", () => {
  const result = seriesChange([{ date: "2026-01-01", close: 100 }]);
  assert.equal(result.absolute, null);
  assert.equal(result.pct, null);
});

test("seriesChange: variación punta a punta entre el primer y el último cierre", () => {
  const result = seriesChange([
    { date: "2026-01-01", close: 100 },
    { date: "2026-01-02", close: 90 },
    { date: "2026-01-03", close: 110 },
  ]);
  assert.equal(result.absolute, 10);
  assert.equal(result.pct, 10);
});

test("consolidatePosition: suma cantidades y pondera el PPC entre dos brokers del mismo ticker", () => {
  const positions: Position[] = [
    pos({ broker: "cocos", quantity: 10, avgCost: 100, costBasisNative: 1000, valueArs: 1200, valueUsd: 1.2 }),
    pos({ broker: "balanz", quantity: 5, avgCost: 200, costBasisNative: 1000, valueArs: 600, valueUsd: 0.6 }),
  ];
  const consolidated = consolidatePosition(positions, "MSFT", "cedear");
  assert.ok(consolidated);
  assert.equal(consolidated!.quantity, 15);
  assert.equal(consolidated!.costBasisNative, 2000);
  assert.equal(consolidated!.avgCost, 2000 / 15);
  assert.deepEqual(consolidated!.brokers.sort(), ["balanz", "cocos"]);
  assert.equal(consolidated!.valueArs, 1800);
});

test("consolidatePosition: ignora posiciones cerradas (quantity 0) y devuelve null si no hay ninguna abierta", () => {
  const positions: Position[] = [pos({ quantity: 0, valueNative: null, costBasisNative: 0 })];
  assert.equal(consolidatePosition(positions, "MSFT", "cedear"), null);
});

test("consolidatePosition: no confunde el mismo ticker en otro asset_type", () => {
  const positions: Position[] = [pos({ ticker: "AAPL", asset_type: "cedear" })];
  assert.equal(consolidatePosition(positions, "AAPL", "stock_us"), null);
});

test("normalizeYahooChart: descarta huecos (close: null) y ordena por fecha", () => {
  const json = {
    chart: {
      result: [
        {
          timestamp: [1735689600, 1735776000, 1735862400], // 2025-01-01, 02, 03 UTC
          indicators: { quote: [{ close: [100, null, 105] }] },
        },
      ],
    },
  };
  const points = normalizeYahooChart(json);
  assert.equal(points.length, 2);
  assert.equal(points[0].close, 100);
  assert.equal(points[1].close, 105);
  assert.ok(points[0].date < points[1].date);
});

test("normalizeYahooChart: respuesta vacía o malformada -> []", () => {
  assert.deepEqual(normalizeYahooChart({}), []);
  assert.deepEqual(normalizeYahooChart(null), []);
});

test("rangeStartDate: 1w resta 7 días a la fecha de referencia", () => {
  assert.equal(rangeStartDate("1w", new Date("2026-03-05T00:00:00Z")), "2026-02-26");
});
