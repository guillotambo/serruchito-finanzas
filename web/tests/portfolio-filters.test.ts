import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_PORTFOLIO_FILTERS,
  describePortfolioFilters,
  filterCashByBroker,
  filterPositionsByBroker,
  hasActivePortfolioFilters,
  parseBrokerFilter,
  portfolioFilterNote,
  summarizeFilteredPortfolio,
} from "@serruchito/core";
import type { CashHolding, Position, PortfolioFilters } from "@serruchito/core";

function position(overrides: Partial<Position>): Position {
  return {
    ticker: "SPY",
    broker: "cocos",
    asset_type: "cedear",
    quantity: 10,
    avgCost: 100,
    costCurrency: "ARS",
    marketPrice: 110,
    priceStale: false,
    valueNative: 1100,
    costBasisNative: 1000,
    unrealizedPnlNative: 100,
    unrealizedPnlPct: 10,
    valueArs: 1100,
    valueUsd: null,
    costBasisArs: 1000,
    costBasisUsd: null,
    unrealizedPnlArs: 100,
    unrealizedPnlUsd: null,
    dayChangeNative: null,
    dayChangePct: null,
    dayChangeArs: null,
    ...overrides,
  };
}

function cash(overrides: Partial<CashHolding>): CashHolding {
  return {
    id: 1,
    label: "Banco",
    broker: null,
    amount: 500,
    currency: "ARS",
    notes: null,
    created_date: "2026-03-10",
    ...overrides,
  };
}

test("parseBrokerFilter solo acepta brokers válidos", () => {
  assert.equal(parseBrokerFilter("cocos"), "cocos");
  assert.equal(parseBrokerFilter("banco-frances"), "all");
  assert.equal(parseBrokerFilter(null), "all");
});

test("filterPositionsByBroker: 'all' no filtra", () => {
  const positions = [position({ broker: "cocos" }), position({ broker: "ibkr" })];
  assert.equal(filterPositionsByBroker(positions, "all").length, 2);
  assert.equal(filterPositionsByBroker(positions, "ibkr").length, 1);
});

test("filterCashByBroker: el saldo sin broker entra siempre", () => {
  const holdings = [cash({ broker: null }), cash({ broker: "cocos" }), cash({ broker: "ibkr" })];
  const filtered = filterCashByBroker(holdings, "cocos");
  assert.equal(filtered.length, 2);
  assert.ok(filtered.some((c) => c.broker == null));
  assert.ok(filtered.some((c) => c.broker === "cocos"));
});

test("summarizeFilteredPortfolio: sin CCL, los equivalentes en USD quedan null sin contaminar ARS", () => {
  const totals = summarizeFilteredPortfolio({
    positions: [position({ valueArs: 1100, costBasisNative: 1000, unrealizedPnlNative: 100 })],
    cashHoldings: [],
    ccl: null,
  });
  assert.equal(totals.totalValueArs, 1100);
  assert.equal(totals.totalUnrealizedPnlUsd, null);
  assert.equal(totals.totalCashUsd, null);
});

test("summarizeFilteredPortfolio: totalPnlPct es null cuando el costo total es 0", () => {
  const totals = summarizeFilteredPortfolio({
    positions: [position({ costBasisNative: 0, unrealizedPnlNative: 0 })],
    cashHoldings: [],
    ccl: 1000,
  });
  assert.equal(totals.totalPnlPct, null);
});

test("summarizeFilteredPortfolio: totalDayChangePct solo cuenta posiciones con dayChangeArs", () => {
  const totals = summarizeFilteredPortfolio({
    positions: [
      position({ valueArs: 1100, dayChangeArs: 100 }),
      position({ valueArs: 500, dayChangeArs: null }),
    ],
    cashHoldings: [],
    ccl: 1000,
  });
  // Solo la primera posición entra: previousValue = 1100 - 100 = 1000.
  assert.equal(totals.totalDayChangeArs, 100);
  assert.equal(totals.totalDayChangePct, 10);
});

test("describePortfolioFilters / hasActivePortfolioFilters: default sin chips", () => {
  assert.equal(hasActivePortfolioFilters(DEFAULT_PORTFOLIO_FILTERS), false);
  assert.deepEqual(describePortfolioFilters(DEFAULT_PORTFOLIO_FILTERS), []);
});

test("describePortfolioFilters: broker + efectivo activos dan 2 chips", () => {
  const filters: PortfolioFilters = { broker: "ibkr", includeCash: true };
  assert.equal(hasActivePortfolioFilters(filters), true);
  const chips = describePortfolioFilters(filters);
  assert.equal(chips.length, 2);
  assert.deepEqual(
    chips.map((c) => c.key),
    ["broker", "cash"]
  );
});

test("portfolioFilterNote: solo aparece con un broker filtrado", () => {
  assert.equal(portfolioFilterNote(DEFAULT_PORTFOLIO_FILTERS), null);
  assert.equal(portfolioFilterNote({ broker: "cocos", includeCash: false }), "histórico, todos los brokers");
});
