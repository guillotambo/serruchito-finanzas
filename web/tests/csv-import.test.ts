import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLocaleDate, parseLocaleNumber, parseTransactionsCsv } from "@serruchito/core";

test("parseLocaleNumber acepta formato argentino e inglés", () => {
  assert.equal(parseLocaleNumber("1.234,56"), 1234.56);
  assert.equal(parseLocaleNumber("1234,5"), 1234.5);
  assert.equal(parseLocaleNumber("1,234.56"), 1234.56);
  assert.equal(parseLocaleNumber("12.5"), 12.5);
  assert.equal(parseLocaleNumber("1.000"), 1000);
  assert.equal(parseLocaleNumber("0.125"), 0.125);
  assert.equal(parseLocaleNumber("1.234.567"), 1234567);
  assert.equal(parseLocaleNumber("$ 1.500,00"), 1500);
  assert.equal(parseLocaleNumber("US$ 10,5"), 10.5);
  assert.equal(parseLocaleNumber(""), null);
  assert.equal(parseLocaleNumber("abc"), null);
  assert.equal(parseLocaleNumber("1,2,3"), null);
});

test("parseLocaleDate acepta dd/mm/aaaa, dd-mm-aa e ISO y rechaza fechas imposibles", () => {
  assert.equal(parseLocaleDate("05/01/2026"), "2026-01-05");
  assert.equal(parseLocaleDate("5/1/26"), "2026-01-05");
  assert.equal(parseLocaleDate("2026-01-05"), "2026-01-05");
  assert.equal(parseLocaleDate("31/02/2026"), null);
  assert.equal(parseLocaleDate("01/05"), null);
});

test("parseTransactionsCsv lee la plantilla con ; y columnas opcionales vacías", () => {
  const csv = [
    "\uFEFFFecha;Broker;Operación;Ticker;Tipo;Cantidad;Precio;Moneda;Comisión;Notas",
    "05/01/2026;Cocos Capital;Compra;spy;CEDEAR;10;40.000,50;ARS;120,5;primera compra",
    "10/02/2026;IBKR;venta;AAPL;;2;190.25;;;",
    "",
  ].join("\r\n");
  const { rows, errors } = parseTransactionsCsv(csv);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    line: 2,
    date: "2026-01-05",
    broker: "cocos",
    side: "buy",
    ticker: "SPY",
    asset_type: "cedear",
    quantity: 10,
    price: 40000.5,
    currency: "ARS",
    fees: 120.5,
    notes: "primera compra",
  });
  assert.equal(rows[1].side, "sell");
  assert.equal(rows[1].asset_type, null);
  assert.equal(rows[1].currency, null);
  assert.equal(rows[1].price, 190.25);
});

test("parseTransactionsCsv acepta separador coma con campos entre comillas", () => {
  const csv = 'fecha,broker,operacion,ticker,cantidad,precio,notas\n2026-03-01,iol,c,GGAL,"1.000","3.500,75","nota, con coma"\n';
  const { rows, errors } = parseTransactionsCsv(csv);
  assert.deepEqual(errors, []);
  assert.equal(rows[0].broker, "iol");
  assert.equal(rows[0].quantity, 1000);
  assert.equal(rows[0].price, 3500.75);
  assert.equal(rows[0].notes, "nota, con coma");
});

test("parseTransactionsCsv informa errores por fila sin frenar el resto", () => {
  const csv = [
    "fecha;broker;operacion;ticker;cantidad;precio",
    "31/02/2026;Galicia;regalo;;0;-1",
    "01/03/2026;balanz;compra;AL30;100;80,5",
  ].join("\n");
  const { rows, errors } = parseTransactionsCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 2);
  assert.match(errors[0].message, /fecha inválida/);
  assert.match(errors[0].message, /broker desconocido/);
  assert.match(errors[0].message, /operación inválida/);
  assert.match(errors[0].message, /falta el ticker/);
  assert.match(errors[0].message, /cantidad inválida/);
  assert.match(errors[0].message, /precio inválido/);
});

test("parseTransactionsCsv avisa si faltan columnas obligatorias", () => {
  const { rows, errors } = parseTransactionsCsv("fecha;ticker\n01/01/2026;SPY");
  assert.equal(rows.length, 0);
  assert.equal(errors[0].line, 1);
  assert.match(errors[0].message, /broker, operacion, cantidad, precio/);
});
