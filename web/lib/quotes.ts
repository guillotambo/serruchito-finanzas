import { getDb } from "@/lib/db";
import type { AssetType, Currency, Quote } from "@serruchito/core";

/**
 * Servicio de cotizaciones. Fuentes públicas, sin credenciales.
 *
 * - cedear / accion_arg: data912.com (paneles live de BYMA), el precio real
 *   negociado en el mercado local. Si no responde, no se calcula ningún
 *   precio local de reemplazo: la posición queda con el último precio
 *   cacheado marcado `stale` (ver getQuotes) hasta que data912 vuelva a
 *   responder.
 * - stock_us / etf: Yahoo Finance directo (USD).
 * - bono / otro: no se resuelve automáticamente.
 *
 * Un mismo ticker puede representar instrumentos distintos según el broker
 * (ej. MSFT como CEDEAR en ARS vía Cocos vs. MSFT como acción directa en USD
 * vía IBKR), con precios NO intercambiables. Por eso todo -cache y resultado-
 * se indexa por la clave compuesta `${ticker}::${asset_type}`, nunca por
 * ticker solo.
 */

const FETCH_TIMEOUT_MS = 5000;
const STALE_AFTER_MS = 1000 * 60 * 60 * 6; // 6 horas: pasado esto, se marca stale aunque no haya podido refrescar

export type PricedInstrument = { ticker: string; asset_type: AssetType };

function key(ticker: string, assetType: string): string {
  return `${ticker}::${assetType}`;
}

export async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
  } finally {
    clearTimeout(t);
  }
}

type Data912Row = {
  symbol: string;
  c?: number;
  px_bid?: number;
  px_ask?: number;
  pct_change?: number; // variación % vs. cierre anterior, si el panel la informa
};

function midOrLast(row: Data912Row): number | null {
  if (typeof row.c === "number" && row.c > 0) return row.c;
  if (typeof row.px_bid === "number" && typeof row.px_ask === "number" && row.px_bid > 0 && row.px_ask > 0) {
    return (row.px_bid + row.px_ask) / 2;
  }
  return null;
}

// Cierre anterior derivado del % de variación que trae el panel (si lo trae):
// previousClose = price / (1 + pct/100). Si el panel no informa `pct_change`,
// se degrada a null (sin variación intradía para ese ticker).
function previousCloseFromPct(price: number, pctChange: number | undefined): number | null {
  if (typeof pctChange !== "number" || !Number.isFinite(pctChange)) return null;
  const divisor = 1 + pctChange / 100;
  if (divisor <= 0) return null;
  return price / divisor;
}

async function fetchData912Panel(panel: "arg_cedears" | "arg_stocks"): Promise<Map<string, { price: number; previousClose: number | null }>> {
  const res = await fetchWithTimeout(`https://data912.com/live/${panel}`);
  if (!res.ok) throw new Error(`data912 ${panel} respondió ${res.status}`);
  const rows: Data912Row[] = await res.json();
  const map = new Map<string, { price: number; previousClose: number | null }>();
  for (const row of rows) {
    const price = midOrLast(row);
    if (row.symbol && price != null) {
      map.set(row.symbol.toUpperCase(), { price, previousClose: previousCloseFromPct(price, row.pct_change) });
    }
  }
  return map;
}

async function fetchYahooPrice(ticker: string): Promise<{ price: number; previousClose: number | null } | null> {
  const res = await fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`);
  if (!res.ok) throw new Error(`Yahoo Finance respondió ${res.status} para ${ticker}`);
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== "number") return null;
  const previousClose = meta?.chartPreviousClose ?? meta?.previousClose;
  return { price, previousClose: typeof previousClose === "number" ? previousClose : null };
}

// Precio en USD de un instrumento de referencia (ej. "SPY" como proxy del
// S&P 500), para comparar el rendimiento del portafolio contra un benchmark.
// No cachea en price_cache -> el valor queda guardado directo en el snapshot
// del día que lo pide (ver app/api/snapshots/route.ts). Si Yahoo falla, se
// degrada a null: ese día el benchmark queda sin dato, no rompe el snapshot.
export async function fetchBenchmarkPrice(ticker: string): Promise<number | null> {
  try {
    const quote = await fetchYahooPrice(ticker);
    return quote?.price ?? null;
  } catch {
    return null;
  }
}

export type LiveSymbol = { symbol: string; price: number | null; panel: "arg_cedears" | "arg_stocks" };

const LIVE_SYMBOLS_TTL_MS = 1000 * 60 * 10; // 10 min: alcanza para un combobox de búsqueda, no hace falta price_cache
let liveSymbolsCache: { fetchedAt: number; symbols: LiveSymbol[] } | null = null;

// Todos los símbolos de los paneles live de data912 (CEDEARs + acciones
// argentinas), para el buscador de tickers (ver app/api/instruments/search).
// Cache en memoria de módulo: dura lo que la lambda esté caliente, no
// persiste en price_cache porque no es un precio que se vaya a usar para
// valuar nada, solo para ofrecer resultados de búsqueda.
export async function getLiveSymbols(forceRefresh = false): Promise<LiveSymbol[]> {
  if (!forceRefresh && liveSymbolsCache && Date.now() - liveSymbolsCache.fetchedAt < LIVE_SYMBOLS_TTL_MS) {
    return liveSymbolsCache.symbols;
  }
  const panels: Array<"arg_cedears" | "arg_stocks"> = ["arg_cedears", "arg_stocks"];
  const results = await Promise.allSettled(panels.map((panel) => fetchData912Panel(panel)));
  const symbols: LiveSymbol[] = [];
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    for (const [symbol, quote] of r.value) symbols.push({ symbol, price: quote.price, panel: panels[i] });
  });
  if (symbols.length > 0) liveSymbolsCache = { fetchedAt: Date.now(), symbols };
  return symbols.length > 0 ? symbols : (liveSymbolsCache?.symbols ?? []);
}

export async function fetchCcl(): Promise<{ value: number; source: string } | null> {
  try {
    const res = await fetchWithTimeout("https://dolarapi.com/v1/dolares/contadoconliqui");
    if (res.ok) {
      const json = await res.json();
      if (typeof json.venta === "number") {
        return { value: json.venta, source: "dolarapi.com" };
      }
    }
  } catch {
    // seguir al fallback
  }
  try {
    const res = await fetchWithTimeout("https://data912.com/live/ccl");
    if (res.ok) {
      const json = await res.json();
      const value = Array.isArray(json) ? (json[0]?.close ?? json[0]?.c) : (json?.close ?? json?.c);
      if (typeof value === "number") return { value, source: "data912.com" };
    }
  } catch {
    // sin fuentes disponibles
  }
  return null;
}

async function getCachedFx(fxKey: string) {
  const db = await getDb();
  const result = await db.query<{ value: number; source: string; fetched_at: string }>(
    `SELECT value, source, fetched_at FROM fx_cache WHERE key = $1`,
    [fxKey]
  );
  return result.rows[0];
}

export async function getCcl(forceRefresh = false): Promise<{ value: number | null; source: string | null; fetchedAt: string | null; stale: boolean }> {
  const db = await getDb();
  const cached = await getCachedFx("ccl");
  const isFresh = cached && Date.now() - new Date(cached.fetched_at).getTime() < STALE_AFTER_MS;

  if (!forceRefresh && isFresh) {
    return { value: cached!.value, source: cached!.source, fetchedAt: cached!.fetched_at, stale: false };
  }

  const fresh = await fetchCcl();
  if (fresh) {
    const fetchedAt = new Date().toISOString();
    await db.query(
      `INSERT INTO fx_cache (key, value, source, fetched_at) VALUES ('ccl', $1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, source = excluded.source, fetched_at = excluded.fetched_at`,
      [fresh.value, fresh.source, fetchedAt]
    );
    return { value: fresh.value, source: fresh.source, fetchedAt, stale: false };
  }

  if (cached) {
    return { value: cached.value, source: cached.source, fetchedAt: cached.fetched_at, stale: true };
  }
  return { value: null, source: null, fetchedAt: null, stale: true };
}

async function getCachedPrice(ticker: string, assetType: string) {
  const db = await getDb();
  const result = await db.query<{
    ticker: string;
    asset_type: string;
    price: number;
    currency: Currency;
    source: string;
    fetched_at: string;
    previous_close: number | null;
  }>(
    `SELECT ticker, asset_type, price, currency, source, fetched_at, previous_close FROM price_cache WHERE ticker = $1 AND asset_type = $2`,
    [ticker, assetType]
  );
  return result.rows[0];
}

async function savePrice(
  ticker: string,
  assetType: string,
  price: number,
  currency: Currency,
  source: string,
  previousClose: number | null = null
) {
  const db = await getDb();
  const fetchedAt = new Date().toISOString();
  await db.query(
    `INSERT INTO price_cache (ticker, asset_type, price, currency, source, fetched_at, previous_close) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (ticker, asset_type) DO UPDATE SET price = excluded.price, currency = excluded.currency, source = excluded.source, fetched_at = excluded.fetched_at, previous_close = excluded.previous_close`,
    [ticker, assetType, price, currency, source, fetchedAt, previousClose]
  );
  return fetchedAt;
}

/**
 * Refresca (o lee del cache) el precio de cada (ticker, asset_type) presente
 * en las transacciones.
 *
 * - cedear / accion_arg: solo data912 (precio real de mercado local). Si no
 *   responde, no se calcula ningún precio de reemplazo -queda el último
 *   precio cacheado marcado `stale`-.
 * - stock_us / etf: Yahoo Finance directo (USD).
 * - bono / otro: no se resuelve automáticamente.
 */
export async function getQuotes(positions: PricedInstrument[], forceRefresh = false): Promise<Map<string, Quote>> {
  const result = new Map<string, Quote>();
  if (positions.length === 0) return result;

  const needsRefresh: PricedInstrument[] = [];
  for (const pos of positions) {
    const k = key(pos.ticker, pos.asset_type);
    const cached = await getCachedPrice(pos.ticker, pos.asset_type);
    const isFresh = cached && Date.now() - new Date(cached.fetched_at).getTime() < STALE_AFTER_MS;
    if (!forceRefresh && isFresh) {
      result.set(k, { ...cached, previousClose: cached!.previous_close, stale: false });
    } else {
      needsRefresh.push(pos);
      if (cached) result.set(k, { ...cached, previousClose: cached.previous_close, stale: true }); // fallback si el refresh falla
    }
  }

  if (needsRefresh.length === 0) return result;

  const arsPositions = needsRefresh.filter((p) => p.asset_type === "cedear" || p.asset_type === "accion_arg");
  const usdPositions = needsRefresh.filter((p) => p.asset_type === "stock_us" || p.asset_type === "etf");

  // --- CEDEARs / acciones argentinas: data912 (paneles en paralelo, nunca en
  // serie: si el servicio está caído no queremos sumar timeouts) ---
  if (arsPositions.length > 0) {
    const panels: Array<"arg_cedears" | "arg_stocks"> = ["arg_cedears", "arg_stocks"];
    const merged = new Map<string, { price: number; previousClose: number | null }>();
    const results = await Promise.allSettled(panels.map((panel) => fetchData912Panel(panel)));
    for (const r of results) {
      if (r.status === "fulfilled") {
        for (const [symbol, quote] of r.value) merged.set(symbol, quote);
      }
      // panel caído: seguimos con lo que haya en el otro panel; sin fallback local.
    }
    for (const pos of arsPositions) {
      const quote = merged.get(pos.ticker.toUpperCase());
      if (quote != null) {
        const fetchedAt = await savePrice(pos.ticker, pos.asset_type, quote.price, "ARS", "data912.com", quote.previousClose);
        result.set(key(pos.ticker, pos.asset_type), {
          ticker: pos.ticker,
          price: quote.price,
          currency: "ARS",
          source: "data912.com",
          fetched_at: fetchedAt,
          stale: false,
          previousClose: quote.previousClose,
        });
      }
    }
  }

  // --- Stocks/ETFs en USD: Yahoo Finance (en paralelo, mismo motivo que arriba) ---
  await Promise.allSettled(
    usdPositions.map(async (pos) => {
      const quote = await fetchYahooPrice(pos.ticker);
      if (quote != null) {
        const fetchedAt = await savePrice(pos.ticker, pos.asset_type, quote.price, "USD", "finance.yahoo.com", quote.previousClose);
        result.set(key(pos.ticker, pos.asset_type), {
          ticker: pos.ticker,
          price: quote.price,
          currency: "USD",
          source: "finance.yahoo.com",
          fetched_at: fetchedAt,
          stale: false,
          previousClose: quote.previousClose,
        });
      }
    })
  );

  return result;
}
