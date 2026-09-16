import type { AssetType, Broker, Currency, Side } from "./types";

// Importación de movimientos desde una planilla (CSV exportado de Excel o
// Google Sheets). Pensado para alguien que carga a mano en una planilla:
// acepta `;` o `,` como separador (Excel en español exporta con `;`), coma
// decimal, fechas dd/mm/aaaa y nombres "humanos" de broker/operación/tipo.
// Ver web/public/plantilla-movimientos.csv.

export type ImportedTransaction = {
  line: number; // número de fila en la planilla (1 = encabezado)
  date: string; // ISO YYYY-MM-DD
  broker: Broker;
  side: Side;
  ticker: string;
  // null = no vino en la planilla -> el server lo completa desde el catálogo
  // de instrumentos (igual que el formulario al salir del campo ticker).
  asset_type: AssetType | null;
  quantity: number;
  price: number;
  // null = no vino -> se deduce del tipo de activo (ver nativeCurrency).
  currency: Currency | null;
  fees: number;
  notes: string | null;
};

export type ImportError = { line: number; message: string };

export type ImportParseResult = { rows: ImportedTransaction[]; errors: ImportError[] };

// Fila ya resuelta por el server (tipo y moneda completos) y respuesta de
// POST /api/transactions/import.
export type ResolvedImportRow = Omit<ImportedTransaction, "asset_type" | "currency"> & {
  asset_type: AssetType;
  currency: Currency;
};

export type ImportResponse = { rows: ResolvedImportRow[]; errors: ImportError[]; inserted: number };

type Column = "fecha" | "broker" | "operacion" | "ticker" | "tipo" | "cantidad" | "precio" | "moneda" | "comision" | "notas";

const REQUIRED_COLUMNS: Column[] = ["fecha", "broker", "operacion", "ticker", "cantidad", "precio"];

const COLUMN_ALIASES: Record<string, Column> = {
  fecha: "fecha",
  date: "fecha",
  broker: "broker",
  operacion: "operacion",
  tipo_operacion: "operacion",
  side: "operacion",
  ticker: "ticker",
  especie: "ticker",
  simbolo: "ticker",
  tipo: "tipo",
  tipo_activo: "tipo",
  asset_type: "tipo",
  cantidad: "cantidad",
  quantity: "cantidad",
  precio: "precio",
  price: "precio",
  moneda: "moneda",
  currency: "moneda",
  comision: "comision",
  comisiones: "comision",
  fees: "comision",
  notas: "notas",
  nota: "notas",
  notes: "notas",
};

const BROKER_ALIASES: Record<string, Broker> = {
  cocos: "cocos",
  cocoscapital: "cocos",
  balanz: "balanz",
  ibkr: "ibkr",
  interactivebrokers: "ibkr",
  interactive: "ibkr",
  iol: "iol",
  invertironline: "iol",
};

const SIDE_ALIASES: Record<string, Side> = {
  compra: "buy",
  c: "buy",
  buy: "buy",
  venta: "sell",
  v: "sell",
  sell: "sell",
};

const ASSET_TYPE_ALIASES: Record<string, AssetType> = {
  cedear: "cedear",
  accionar: "accion_arg",
  accionarg: "accion_arg",
  accionargentina: "accion_arg",
  accion: "accion_arg",
  stockus: "stock_us",
  accionus: "stock_us",
  accionusa: "stock_us",
  etf: "etf",
  bono: "bono",
  otro: "otro",
};

const CURRENCY_ALIASES: Record<string, Currency> = {
  ars: "ARS",
  pesos: "ARS",
  peso: "ARS",
  usd: "USD",
  dolares: "USD",
  dolar: "USD",
  us: "USD",
};

/** minúsculas, sin acentos ni espacios/guiones/puntos: "Cocos Capital" -> "cocoscapital". */
function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s\-_.$()]/g, "");
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
}

function detectSeparator(headerLine: string): string {
  const counts = [";", ",", "\t"].map((sep) => ({ sep, n: headerLine.split(sep).length }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].sep;
}

/** Parte el texto en filas/celdas respetando comillas dobles ("a;b" y "" escapado). */
function splitRows(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * Número en formato argentino o inglés: "1.234,56", "1234,56", "1234.56",
 * "$ 1.500". Si aparecen punto y coma, el último es el decimal. Con solo
 * comas, la coma es decimal. Con solo puntos: varios son separadores de
 * miles ("1.234.567"), y uno solo también si lo siguen exactamente 3 dígitos
 * ("1.000", como se escribe en Argentina); si no, es decimal ("12.5").
 */
export function parseLocaleNumber(raw: string): number | null {
  let s = raw.replace(/[\s$]/g, "").replace(/^US/i, "");
  if (s === "") return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    if (s.indexOf(",") !== lastComma) return null;
    s = s.replace(",", ".");
  } else if (lastDot >= 0 && (s.indexOf(".") !== lastDot || /^-?[1-9]\d{0,2}\.\d{3}$/.test(s))) {
    s = s.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** "31/12/2025", "31-12-25", "2025-12-31" -> "2025-12-31"; null si no es una fecha válida. */
export function parseLocaleDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

export function parseTransactionsCsv(text: string): ImportParseResult {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const table = splitRows(clean, detectSeparator(firstLine));
  const errors: ImportError[] = [];
  const rows: ImportedTransaction[] = [];

  const header = (table[0] ?? []).map((h) => COLUMN_ALIASES[normalizeHeader(h)]);
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return {
      rows,
      errors: [{ line: 1, message: `Faltan columnas en el encabezado: ${missing.join(", ")}. Usá la plantilla.` }],
    };
  }

  for (let i = 1; i < table.length; i++) {
    const line = i + 1;
    const cells = table[i];
    if (cells.every((c) => c.trim() === "")) continue;

    const get = (col: Column): string => {
      const idx = header.indexOf(col);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };
    const problems: string[] = [];

    const date = parseLocaleDate(get("fecha"));
    if (!date) problems.push(`fecha inválida "${get("fecha")}" (usá dd/mm/aaaa)`);

    const broker = BROKER_ALIASES[normalizeKey(get("broker"))];
    if (!broker) problems.push(`broker desconocido "${get("broker")}" (cocos, balanz, ibkr o iol)`);

    const side = SIDE_ALIASES[normalizeKey(get("operacion"))];
    if (!side) problems.push(`operación inválida "${get("operacion")}" (compra o venta)`);

    const ticker = get("ticker").toUpperCase().replace(/\s+/g, "");
    if (!ticker) problems.push("falta el ticker");

    let assetType: AssetType | null = null;
    if (get("tipo")) {
      assetType = ASSET_TYPE_ALIASES[normalizeKey(get("tipo"))] ?? null;
      if (!assetType) problems.push(`tipo de activo desconocido "${get("tipo")}"`);
    }

    const quantity = parseLocaleNumber(get("cantidad"));
    if (quantity == null || quantity <= 0) problems.push(`cantidad inválida "${get("cantidad")}"`);

    const price = parseLocaleNumber(get("precio"));
    if (price == null || price < 0) problems.push(`precio inválido "${get("precio")}"`);

    let currency: Currency | null = null;
    if (get("moneda")) {
      currency = CURRENCY_ALIASES[normalizeKey(get("moneda"))] ?? null;
      if (!currency) problems.push(`moneda inválida "${get("moneda")}" (ARS o USD)`);
    }

    let fees = 0;
    if (get("comision")) {
      const parsed = parseLocaleNumber(get("comision"));
      if (parsed == null || parsed < 0) problems.push(`comisión inválida "${get("comision")}"`);
      else fees = parsed;
    }

    if (problems.length > 0) {
      errors.push({ line, message: problems.join("; ") });
      continue;
    }

    rows.push({
      line,
      date: date!,
      broker,
      side,
      ticker,
      asset_type: assetType,
      quantity: quantity!,
      price: price!,
      currency,
      fees,
      notes: get("notas") || null,
    });
  }

  return { rows, errors };
}
