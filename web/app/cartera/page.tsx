"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { usePortfolio, useTransactions, useDividends } from "@/lib/hooks";
import { usePortfolioFilters } from "@/lib/portfolio-filters";
import { useCurrency } from "@/lib/currency-context";
import { useHideAmounts } from "@/lib/privacy-context";
import {
  computeConcentration,
  computeXirr,
  filterCashByBroker,
  filterDividendsByBroker,
  filterPositionsByBroker,
  filterRealizedByBroker,
  filterTransactionsByBroker,
  summarizeFilteredPortfolio,
  AMOUNT_MASK,
  formatArs as formatArsRaw,
  formatPct,
  formatShare,
  formatUsd as formatUsdRaw,
} from "@serruchito/core";
import { ErrorState } from "@/components/ErrorState";
import { StaleDataNotice } from "@/components/StaleDataNotice";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { PortfolioFilterBar } from "@/components/PortfolioFilterBar";
import { PortfolioFilters } from "@/components/PortfolioFilters";
import { StatTile } from "@/components/StatTile";
import { PositionsTable } from "@/components/PositionsTable";
import { AllocationBar } from "@/components/AllocationBar";
import { RealizedPnlSection } from "@/components/RealizedPnlSection";
import { Modal } from "@/components/ui/Overlay";

// Fusión de lo que antes eran /portfolio (tab Resumen) y /posiciones: las dos
// mostraban PositionsTable de las mismas posiciones actuales, así que acá hay
// una sola instancia. Volatilidad, Caída máxima, benchmark, TWR, costos,
// concentración por dimensión y dividendos (antes en /portfolio tab Análisis)
// se mudaron a /rendimiento, que es donde vive el resto de la performance.
type Vista = "actuales" | "cerradas";

export default function CarteraPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <CarteraContent />
    </Suspense>
  );
}

// "vista" (actuales/cerradas) es un modo de la pantalla, no un recorte de
// cartera compartido con Inicio -> queda afuera de usePortfolioFilters, con
// su propio search param, tal como antes.
function useVista() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const vista: Vista = searchParams.get("vista") === "cerradas" ? "cerradas" : "actuales";

  const setVista = (value: Vista) => {
    const params = new URLSearchParams(searchParams);
    if (value === "actuales") params.delete("vista");
    else params.set("vista", value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return { vista, setVista };
}

function CarteraContent() {
  const { data, isLoading, error } = usePortfolio();
  const { data: transactions } = useTransactions();
  const { data: dividends } = useDividends();
  const { currency } = useCurrency();
  const { hidden } = useHideAmounts();
  const { mutate } = useSWRConfig();
  const { filters } = usePortfolioFilters();
  const { broker: brokerFilter, includeCash } = filters;
  const { vista, setVista } = useVista();
  const [showFilters, setShowFilters] = useState(false);

  const positions = useMemo(() => (data ? filterPositionsByBroker(data.positions, brokerFilter) : []), [data, brokerFilter]);
  const cash = useMemo(
    () => (data && includeCash ? filterCashByBroker(data.cashHoldings, brokerFilter) : []),
    [data, brokerFilter, includeCash]
  );
  const trades = useMemo(() => (data ? filterRealizedByBroker(data.realizedTrades, brokerFilter) : []), [data, brokerFilter]);
  const filteredDividends = useMemo(
    () => (dividends ? filterDividendsByBroker(dividends, brokerFilter) : []),
    [dividends, brokerFilter]
  );
  const filteredTransactions = useMemo(
    () => (transactions ? filterTransactionsByBroker(transactions, brokerFilter) : []),
    [transactions, brokerFilter]
  );

  const totals = useMemo(
    () => (data ? summarizeFilteredPortfolio({ positions, cashHoldings: cash, ccl: data.ccl }) : null),
    [data, positions, cash]
  );

  const concentration = useMemo(() => (data ? computeConcentration(positions) : null), [data, positions]);
  const xirr = useMemo(() => {
    if (!data || !totals) return null;
    return computeXirr({
      transactions: filteredTransactions,
      dividends: filteredDividends,
      currentValueArs: totals.totalValueArs,
      ccl: data.ccl,
    });
  }, [data, totals, filteredTransactions, filteredDividends]);

  if (error && !data) {
    return <ErrorState message={error.message} onRetry={() => mutate("/api/portfolio")} />;
  }
  if (isLoading || !data || !totals) {
    return <DashboardSkeleton />;
  }

  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;
  const formatUsd = hidden ? () => AMOUNT_MASK : formatUsdRaw;
  const inUsd = currency === "USD";
  const fmt = inUsd ? formatUsd : formatArs;
  const totalValue = inUsd ? totals.totalValueUsd : totals.totalValueArs;
  const totalCost = inUsd ? (data.ccl ? totals.totalCostArs / data.ccl : null) : totals.totalCostArs;
  const totalUnrealizedPnl = inUsd ? totals.totalUnrealizedPnlUsd : totals.totalUnrealizedPnlArs;
  const totalCash = inUsd ? totals.totalCashUsd : totals.totalCashArs;

  // Realizado + dividendos, ya filtrados por broker (a diferencia de Inicio,
  // acá sí se puede: realizedTrades y dividends traen broker).
  const realizedPnlArs = trades.reduce((sum, t) => sum + (t.pnlArs ?? 0), 0);
  const realizedPnlUsd = trades.reduce((sum, t) => sum + (t.pnlUsd ?? 0), 0);
  const dividendsArs = filteredDividends.reduce(
    (sum, d) => sum + (d.currency === "ARS" ? d.amount : data.ccl ? d.amount * data.ccl : 0),
    0
  );
  const dividendsUsd = filteredDividends.reduce(
    (sum, d) => sum + (d.currency === "USD" ? d.amount : data.ccl ? d.amount / data.ccl : 0),
    0
  );
  const totalRealizedPnl = inUsd ? realizedPnlUsd : realizedPnlArs;
  const netGain =
    totals.totalCostArs > 0
      ? inUsd
        ? (totalUnrealizedPnl ?? 0) + realizedPnlUsd + dividendsUsd
        : (totalUnrealizedPnl ?? 0) + realizedPnlArs + dividendsArs
      : null;
  const totalPnlPct = totals.totalPnlPct;
  const totalDayChange = inUsd ? totals.totalDayChangeUsd : totals.totalDayChangeArs;
  const totalPnl = (totalUnrealizedPnl ?? 0) + totalRealizedPnl;

  return (
    <div className="flex flex-col gap-6">
      {error && <StaleDataNotice message={error.message} onRetry={() => mutate("/api/portfolio")} />}
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: "var(--border)" }}>
        <div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Vista general</p>
          <h1 className="mt-1 text-2xl font-semibold">Cartera</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Posiciones actuales, liquidez y ganancia tomada.
          </p>
        </div>
        <Link href="/rendimiento" className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Ver análisis de rendimiento →
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-0.5 rounded-full self-start" style={{ background: "var(--gridline)" }} role="tablist">
          {(["actuales", "cerradas"] as Vista[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              id={`tab-${v}`}
              aria-selected={vista === v}
              aria-controls={`panel-${v}`}
              onClick={() => setVista(v)}
              className="px-4 h-8 rounded-full text-sm font-medium transition-colors capitalize"
              style={{
                background: vista === v ? "var(--accent)" : "transparent",
                color: vista === v ? "var(--accent-on)" : "var(--text-secondary)",
              }}
            >
              {v === "actuales" ? "Actuales" : "Cerradas"}
            </button>
          ))}
        </div>
        <PortfolioFilterBar onOpenFilters={() => setShowFilters(true)} />
      </div>

      {vista === "cerradas" ? (
        <div id="panel-cerradas" role="tabpanel" aria-labelledby="tab-cerradas" className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatTile label="Actuales" value={String(positions.length)} />
            <StatTile label="Cerradas" value={String(trades.length)} />
            <StatTile label="P&L no realizado" value={fmt(totalUnrealizedPnl)} tone="auto" />
            <StatTile label="P&L realizado" value={fmt(totalRealizedPnl)} tone="auto" />
            <StatTile label="P&L total" value={fmt(totalPnl)} tone="auto" />
          </div>
          <section>
            <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Ganancia tomada
            </h2>
            <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
              Cuánto llevás realizado, por período, por activo y en el tiempo.
            </p>
            <RealizedPnlSection trades={trades} dividends={filteredDividends} ccl={data.ccl} />
          </section>
        </div>
      ) : (
        <div id="panel-actuales" role="tabpanel" aria-labelledby="tab-actuales" className="flex flex-col gap-6">
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Concentración
            </span>
            {concentration ? (
              <>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {formatShare(concentration.topSharePct)}
                  </span>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                    top {concentration.n} activos
                  </span>
                </div>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  {concentration.topTickers.join(", ")}
                </p>
                {concentration.topSharePct >= 60 && (
                  <p className="flex items-center gap-1.5 text-sm font-medium mt-1" style={{ color: "var(--text-primary)" }}>
                    <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--status-warning)" }} />
                    Concentración alta
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Sin posiciones valuadas todavía.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile label={`Valor actual (${currency})`} value={fmt(totalValue)} sublabel="Mercado actual" />
            <StatTile label={`Costo histórico (${currency})`} value={fmt(totalCost)} sublabel="Base de costo según transacciones" />
            <StatTile
              label="Ganancia neta"
              value={netGain != null ? fmt(netGain) : "—"}
              tone="auto"
              sublabel={netGain == null ? "Sin costo histórico" : "No realiz. + realiz. + dividendos"}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatTile
              label="Total en activos"
              value={fmt(totalValue)}
              sublabel={`${positions.length} posiciones · sin efectivo ni dividendos`}
            />
            <StatTile
              label="Total en liquidez"
              value={fmt(totalCash)}
              sublabel={cash.length === 0 ? "Sin efectivo registrado" : `${cash.length} saldo(s) cargado(s)`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              label="TIR anualizada"
              value={xirr != null ? formatPct(xirr) : "—"}
              sublabel={xirr == null ? "Datos insuficientes" : undefined}
              delta={xirr != null ? { text: formatPct(xirr), positive: xirr >= 0 } : null}
            />
            <StatTile
              label="Retorno total"
              value={totalPnlPct != null ? formatPct(totalPnlPct) : "—"}
              sublabel={totalPnlPct == null ? "Sin costo histórico" : "Realiz. + no realiz."}
            />
            <StatTile
              label="P&L no realizado"
              value={fmt(totalUnrealizedPnl)}
              tone="auto"
              delta={totalPnlPct != null ? { text: formatPct(totalPnlPct), positive: totalPnlPct >= 0 } : null}
              sublabel="Sobre costo histórico"
            />
            <StatTile
              label="Variación de hoy"
              value={totalDayChange != null ? fmt(totalDayChange) : "—"}
              tone="auto"
              delta={totals.totalDayChangePct != null ? { text: formatPct(totals.totalDayChangePct), positive: totals.totalDayChangePct >= 0 } : null}
              sublabel={totalDayChange == null ? "Sin datos hoy" : "Vs. cierre anterior"}
            />
          </div>

          <section className="rounded-lg border p-5 sm:p-6" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
            <h2 className="text-lg font-semibold">Distribución del portafolio</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Mirá la exposición por activo, broker, tipo o moneda.</p>
            <div className="mt-5"><AllocationBar positions={positions} /></div>
          </section>

          <section className="border-t pt-5" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-lg font-semibold">Posiciones actuales</h2>
            <div className="mt-5"><PositionsTable positions={positions} ccl={data.ccl} /></div>
          </section>
        </div>
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
