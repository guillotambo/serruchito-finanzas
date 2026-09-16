import { useEffect, useMemo, useRef } from "react";
import useSWR, { useSWRConfig, type ScopedMutator } from "swr";
import type {
  AssetType,
  CashHolding,
  Currency,
  Dividend,
  HistoryRange,
  Instrument,
  InstrumentSearchResult,
  PortfolioSnapshot,
  PortfolioSummary,
  Transaction,
} from "@serruchito/core";
import type { CashSummary, PortfolioFreshness } from "@/lib/getPortfolioSummary";
import type { WatchlistRow } from "@/lib/watchlist";
import type { HistorySeries } from "@/lib/history";

// Refresh forzado de precios: ignora el cache de 6h de price_cache/fx_cache
// (ver lib/quotes.ts) y revalida /api/portfolio y /api/watchlist (Mercado
// tiene su propia consulta de precios). Compartido por el chip del header
// (PriceRefreshStatus) y por el polling automático (useAutoRefreshPrices)
// para no duplicar esta lógica en dos lugares.
export async function refreshPrices(mutate: ScopedMutator) {
  const res = await fetch("/api/quotes/refresh", { method: "POST" });
  if (!res.ok) throw new Error(`refresh respondió ${res.status}`);
  await Promise.all([mutate("/api/portfolio"), mutate("/api/watchlist")]);
}

class FetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new FetchError(body?.error ?? `Error ${res.status} al consultar ${url}`, res.status);
  }
  return res.json();
};

export function usePortfolio() {
  return useSWR<PortfolioSummary & PortfolioFreshness & CashSummary>("/api/portfolio", fetcher, {
    revalidateOnFocus: false,
  });
}

export function useTransactions() {
  return useSWR<Transaction[]>("/api/transactions", fetcher);
}

export function useDividends() {
  return useSWR<Dividend[]>("/api/dividends", fetcher);
}

export function useInstruments() {
  return useSWR<Instrument[]>("/api/instruments", fetcher);
}

export function useSnapshots() {
  return useSWR<PortfolioSnapshot[]>("/api/snapshots", fetcher, { revalidateOnFocus: false });
}

// Precio en vivo de SPY para el punto "en vivo" del gráfico de Rendimiento.
// Endpoint separado de /api/portfolio (ver app/api/benchmark/route.ts) para
// no sumarle una llamada a Yahoo a páginas que no lo necesitan.
export function useBenchmarkPrice() {
  return useSWR<{ spyUsd: number | null }>("/api/benchmark", fetcher, { revalidateOnFocus: false });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Combina los snapshots guardados (cierre de cada día) con el valor en vivo
// del portfolio (precios de ahora) en una única serie: única fuente de
// verdad para "Rendimiento" y para el chart de evolución del Dashboard, así
// las dos pantallas muestran siempre la misma curva y no una desactualizada
// respecto de la otra. Si el cron ya corrió hoy, el punto en vivo reemplaza
// (no duplica) el snapshot de hoy -> más fresco. Ver lib/snapshots.ts para
// el mismo cálculo persistido al cierre.
export function useLiveSnapshotSeries() {
  const snapshotsResult = useSnapshots();
  const portfolioResult = usePortfolio();
  const benchmarkResult = useBenchmarkPrice();
  const { data: snapshots } = snapshotsResult;
  const { data: portfolio } = portfolioResult;
  const { data: benchmark } = benchmarkResult;

  const liveDate = portfolio ? todayIso() : undefined;

  const seriesWithLive = useMemo((): PortfolioSnapshot[] => {
    const base = [...(snapshots ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    if (!portfolio || !liveDate) return base;

    const byBroker: Record<string, number> = {};
    for (const p of portfolio.positions) {
      byBroker[p.broker] = (byBroker[p.broker] ?? 0) + (p.valueArs ?? 0);
    }
    const livePoint: PortfolioSnapshot = {
      date: liveDate,
      total_value_ars: portfolio.totalValueArs,
      total_value_usd: portfolio.totalValueUsd,
      total_cost_ars: portfolio.totalCostArs,
      ccl: portfolio.ccl,
      spy_usd: benchmark?.spyUsd ?? null,
      by_broker: byBroker,
    };
    if (base.length > 0 && base[base.length - 1].date === liveDate) return [...base.slice(0, -1), livePoint];
    return [...base, livePoint];
  }, [snapshots, portfolio, benchmark, liveDate]);

  return { seriesWithLive, liveDate, snapshots, portfolio };
}

export function useCashHoldings() {
  return useSWR<CashHolding[]>("/api/cash", fetcher);
}

export function useWatchlist() {
  return useSWR<{ rows: WatchlistRow[]; pricesFetchedAt: string | null; pricesStale: boolean }>("/api/watchlist", fetcher, {
    revalidateOnFocus: false,
  });
}

// Buscador de tickers para agregar a la watchlist. Debounce simple con
// SWR: key `null` mientras `q` no tiene largo suficiente evita pegarle a la
// API en cada tecla y en cada letra sub-2-caracteres.
export function useInstrumentSearch(q: string) {
  const trimmed = q.trim();
  return useSWR<InstrumentSearchResult[]>(
    trimmed.length >= 2 ? `/api/instruments/search?q=${encodeURIComponent(trimmed)}` : null,
    fetcher,
    { keepPreviousData: true }
  );
}

// Serie histórica de un instrumento (sparkline en la lista, gráfico del
// detalle). No revalida al volver a la pestaña: el cache de 12h del backend
// hace que un refetch inmediato casi nunca traiga nada nuevo.
export function useHistory(ticker: string, assetType: AssetType, currency: Currency, range: HistoryRange) {
  return useSWR<HistorySeries>(
    `/api/history/${encodeURIComponent(ticker)}?asset_type=${assetType}&currency=${currency}&range=${range}`,
    fetcher,
    { revalidateOnFocus: false }
  );
}

// Auto-refresh de precios: dispara refreshPrices() cada `intervalMs` mientras
// la pestaña esté visible, y además al volver a ella (por si el intervalo
// venció mientras estaba oculta/minimizada). Se pausa solo mientras la
// pestaña está oculta, para no gastar llamadas a las APIs externas de fondo.
export function useAutoRefreshPrices(intervalMs: number) {
  const { mutate } = useSWRConfig();
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (inFlightRef.current || document.visibilityState !== "visible") return;
      inFlightRef.current = true;
      try {
        await refreshPrices(mutate);
      } catch {
        // El indicador de refresh (PriceRefreshStatus) ya refleja datos
        // stale/sin conexión vía el error de usePortfolio; no hace falta
        // propagar el error del polling en segundo plano.
      } finally {
        if (!cancelled) inFlightRef.current = false;
      }
    }

    const interval = setInterval(tick, intervalMs);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") tick();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, mutate]);
}
