import type { AssetType, Currency, Position } from "./types";

/**
 * Lógica pura de mercado: normalización de series históricas (data912 /
 * Yahoo), sparkline y consolidación de posiciones por ticker. Sin DB ni red
 * -> ver web/lib/history.ts y web/lib/watchlist.ts para el fetch/cache.
 */

// Barra diaria cruda de data912 (/historical/{cedears|stocks|bonds}/{ticker}).
export type HistoricalBar = {
  date: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  dr?: number;
  sa?: number;
};

export type SeriesPoint = { date: string; close: number };

export type HistoryRange = "1w" | "1m" | "3m" | "6m" | "1y" | "5y" | "max";

export const HISTORY_RANGES: { id: HistoryRange; label: string }[] = [
  { id: "1w", label: "1S" },
  { id: "1m", label: "1M" },
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1A" },
  { id: "5y", label: "5A" },
  { id: "max", label: "Todo" },
];

// Moneda en la que cotiza nativamente cada tipo de activo: es la que se usa
// para el precio de la lista y como serie por defecto del detalle.
export function nativeCurrency(assetType: AssetType): Currency {
  return assetType === "stock_us" || assetType === "etf" ? "USD" : "ARS";
}

// Fecha ISO de corte para un rango relativo a `today` (por defecto, hoy);
// null para "max" (sin corte).
export function rangeStartDate(range: HistoryRange, today: Date = new Date()): string | null {
  if (range === "max") return null;
  const from = new Date(today);
  switch (range) {
    case "1w":
      from.setDate(from.getDate() - 7);
      break;
    case "1m":
      from.setMonth(from.getMonth() - 1);
      break;
    case "3m":
      from.setMonth(from.getMonth() - 3);
      break;
    case "6m":
      from.setMonth(from.getMonth() - 6);
      break;
    case "1y":
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "5y":
      from.setFullYear(from.getFullYear() - 5);
      break;
  }
  return from.toISOString().slice(0, 10);
}

export function filterSeriesByRange(points: SeriesPoint[], range: HistoryRange, today: Date = new Date()): SeriesPoint[] {
  const from = rangeStartDate(range, today);
  if (from == null) return points;
  return points.filter((p) => p.date >= from);
}

// Descarta valores no numéricos/no positivos, ordena asc por fecha y
// deduplica por fecha (la última entrada gana, por si la fuente repite el día).
function sanitizeAndSort<T extends { date: string }>(rows: T[], getClose: (r: T) => unknown): T[] {
  const byDate = new Map<string, T>();
  for (const row of rows) {
    const close = getClose(row);
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) continue;
    if (typeof row.date !== "string" || row.date.length < 8) continue;
    byDate.set(row.date, row);
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Normaliza la respuesta de data912 (/historical/{cedears|stocks|bonds}) a
// puntos {date, close}, para el sparkline y el chart en ARS.
export function normalizeData912Bars(raw: unknown): SeriesPoint[] {
  if (!Array.isArray(raw)) return [];
  const rows = raw
    .filter((r): r is { date: unknown; c: unknown } => typeof r === "object" && r !== null)
    .map((r) => ({ date: String((r as Record<string, unknown>).date ?? ""), close: (r as Record<string, unknown>).c }));
  return sanitizeAndSort(rows, (r) => r.close).map((r) => ({ date: r.date, close: r.close as number }));
}

// Igual que normalizeData912Bars pero conservando OHLCV completo, para
// persistir en price_history (ver web/lib/history.ts).
type RawHistoricalBarRow = { date: string } & Record<string, unknown>;

export function normalizeHistoricalBars(raw: unknown): HistoricalBar[] {
  if (!Array.isArray(raw)) return [];
  const rows = raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null && "date" in r && "c" in r)
    .map((r) => ({ ...r, date: String(r.date) })) as RawHistoricalBarRow[];
  return sanitizeAndSort(rows, (r) => r.c).map((r) => ({
    date: String(r.date),
    o: typeof r.o === "number" ? r.o : (r.c as number),
    h: typeof r.h === "number" ? r.h : (r.c as number),
    l: typeof r.l === "number" ? r.l : (r.c as number),
    c: r.c as number,
    v: typeof r.v === "number" ? r.v : 0,
    dr: typeof r.dr === "number" ? r.dr : undefined,
    sa: typeof r.sa === "number" ? r.sa : undefined,
  }));
}

// Normaliza chart.result[0] de Yahoo (timestamp[] + indicators.quote[0].close[])
// a puntos {date, close}. Los huecos (close: null, típico de días sin sesión
// dentro del array) se descartan, no se rellenan acá.
export function normalizeYahooChart(json: unknown): SeriesPoint[] {
  const result = (json as { chart?: { result?: unknown[] } } | null)?.chart?.result?.[0] as
    | { timestamp?: unknown[]; indicators?: { quote?: Array<{ close?: unknown[] }> } }
    | undefined;
  const timestamps = result?.timestamp;
  const closes = result?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return [];

  const rows: { date: string; close: unknown }[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    if (typeof ts !== "number") continue;
    const date = new Date(ts * 1000).toISOString().slice(0, 10);
    rows.push({ date, close: closes[i] });
  }
  return sanitizeAndSort(rows, (r) => r.close).map((r) => ({ date: r.date, close: r.close as number }));
}

// Bucketiza y toma el último punto de cada bucket, conservando siempre el
// primer y el último punto de la serie (el último es el dato más reciente).
// No mandar series de miles de puntos al cliente sin pasar por acá.
export function resampleSeries(points: SeriesPoint[], maxPoints: number): SeriesPoint[] {
  if (maxPoints <= 0 || points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const result: SeriesPoint[] = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    const idx = Math.min(points.length - 1, Math.floor(i * step));
    result.push(points[idx]);
  }
  result.push(points[points.length - 1]);
  // El bucketizado puede repetir el primer índice varias veces si maxPoints
  // es chico; deduplicar preservando orden.
  const seen = new Set<string>();
  return result.filter((p) => {
    if (seen.has(p.date)) return false;
    seen.add(p.date);
    return true;
  });
}

// Variación punta a punta de la serie visible (primer vs. último cierre).
export function seriesChange(points: SeriesPoint[]): { absolute: number | null; pct: number | null } {
  if (points.length < 2) return { absolute: null, pct: null };
  const first = points[0].close;
  const last = points[points.length - 1].close;
  const absolute = last - first;
  const pct = first > 0 ? (absolute / first) * 100 : null;
  return { absolute, pct };
}

export function toSparkline(points: SeriesPoint[], maxPoints = 30): number[] {
  return resampleSeries(points, maxPoints).map((p) => p.close);
}

// Path SVG normalizado a una caja (width x height), con padding vertical
// para que la línea no toque los bordes. Compartido por web (<path>) y
// mobile (react-native-svg <Path>): misma geometría, sin librería de charts.
export function sparklinePath(values: number[], width: number, height: number, padding = 2): string {
  if (values.length === 0) return "";
  if (values.length === 1) {
    const y = height / 2;
    return `M0,${y} L${width},${y}`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const usableHeight = height - padding * 2;
  const toY = (v: number) => (range === 0 ? height / 2 : padding + usableHeight * (1 - (v - min) / range));
  const step = width / (values.length - 1);

  return values.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${toY(v).toFixed(2)}`).join(" ");
}

export type ConsolidatedPosition = {
  ticker: string;
  asset_type: AssetType;
  quantity: number;
  avgCost: number;
  costCurrency: Currency;
  marketPrice: number | null;
  valueNative: number | null;
  costBasisNative: number;
  unrealizedPnlNative: number | null;
  unrealizedPnlPct: number | null;
  valueArs: number | null;
  valueUsd: number | null;
  unrealizedPnlArs: number | null;
  unrealizedPnlUsd: number | null;
  brokers: string[];
};

// Consolida las posiciones de un mismo (ticker, asset_type) a través de
// brokers, para el bloque "Tu posición" del detalle de un instrumento. PPC
// ponderado por cantidad -> mismo criterio que buildPortfolioSummary.
export function consolidatePosition(
  positions: Position[],
  ticker: string,
  assetType: AssetType
): ConsolidatedPosition | null {
  const matches = positions.filter((p) => p.ticker === ticker && p.asset_type === assetType && p.quantity > 0);
  if (matches.length === 0) return null;

  const quantity = matches.reduce((sum, p) => sum + p.quantity, 0);
  const costBasisNative = matches.reduce((sum, p) => sum + p.costBasisNative, 0);
  const avgCost = quantity > 0 ? costBasisNative / quantity : 0;
  // Todas las posiciones de un mismo (ticker, asset_type) comparten moneda
  // nativa (viene del asset_type), así que tomar la del primer match alcanza.
  const costCurrency = matches[0].costCurrency;
  const marketPrice = matches.find((p) => p.marketPrice != null)?.marketPrice ?? null;

  const valueNative = marketPrice != null ? quantity * marketPrice : null;
  const unrealizedPnlNative = valueNative != null ? valueNative - costBasisNative : null;
  const unrealizedPnlPct = valueNative != null && costBasisNative > 0 ? (unrealizedPnlNative! / costBasisNative) * 100 : null;

  const sumIfAny = (pick: (p: Position) => number | null): number | null => {
    const vals = matches.map(pick).filter((v): v is number => v != null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
  };

  return {
    ticker,
    asset_type: assetType,
    quantity,
    avgCost,
    costCurrency,
    marketPrice,
    valueNative,
    costBasisNative,
    unrealizedPnlNative,
    unrealizedPnlPct,
    valueArs: sumIfAny((p) => p.valueArs),
    valueUsd: sumIfAny((p) => p.valueUsd),
    unrealizedPnlArs: sumIfAny((p) => p.unrealizedPnlArs),
    unrealizedPnlUsd: sumIfAny((p) => p.unrealizedPnlUsd),
    brokers: Array.from(new Set(matches.map((p) => p.broker))),
  };
}

// Colapsa las especies C y D de los paneles live de data912 (AAPL / AAPLC /
// AAPLD son el mismo activo en distinta liquidación) a su símbolo base. Solo
// descarta el sufijo cuando el símbolo base existe en el mismo panel, para no
// perder tickers legítimos que terminan en C o D (ej. no hay "AAP" en el panel
// -> "AAP" no se toca aunque exista un ticker "AAPD" real en otro contexto).
export function stripSettlementSuffixes(symbols: string[]): string[] {
  const set = new Set(symbols);
  const result: string[] = [];
  for (const symbol of symbols) {
    const isSuffixed = (symbol.endsWith("C") || symbol.endsWith("D")) && symbol.length > 1;
    const base = symbol.slice(0, -1);
    if (isSuffixed && set.has(base)) continue; // el base existe: este es el duplicado de liquidación
    result.push(symbol);
  }
  return result;
}

// gifted-charts no soporta valores `null` en la serie -> se arrastra el
// último valor conocido (equivalente visual a `connectNulls` de recharts).
// Compartida entre PortfolioHistoryChart e InstrumentPriceChart (mobile).
export function fillForwardNulls(values: (number | null)[]): number[] {
  let last = 0;
  return values.map((v) => {
    if (v != null) last = v;
    return last;
  });
}

// Solo se etiqueta un subconjunto de fechas en el eje X (5 como mucho), para
// no amontonar texto -> equivalente a `minTickGap` de recharts.
export function sparseLabelIndexes(length: number, target = 5): Set<number> {
  if (length <= target) return new Set(Array.from({ length }, (_, i) => i));
  const step = Math.ceil((length - 1) / (target - 1));
  const set = new Set<number>();
  for (let i = 0; i < length; i += step) set.add(i);
  set.add(length - 1);
  return set;
}
