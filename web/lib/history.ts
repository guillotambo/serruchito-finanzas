import { getDb } from "@/lib/db";
import { fetchWithTimeout } from "@/lib/quotes";
import { filterSeriesByRange, normalizeHistoricalBars, normalizeYahooChart, resampleSeries } from "@serruchito/core";
import type { AssetType, Currency, HistoryRange, SeriesPoint } from "@serruchito/core";

/**
 * Servicio de series históricas (para el sparkline de la watchlist y el
 * gráfico del detalle de un instrumento). Cachea en `price_history`, con
 * watermark en `price_history_meta` para refrescar de forma incremental en
 * vez de reescribir toda la historia en cada request.
 *
 * - ARS (moneda nativa de cedear/accion_arg/bono): data912
 *   /historical/{cedears,stocks,bonds}/{ticker}. Sin parámetro de rango: la
 *   fuente siempre devuelve toda la historia disponible.
 * - USD: Yahoo Finance. Para stock_us/etf, el propio ticker; para un CEDEAR,
 *   el subyacente (instruments.underlying_ticker), con fallback al ticker
 *   propio si no está cargado.
 */

const HISTORY_TIMEOUT_MS = 10_000; // payloads grandes (miles de barras): los 5s de quotes.ts no alcanzan
const HISTORY_STALE_AFTER_MS = 1000 * 60 * 60 * 12; // barras diarias: 12h de cache es suficiente
const MAX_HISTORY_YEARS = 10;
const MAX_REFRESH_PER_REQUEST = 6; // tope de fetches externos por request, para no exceder el límite de una función serverless
const DEFAULT_POINTS = 240;
const SPARKLINE_POINTS_DEFAULT = 30;

export type HistorySeries = {
  ticker: string;
  asset_type: AssetType;
  currency: Currency;
  sourceTicker: string | null;
  source: string | null;
  points: SeriesPoint[];
  firstDate: string | null;
  stale: boolean;
  fetchedAt: string | null;
  error: string | null;
};

type HistorySource = { source: "data912.com" | "finance.yahoo.com"; sourceTicker: string; url: string };

function minRetentionDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MAX_HISTORY_YEARS);
  return d.toISOString().slice(0, 10);
}

// Resuelve de dónde sale la serie de un (ticker, asset_type, currency). null
// si esa combinación no tiene fuente conocida (ej. ARS para un stock_us, o
// USD para un CEDEAR sin instrumento cargado en `instruments`... en ese caso
// se degrada al propio ticker, ver abajo).
async function resolveHistorySource(ticker: string, assetType: AssetType, currency: Currency): Promise<HistorySource | null> {
  if (currency === "ARS") {
    if (assetType === "cedear") return { source: "data912.com", sourceTicker: ticker, url: `https://data912.com/historical/cedears/${encodeURIComponent(ticker)}` };
    if (assetType === "accion_arg") return { source: "data912.com", sourceTicker: ticker, url: `https://data912.com/historical/stocks/${encodeURIComponent(ticker)}` };
    if (assetType === "bono") return { source: "data912.com", sourceTicker: ticker, url: `https://data912.com/historical/bonds/${encodeURIComponent(ticker)}` };
    return null; // etf/stock_us/otro no cotizan nativamente en ARS
  }

  // currency === "USD"
  if (assetType === "stock_us" || assetType === "etf") {
    return { source: "finance.yahoo.com", sourceTicker: ticker, url: `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=10y&interval=1d` };
  }
  // cedear/accion_arg/bono en USD: el subyacente, vía instruments.underlying_ticker.
  const db = await getDb();
  const result = await db.query<{ underlying_ticker: string | null }>(
    `SELECT underlying_ticker FROM instruments WHERE ticker = $1 AND asset_type = $2`,
    [ticker, assetType]
  );
  const sourceTicker = result.rows[0]?.underlying_ticker || ticker;
  return { source: "finance.yahoo.com", sourceTicker, url: `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sourceTicker)}?range=10y&interval=1d` };
}

async function fetchBars(url: string, source: "data912.com" | "finance.yahoo.com"): Promise<{ date: string; close: number; open: number; high: number; low: number; volume: number }[]> {
  const res = await fetchWithTimeout(url, HISTORY_TIMEOUT_MS);
  if (!res.ok) throw new Error(`${source} respondió ${res.status}`);
  const json = await res.json();
  if (source === "data912.com") {
    return normalizeHistoricalBars(json).map((b) => ({ date: b.date, close: b.c, open: b.o, high: b.h, low: b.l, volume: b.v }));
  }
  // Yahoo no trae OHLC completo de forma tan directa en /chart -> se guarda
  // solo el cierre (suficiente para sparkline y gráfico de línea).
  return normalizeYahooChart(json).map((p) => ({ date: p.date, close: p.close, open: p.close, high: p.close, low: p.close, volume: 0 }));
}

async function getMeta(ticker: string, assetType: AssetType, currency: Currency) {
  const db = await getDb();
  const result = await db.query<{
    last_date: string | null;
    fetched_at: string;
    last_error: string | null;
    source: string;
    source_ticker: string;
    first_date: string | null;
  }>(
    `SELECT last_date::text AS last_date, fetched_at, last_error, source, source_ticker, first_date::text AS first_date
     FROM price_history_meta WHERE ticker = $1 AND asset_type = $2 AND currency = $3`,
    [ticker, assetType, currency]
  );
  return result.rows[0] ?? null;
}

// Trae, normaliza y persiste barras nuevas para una serie. No dispara nada
// si ya está fresca (a menos que forceRefresh). Devuelve `stale: true` con lo
// último cacheado si la fuente falla.
async function refreshOne(ticker: string, assetType: AssetType, currency: Currency, forceRefresh: boolean): Promise<void> {
  const meta = await getMeta(ticker, assetType, currency);
  const isFresh = meta && !meta.last_error && Date.now() - new Date(meta.fetched_at).getTime() < HISTORY_STALE_AFTER_MS;
  if (!forceRefresh && isFresh) return;

  const resolved = await resolveHistorySource(ticker, assetType, currency);
  const db = await getDb();
  const fetchedAt = new Date().toISOString();

  if (!resolved) {
    await db.query(
      `INSERT INTO price_history_meta (ticker, asset_type, currency, source, source_ticker, fetched_at, last_error)
       VALUES ($1, $2, $3, '', '', $4, 'Sin fuente disponible para esta moneda')
       ON CONFLICT (ticker, asset_type, currency) DO UPDATE SET fetched_at = excluded.fetched_at, last_error = excluded.last_error`,
      [ticker, assetType, currency, fetchedAt]
    );
    return;
  }

  try {
    const bars = await fetchBars(resolved.url, resolved.source);
    const minDate = minRetentionDate();
    const trimmed = bars.filter((b) => b.date >= minDate);
    // Refresh incremental: si ya hay watermark, solo se insertan barras nuevas.
    const sinceLastDate = meta?.last_date ? trimmed.filter((b) => b.date > meta.last_date!) : trimmed;
    const toInsert = forceRefresh || !meta?.last_date ? trimmed : sinceLastDate;

    if (toInsert.length > 0) {
      await db.query(
        `INSERT INTO price_history (ticker, asset_type, currency, date, open, high, low, close, volume, source, source_ticker)
         SELECT $1, $2, $3, b.d, b.o, b.h, b.l, b.c, b.v, $4, $5
         FROM unnest($6::date[], $7::real[], $8::real[], $9::real[], $10::real[], $11::real[]) AS b(d, o, h, l, c, v)
         ON CONFLICT (ticker, asset_type, currency, date) DO UPDATE
         SET open = excluded.open, high = excluded.high, low = excluded.low,
             close = excluded.close, volume = excluded.volume,
             source = excluded.source, source_ticker = excluded.source_ticker`,
        [
          ticker,
          assetType,
          currency,
          resolved.source,
          resolved.sourceTicker,
          toInsert.map((b) => b.date),
          toInsert.map((b) => b.open),
          toInsert.map((b) => b.high),
          toInsert.map((b) => b.low),
          toInsert.map((b) => b.close),
          toInsert.map((b) => b.volume),
        ]
      );
    }

    const firstDate = trimmed[0]?.date ?? meta?.first_date ?? null;
    const lastDate = trimmed[trimmed.length - 1]?.date ?? meta?.last_date ?? null;
    await db.query(
      `INSERT INTO price_history_meta (ticker, asset_type, currency, source, source_ticker, first_date, last_date, fetched_at, last_error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
       ON CONFLICT (ticker, asset_type, currency) DO UPDATE
       SET source = excluded.source, source_ticker = excluded.source_ticker,
           first_date = excluded.first_date, last_date = excluded.last_date,
           fetched_at = excluded.fetched_at, last_error = NULL`,
      [ticker, assetType, currency, resolved.source, resolved.sourceTicker, firstDate, lastDate, fetchedAt]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    await db.query(
      `INSERT INTO price_history_meta (ticker, asset_type, currency, source, source_ticker, fetched_at, last_error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (ticker, asset_type, currency) DO UPDATE SET fetched_at = excluded.fetched_at, last_error = excluded.last_error`,
      [ticker, assetType, currency, resolved.source, resolved.sourceTicker, fetchedAt, message]
    );
  }
}

async function readSeries(ticker: string, assetType: AssetType, currency: Currency, range: HistoryRange): Promise<SeriesPoint[]> {
  const db = await getDb();
  const result = await db.query<{ date: string; close: number }>(
    `SELECT date::text AS date, close FROM price_history
     WHERE ticker = $1 AND asset_type = $2 AND currency = $3
     ORDER BY date ASC`,
    [ticker, assetType, currency]
  );
  return filterSeriesByRange(result.rows, range);
}

export async function getHistory(
  ticker: string,
  assetType: AssetType,
  currency: Currency,
  range: HistoryRange,
  forceRefresh = false,
  points = DEFAULT_POINTS
): Promise<HistorySeries> {
  await refreshOne(ticker, assetType, currency, forceRefresh);
  const meta = await getMeta(ticker, assetType, currency);
  const series = await readSeries(ticker, assetType, currency, range);

  return {
    ticker,
    asset_type: assetType,
    currency,
    sourceTicker: meta?.source_ticker || null,
    source: meta?.source || null,
    points: resampleSeries(series, points),
    firstDate: meta?.first_date ?? null,
    stale: !meta || !!meta.last_error,
    fetchedAt: meta?.fetched_at ?? null,
    error: meta?.last_error ?? null,
  };
}

// Últimos N cierres de varias series de una, en UNA query. No dispara
// fetches: sirve solo lo que ya está en price_history (el refresh de estas
// series lo maneja refreshHistories aparte, con su propio tope de red).
export async function getSparklines(
  instruments: Array<{ ticker: string; asset_type: AssetType; currency: Currency }>,
  points = SPARKLINE_POINTS_DEFAULT
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  if (instruments.length === 0) return result;

  const db = await getDb();
  const rows = await db.query<{ ticker: string; asset_type: AssetType; currency: Currency; date: string; close: number }>(
    `SELECT s.ticker, s.asset_type, s.currency, h.date::text AS date, h.close
     FROM unnest($1::text[], $2::text[], $3::text[]) AS s(ticker, asset_type, currency)
     JOIN LATERAL (
       SELECT p.date, p.close FROM price_history p
       WHERE p.ticker = s.ticker AND p.asset_type = s.asset_type AND p.currency = s.currency
       ORDER BY p.date DESC LIMIT $4
     ) h ON true
     ORDER BY s.ticker, h.date ASC`,
    [instruments.map((i) => i.ticker), instruments.map((i) => i.asset_type), instruments.map((i) => i.currency), points]
  );

  for (const row of rows.rows) {
    const key = `${row.ticker}::${row.asset_type}::${row.currency}`;
    const arr = result.get(key) ?? [];
    arr.push(row.close);
    result.set(key, arr);
  }
  return result;
}

// Refresca hasta `limit` series, priorizando las que nunca se cachearon o
// tienen el fetched_at más viejo. Sin `limit`, refresca todas (uso: cron).
export async function refreshHistories(
  instruments: Array<{ ticker: string; asset_type: AssetType; currency: Currency }>,
  limit?: number
): Promise<{ refreshed: number; failed: number }> {
  if (instruments.length === 0) return { refreshed: 0, failed: 0 };

  const db = await getDb();
  const metaRows = await db.query<{ ticker: string; asset_type: AssetType; currency: Currency; fetched_at: string }>(
    `SELECT ticker, asset_type, currency, fetched_at FROM price_history_meta
     WHERE (ticker, asset_type, currency) IN (
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
     )`,
    [instruments.map((i) => i.ticker), instruments.map((i) => i.asset_type), instruments.map((i) => i.currency)]
  );
  const fetchedAtByKey = new Map(metaRows.rows.map((r) => [`${r.ticker}::${r.asset_type}::${r.currency}`, r.fetched_at]));

  const ordered = [...instruments].sort((a, b) => {
    const fa = fetchedAtByKey.get(`${a.ticker}::${a.asset_type}::${a.currency}`);
    const fb = fetchedAtByKey.get(`${b.ticker}::${b.asset_type}::${b.currency}`);
    if (!fa && !fb) return 0;
    if (!fa) return -1; // sin cache: primero
    if (!fb) return 1;
    return fa.localeCompare(fb); // más viejo primero
  });

  const toRefresh = limit != null ? ordered.slice(0, Math.min(limit, MAX_REFRESH_PER_REQUEST)) : ordered;
  const results = await Promise.allSettled(toRefresh.map((i) => refreshOne(i.ticker, i.asset_type, i.currency, false)));
  const refreshed = results.filter((r) => r.status === "fulfilled").length;
  return { refreshed, failed: results.length - refreshed };
}
