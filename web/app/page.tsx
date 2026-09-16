"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSWRConfig } from "swr";
import { useAutoRefreshPrices, useLiveSnapshotSeries, usePortfolio } from "@/lib/hooks";
import { usePortfolioFilters } from "@/lib/portfolio-filters";
import { ErrorState } from "@/components/ErrorState";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { MoversList } from "@/components/MoversList";
import { PortfolioFilterBar } from "@/components/PortfolioFilterBar";
import { PortfolioFilters } from "@/components/PortfolioFilters";
import { PortfolioHistoryChart } from "@/components/PortfolioHistoryChart";
import { BestWorstAsset } from "@/components/BestWorstAsset";
import { CashSummaryCard } from "@/components/CashSummaryCard";
import { Modal } from "@/components/ui/Overlay";
import {
  AMOUNT_MASK,
  computeBestWorstAsset,
  filterCashByBroker,
  filterPositionsByBroker,
  formatArs as formatArsRaw,
  formatPct,
  formatUsd as formatUsdRaw,
  portfolioFilterNote,
  summarizeFilteredPortfolio,
} from "@serruchito/core";
import { useCurrency } from "@/lib/currency-context";
import { useHideAmounts } from "@/lib/privacy-context";
import { useMounted } from "@/lib/use-mounted";

// Cada cuánto se auto-refrescan los precios mientras el dashboard está
// abierto (además del refresh manual, ahora en el header global -> ver
// shell/Header.tsx). Ver useAutoRefreshPrices en lib/hooks.ts: se pausa solo
// mientras la pestaña está oculta.
const AUTO_REFRESH_MS = 15 * 60 * 1000;

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { data, isLoading, error } = usePortfolio();
  useAutoRefreshPrices(AUTO_REFRESH_MS);
  // Misma serie (snapshots guardados + punto en vivo) que usa Rendimiento ->
  // ver lib/hooks.ts, para que el chart de acá y el de Rendimiento muestren
  // siempre la misma curva en vez de versiones desactualizadas entre sí.
  const { seriesWithLive, liveDate } = useLiveSnapshotSeries();
  const { currency } = useCurrency();
  const { hidden } = useHideAmounts();
  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;
  const formatUsd = hidden ? () => AMOUNT_MASK : formatUsdRaw;
  const { mutate } = useSWRConfig();
  const { filters } = usePortfolioFilters();
  const { broker: brokerFilter, includeCash } = filters;
  const [showFilters, setShowFilters] = useState(false);

  // Sin esto, los clicks del switch de efectivo y del filtro de broker se
  // pierden en la primera ventana de render: ver lib/use-mounted.ts.
  const mounted = useMounted();

  const filteredPositions = useMemo(() => (data ? filterPositionsByBroker(data.positions, brokerFilter) : []), [data, brokerFilter]);

  // Efectivo sin broker asignado (ej. plata en el banco) cuenta para el
  // patrimonio pase lo que pase el filtro; el que sí tiene broker respeta el
  // filtro igual que las posiciones.
  const filteredCash = useMemo(
    () => (data && includeCash ? filterCashByBroker(data.cashHoldings, brokerFilter) : []),
    [data, brokerFilter, includeCash]
  );

  const totals = useMemo(
    () => (data ? summarizeFilteredPortfolio({ positions: filteredPositions, cashHoldings: filteredCash, ccl: data.ccl }) : null),
    [data, filteredPositions, filteredCash]
  );

  const bestWorst = useMemo(() => computeBestWorstAsset(filteredPositions), [filteredPositions]);

  // Si falla la consulta pero ya había datos (cache de SWR, persistida en
  // localStorage entre sesiones), se sigue mostrando esa última data en vez
  // de tapar todo con el error -> el chip del header marca que lo que se ve
  // no está fresco. Solo se bloquea la pantalla si no hay nada previo.
  if (error && !data) {
    return <ErrorState message={error.message} onRetry={() => mutate("/api/portfolio")} />;
  }

  if (!mounted || isLoading || !data || !totals) {
    return <DashboardSkeleton />;
  }

  if (data.positions.length === 0 && data.cashHoldings.length === 0) {
    return <WelcomeState />;
  }

  const filterLabel = portfolioFilterNote(filters);

  const fmt = currency === "ARS" ? formatArs : formatUsd;
  const totalValue = currency === "ARS" ? totals.totalValueArs : totals.totalValueUsd;
  const totalCash = currency === "ARS" ? totals.totalCashArs : totals.totalCashUsd;
  const totalDayChange = currency === "ARS" ? totals.totalDayChangeArs : totals.totalDayChangeUsd;
  const totalUnrealized = currency === "ARS" ? totals.totalUnrealizedPnlArs : totals.totalUnrealizedPnlUsd;

  return (
    <div className="dashboard-page flex flex-col gap-8">
      <header className="flex flex-col gap-4 border-b pb-6" style={{ borderColor: "var(--border)" }}>
        <div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Vista general</p>
          <h1 className="mt-1 text-2xl font-semibold">Tu cartera hoy</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {data.ccl
              ? `CCL: ${formatArs(data.ccl)} · ${data.cclSource ?? "sin fuente"}${data.cclStale ? " · desactualizado" : ""}`
              : "CCL no disponible"}
          </p>
        </div>
      </header>

      <PortfolioFilterBar onOpenFilters={() => setShowFilters(true)} />

      <section className="dashboard-overview-grid">
        <div className="dashboard-hero-value">
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Patrimonio visible</span>
          <p className="mt-6 text-4xl font-semibold tracking-normal tabular-nums sm:text-5xl">{fmt(totalValue)}</p>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            {!includeCash
              ? `${filteredPositions.length} posiciones abiertas · efectivo excluido`
              : totalCash && totalCash > 0
                ? `${fmt(totalCash)} en efectivo incluido`
                : `${filteredPositions.length} posiciones abiertas`}
          </p>
          <div className="dashboard-inline-metrics mt-8">
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>P&L no realizado</p>
              <p className="mt-1 text-lg font-semibold tabular-nums" style={{ color: (totalUnrealized ?? 0) >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>{fmt(totalUnrealized)}</p>
              <p className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{formatPct(totals.totalPnlPct)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Historico realizado</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{fmt(currency === "ARS" ? data.totalRealizedPnlArs + data.totalDividendsArs : data.totalRealizedPnlUsd + data.totalDividendsUsd)}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{filterLabel ?? "realizado + dividendos"}</p>
            </div>
          </div>
        </div>

        <aside className="dashboard-day-card" aria-label="Resumen del dia">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Variacion del dia</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums" style={{ color: (totalDayChange ?? 0) >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>{fmt(totalDayChange)}</p>
          <p className="mt-1 text-sm font-medium tabular-nums" style={{ color: totals.totalDayChangePct == null ? "var(--text-muted)" : totals.totalDayChangePct >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>{formatPct(totals.totalDayChangePct)}</p>
          <div className="mt-7 border-t pt-5" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Lectura rapida</p>
            <div className="mt-3"><BestWorstAsset best={bestWorst.best} worst={bestWorst.worst} /></div>
          </div>
        </aside>
      </section>

      <section className="dashboard-chart-panel rounded-lg border p-5 sm:p-6" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Evolucion del patrimonio</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Valor de cartera y capital aportado en el tiempo.</p>
          </div>
        </div>
        <PortfolioHistoryChart snapshots={seriesWithLive} broker={brokerFilter} liveDate={liveDate} />
      </section>

      <section className="dashboard-section rounded-lg border p-5 sm:p-6" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <h2 className="text-lg font-semibold">Mercado hoy</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Los movimientos con variacion disponible.</p>
        <div className="mt-5"><MoversList positions={filteredPositions} /></div>
      </section>

      <section className="border-t pt-5 flex items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
        <div>
          <h2 className="text-lg font-semibold">Cartera</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {filteredPositions.length} posiciones abiertas · distribución y detalle completo.
          </p>
        </div>
        <Link
          href="/cartera"
          className="shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          Ver cartera →
        </Link>
      </section>

      {filteredCash.length > 0 && (
        <section className="border-t pt-5" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-lg font-semibold">Efectivo y otros saldos</h2>
          <div className="mt-4"><CashSummaryCard cashHoldings={filteredCash} /></div>
        </section>
      )}

      {showFilters && (
        <Modal
          onClose={() => setShowFilters(false)}
          maxWidth="28rem"
          header={(titleId) => (
            <h2 id={titleId} className="text-lg font-semibold">
              Filtros
            </h2>
          )}
        >
          <PortfolioFilters />
        </Modal>
      )}
    </div>
  );
}

// Cartera vacía (primera vez): en vez de un dashboard lleno de ceros, se
// explica cómo cargar los movimientos.
function WelcomeState() {
  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Primeros pasos</p>
        <h1 className="mt-1 text-2xl font-semibold">Todavía no cargaste nada</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Cargá tus compras y ventas y la app arma tu cartera con precios actualizados. Hay dos formas:
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/movimientos"
          className="rounded-lg border p-4 flex flex-col gap-1 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Cargar un movimiento</span>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>De a uno, con un formulario. Ideal para pocas operaciones.</span>
        </Link>
        <Link
          href="/ajustes"
          className="rounded-lg border p-4 flex flex-col gap-1 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Importar una planilla</span>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>Completás una plantilla de Excel con todo tu historial y la subís de una vez.</span>
        </Link>
      </div>
    </div>
  );
}
