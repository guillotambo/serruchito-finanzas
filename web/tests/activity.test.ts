import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALL_ACTIVITY_FILTERS,
  buildActivityFeed,
  describeActivityFilters,
  filterActivity,
  formatActivityDay,
  hasActiveActivityFilters,
  isoDaysAgo,
  resolveActivityRange,
  summarizeActivity,
} from "@serruchito/core";
import type { ActivityFilters, CashHolding, Dividend, Transaction } from "@serruchito/core";

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    date: "2026-03-10",
    broker: "cocos",
    ticker: "SPY",
    asset_type: "cedear",
    side: "buy",
    quantity: 10,
    price: 100,
    currency: "ARS",
    fees: 0,
    notes: null,
    ...overrides,
  };
}

function div(overrides: Partial<Dividend>): Dividend {
  return {
    id: 1,
    date: "2026-03-10",
    broker: "cocos",
    ticker: "SPY",
    amount: 500,
    currency: "ARS",
    notes: null,
    ...overrides,
  };
}

function cash(overrides: Partial<CashHolding>): CashHolding {
  return {
    id: 1,
    label: "Efectivo Cocos",
    broker: "cocos",
    amount: 1000,
    currency: "ARS",
    notes: null,
    created_date: "2026-03-10",
    ...overrides,
  };
}

function feed(params: {
  transactions?: Transaction[];
  dividends?: Dividend[];
  cashHoldings?: CashHolding[];
}) {
  return buildActivityFeed({
    transactions: params.transactions ?? [],
    dividends: params.dividends ?? [],
    cashHoldings: params.cashHoldings ?? [],
  });
}

function filters(overrides: Partial<ActivityFilters>): ActivityFilters {
  return { ...ALL_ACTIVITY_FILTERS, ...overrides };
}

test("buildActivityFeed mezcla las tres fuentes ordenadas por fecha descendente", () => {
  const events = feed({
    transactions: [tx({ id: 1, date: "2026-01-05" })],
    dividends: [div({ id: 1, date: "2026-03-01" })],
    cashHoldings: [cash({ id: 1, created_date: "2026-02-10" })],
  });

  assert.deepEqual(
    events.map((e) => e.date),
    ["2026-03-01", "2026-02-10", "2026-01-05"]
  );
  assert.deepEqual(
    events.map((e) => e.kind),
    ["dividend", "cash", "buy"]
  );
});

test("buildActivityFeed desempata el mismo día por tipo y después por id descendente", () => {
  const events = feed({
    transactions: [
      tx({ id: 1, side: "sell", ticker: "AAPL" }),
      tx({ id: 7, side: "buy", ticker: "MSFT" }),
      tx({ id: 9, side: "buy", ticker: "GOOG" }),
    ],
    dividends: [div({ id: 3 })],
    cashHoldings: [cash({ id: 2 })],
  });

  assert.deepEqual(
    events.map((e) => e.key),
    ["buy-9", "buy-7", "sell-1", "dividend-3", "cash-2"]
  );
});

test("buildActivityFeed calcula el monto neto de cada movimiento", () => {
  const [buy, sell] = feed({
    transactions: [
      tx({ id: 2, side: "buy", quantity: 10, price: 100, fees: 50 }),
      tx({ id: 1, side: "sell", quantity: 10, price: 100, fees: 50 }),
    ],
  });

  // La compra suma las comisiones (lo que pagaste), la venta las resta (lo
  // que te quedó); ambas se guardan sin signo.
  assert.equal(buy.amount, 1050);
  assert.equal(sell.amount, 950);
});

test("buildActivityFeed expone las notas y el label del saldo como título", () => {
  const events = feed({
    transactions: [tx({ id: 1, notes: "compré en la baja" })],
    cashHoldings: [cash({ id: 1, label: "Banco Galicia", notes: "sueldo" })],
  });

  assert.equal(events.find((e) => e.kind === "buy")?.notes, "compré en la baja");
  assert.equal(events.find((e) => e.kind === "cash")?.title, "Banco Galicia");
  assert.equal(events.find((e) => e.kind === "cash")?.notes, "sueldo");
});

test("filterActivity separa compras de ventas", () => {
  const events = feed({
    transactions: [tx({ id: 1, side: "buy" }), tx({ id: 2, side: "sell" })],
    dividends: [div({ id: 1 })],
  });

  assert.deepEqual(
    filterActivity(events, filters({ kinds: ["buy"] })).map((e) => e.key),
    ["buy-1"]
  );
  assert.deepEqual(
    filterActivity(events, filters({ kinds: ["sell"] })).map((e) => e.key),
    ["sell-2"]
  );
  assert.deepEqual(
    filterActivity(events, filters({ kinds: ["buy", "dividend"] })).map((e) => e.key),
    ["buy-1", "dividend-1"]
  );
});

test("filterActivity toma el rango de fechas inclusive en los dos extremos", () => {
  const events = feed({
    transactions: [
      tx({ id: 1, date: "2026-01-31" }),
      tx({ id: 2, date: "2026-02-01" }),
      tx({ id: 3, date: "2026-02-28" }),
      tx({ id: 4, date: "2026-03-01" }),
    ],
  });

  const inRange = filterActivity(events, filters({ from: "2026-02-01", to: "2026-02-28" }));
  assert.deepEqual(
    inRange.map((e) => e.date),
    ["2026-02-28", "2026-02-01"]
  );
});

test("filterActivity deja afuera el efectivo sin broker al filtrar por un broker", () => {
  const events = feed({
    transactions: [tx({ id: 1, broker: "cocos" }), tx({ id: 2, broker: "ibkr" })],
    cashHoldings: [cash({ id: 1, broker: null, label: "Banco" }), cash({ id: 2, broker: "cocos" })],
  });

  assert.equal(filterActivity(events, filters({ broker: "all" })).length, 4);
  assert.deepEqual(
    filterActivity(events, filters({ broker: "cocos" })).map((e) => e.key),
    ["buy-1", "cash-2"]
  );
});

test("filterActivity busca por ticker y por nota, sin distinguir mayúsculas", () => {
  const events = feed({
    transactions: [
      tx({ id: 1, ticker: "AAPL", notes: null }),
      tx({ id: 2, ticker: "MSFT", notes: "Rebalanceo anual" }),
    ],
  });

  assert.deepEqual(
    filterActivity(events, filters({ query: "aapl" })).map((e) => e.key),
    ["buy-1"]
  );
  assert.deepEqual(
    filterActivity(events, filters({ query: "REBALANCEO" })).map((e) => e.key),
    ["buy-2"]
  );
  assert.equal(filterActivity(events, filters({ query: "   " })).length, 2);
  assert.equal(filterActivity(events, filters({ query: "nada" })).length, 0);
});

test("filterActivity filtra por moneda", () => {
  const events = feed({
    transactions: [tx({ id: 1, currency: "ARS" }), tx({ id: 2, currency: "USD" })],
  });

  assert.deepEqual(
    filterActivity(events, filters({ currency: "USD" })).map((e) => e.key),
    ["buy-2"]
  );
});

test("hasActiveActivityFilters ignora una búsqueda en blanco", () => {
  assert.equal(hasActiveActivityFilters(ALL_ACTIVITY_FILTERS), false);
  assert.equal(hasActiveActivityFilters(filters({ query: "   " })), false);
  assert.equal(hasActiveActivityFilters(filters({ query: "spy" })), true);
  assert.equal(hasActiveActivityFilters(filters({ broker: "ibkr" })), true);
  assert.equal(hasActiveActivityFilters(filters({ from: "2026-01-01" })), true);
});

test("describeActivityFilters devuelve un chip por filtro activo, y ninguno por la búsqueda", () => {
  assert.deepEqual(describeActivityFilters(ALL_ACTIVITY_FILTERS), []);
  // El buscador está siempre visible: mostrar un chip con lo que el usuario
  // ya tiene escrito adelante es ruido.
  assert.deepEqual(describeActivityFilters(filters({ query: "spy" })), []);

  assert.deepEqual(describeActivityFilters(filters({ kinds: ["sell"], broker: "balanz", currency: "USD" })), [
    { key: "kind", label: "Venta" },
    { key: "broker", label: "Balanz" },
    { key: "currency", label: "USD" },
  ]);
});

test("describeActivityFilters arma el chip de rango según qué extremos haya", () => {
  const [both] = describeActivityFilters(filters({ from: "2026-03-01", to: "2026-03-31" }));
  assert.equal(both.key, "range");
  assert.equal(both.label, "01/03/2026 – 31/03/2026");

  assert.match(describeActivityFilters(filters({ from: "2026-03-01" }))[0].label, /^desde /);
  assert.match(describeActivityFilters(filters({ to: "2026-03-31" }))[0].label, /^hasta /);
});

test("summarizeActivity separa invertido, vendido y dividendos, y no cuenta el efectivo como flujo", () => {
  const events = feed({
    transactions: [
      tx({ id: 1, side: "buy", quantity: 10, price: 100, fees: 0 }),
      tx({ id: 2, side: "sell", quantity: 5, price: 200, fees: 0 }),
    ],
    dividends: [div({ id: 1, amount: 300 })],
    cashHoldings: [cash({ id: 1, amount: 99999 })],
  });

  const summary = summarizeActivity(events, 1000);
  assert.equal(summary.count, 4);
  assert.deepEqual(summary.byKind, { buy: 1, sell: 1, dividend: 1, cash: 1 });
  assert.equal(summary.investedArs, 1000);
  assert.equal(summary.soldArs, 1000);
  assert.equal(summary.dividendsArs, 300);
  // El saldo de efectivo no aparece en ningún total de flujo.
  assert.equal(summary.investedUsd, 1);
});

test("summarizeActivity sin CCL deja los totales en la otra moneda en null, no en 0", () => {
  const events = feed({ transactions: [tx({ id: 1, side: "buy", quantity: 1, price: 500, currency: "ARS" })] });

  const summary = summarizeActivity(events, null);
  assert.equal(summary.investedArs, 500);
  assert.equal(summary.investedUsd, null);
  // Sin eventos de ese tipo el total queda en 0, no en null: no falta ninguna
  // conversión, simplemente no hubo ventas.
  assert.equal(summary.soldArs, 0);
});

test("isoDaysAgo y resolveActivityRange no dependen de la zona horaria local", () => {
  assert.equal(isoDaysAgo("2026-03-01", 1), "2026-02-28");
  assert.equal(isoDaysAgo("2026-01-01", 1), "2025-12-31");
  assert.equal(isoDaysAgo("2026-03-31", 30), "2026-03-01");

  assert.deepEqual(resolveActivityRange("30d", "2026-03-31"), { from: "2026-03-01", to: null });
  assert.deepEqual(resolveActivityRange("year", "2026-03-31"), { from: "2026-01-01", to: null });
  assert.deepEqual(resolveActivityRange("all", "2026-03-31"), { from: null, to: null });
  assert.deepEqual(resolveActivityRange("custom", "2026-03-31"), { from: null, to: null });
});

test("formatActivityDay usa Hoy/Ayer y no se corre un día por zona horaria", () => {
  assert.equal(formatActivityDay("2026-03-31", "2026-03-31"), "Hoy");
  assert.equal(formatActivityDay("2026-03-30", "2026-03-31"), "Ayer");
  assert.match(formatActivityDay("2026-03-12", "2026-03-31"), /^12 /);
});
