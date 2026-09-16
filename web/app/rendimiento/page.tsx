"use client";

import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { useLiveSnapshotSeries, useSnapshots, useTransactions, useDividends } from "@/lib/hooks";
import {
  computePeriodReturn,
  computeWeeklyPnl,
  computeBenchmarkComparison,
  computeTwr,
  computeXirr,
  computeVolatility,
  computeMaxDrawdown,
  computeFeesSummary,
  computeHHI,
  computeConcentrationByDimension,
  computeDividendMetrics,
  AMOUNT_MASK,
  BROKER_LABELS,
  CURRENCY_LABELS,
  formatArs as formatArsRaw,
  formatUsd as formatUsdRaw,
  formatPct,
  formatShare,
} from "@serruchito/core";
import { StatTile } from "@/components/StatTile";
import { PortfolioHistoryChart, type Range } from "@/components/PortfolioHistoryChart";
import { WeeklyPnlChart } from "@/components/WeeklyPnlChart";
import { DividendCalendarChart } from "@/components/DividendCalendarChart";
import { useHideAmounts } from "@/lib/privacy-context";

type PeriodId = "diario" | "semanal" | "mensual" | "anual" | "historial";

const PERIODS: { id: PeriodId; label: string; windowDays: number | null; chartRange: Range }[] = [
  { id: "diario", label: "Diario", windowDays: 1, chartRange: "7d" },
  { id: "semanal", label: "Semanal", windowDays: 7, chartRange: "7d" },
  { id: "mensual", label: "Mensual", windowDays: 30, chartRange: "30d" },
  { id: "anual", label: "Anual", windowDays: 365, chartRange: "ytd" },
  { id: "historial", label: "Historial", windowDays: null, chartRange: "all" },
];

export default function RendimientoPage() {
  // Misma serie (snapshots guardados + punto en vivo) que usa el chart del
  // Dashboard -> ver lib/hooks.ts, única fuente de verdad para que ambas
  // pantallas muestren siempre la misma curva.
  const { seriesWithLive, liveDate, snapshots, portfolio } = useLiveSnapshotSeries();
  const { data: allSnapshots } = useSnapshots();
  const { data: transactions } = useTransactions();
  const { data: dividends } = useDividends();
  const { mutate } = useSWRConfig();
  const { hidden } = useHideAmounts();
  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;
  const formatUsd = hidden ? () => AMOUNT_MASK : formatUsdRaw;
  const [periodId, setPeriodId] = useState<PeriodId>("mensual");
  const period = PERIODS.find((p) => p.id === periodId)!;
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const periodReturn = useMemo(() => computePeriodReturn(seriesWithLive, period.windowDays), [seriesWithLive, period.windowDays]);
  // El retorno "Diario" no necesita 2 snapshots: la variación intradía
  // (precio actual vs. cierre de ayer) ya viene calculada en el portfolio
  // (totalDayChangeArs/Pct) sin depender de ningún snapshot guardado.
  const dailyReturn = portfolio
    ? { changeArs: portfolio.totalDayChangeArs, changePct: portfolio.totalDayChangePct }
    : null;
  const displayedReturn = periodId === "diario" ? dailyReturn : periodReturn;

  const weeklyPnl = useMemo(() => computeWeeklyPnl(seriesWithLive), [seriesWithLive]);

  // Sección "análisis": absorbida de la ex-pestaña Portfolio/Análisis
  // (mismos cálculos, movidos acá porque son de performance, no de tenencia).
  const benchmark = useMemo(() => computeBenchmarkComparison(allSnapshots ?? [], null), [allSnapshots]);
  const twr = useMemo(() => computeTwr(allSnapshots ?? []), [allSnapshots]);
  const xirr = useMemo(() => {
    if (!portfolio || !transactions || !dividends) return null;
    return computeXirr({ transactions, dividends, currentValueArs: portfolio.totalValueArs, ccl: portfolio.ccl });
  }, [portfolio, transactions, dividends]);
  const volatility = useMemo(() => computeVolatility(allSnapshots ?? []), [allSnapshots]);
  const maxDrawdown = useMemo(() => computeMaxDrawdown(allSnapshots ?? []), [allSnapshots]);
  const fees = useMemo(() => (transactions ? computeFeesSummary(transactions, portfolio?.ccl ?? null) : null), [transactions, portfolio]);
  const hhi = useMemo(() => (portfolio ? computeHHI(portfolio.positions) : null), [portfolio]);
  const byBroker = useMemo(() => (portfolio ? computeConcentrationByDimension(portfolio.positions, "broker") : []), [portfolio]);
  const byCurrency = useMemo(() => (portfolio ? computeConcentrationByDimension(portfolio.positions, "currency") : []), [portfolio]);
  const dividendMetrics = useMemo(() => {
    if (!portfolio || !dividends) return null;
    return computeDividendMetrics({ dividends, totalCostArs: portfolio.totalCostArs, totalValueArs: portfolio.totalValueArs, ccl: portfolio.ccl });
  }, [portfolio, dividends]);

  // Fallback para cuando el portfolio en vivo todavía no cargó: último
  // snapshot guardado.
  const latestSnapshot = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return null;
    return [...snapshots].sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [snapshots]);

  async function handleSaveSnapshot() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual: true }),
      });
      if (!res.ok) throw new Error(`respondió ${res.status}`);
      await mutate("/api/snapshots");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Rendimiento
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Cómo rindió tu plata: hoy, esta semana, este mes, este año e histórico, con el detalle de cuánto
          ganaste en cada tramo.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap p-0.5 rounded-full self-start" style={{ background: "var(--gridline)" }} role="tablist">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`period-tab-${p.id}`}
              aria-selected={periodId === p.id}
              aria-controls="period-panel"
              onClick={() => setPeriodId(p.id)}
              className="px-4 h-8 rounded-full text-sm font-medium transition-colors"
              style={{
                background: periodId === p.id ? "var(--accent)" : "transparent",
                color: periodId === p.id ? "var(--accent-on)" : "var(--text-secondary)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSaveSnapshot}
          disabled={saveState === "saving"}
          className="text-sm px-3 h-8 rounded-full font-medium transition-colors disabled:opacity-60"
          style={{ background: "var(--gridline)", color: "var(--text-secondary)" }}
        >
          {saveState === "saving"
            ? "Guardando…"
            : saveState === "saved"
              ? "Foto guardada ✓"
              : saveState === "error"
                ? "No se pudo guardar — reintentar"
                : "Guardar foto ahora"}
        </button>
      </div>

      <div id="period-panel" role="tabpanel" aria-labelledby={`period-tab-${periodId}`} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatTile
            label={`Retorno ${period.label.toLowerCase()}`}
            value={displayedReturn ? formatArs(displayedReturn.changeArs) : "—"}
            tone="auto"
            sublabel={displayedReturn ? undefined : "Sin datos para este período"}
            delta={
              displayedReturn?.changePct != null
                ? { text: formatPct(displayedReturn.changePct), positive: displayedReturn.changePct >= 0 }
                : null
            }
          />
          <StatTile
            label="Retorno %"
            value={displayedReturn?.changePct != null ? formatPct(displayedReturn.changePct) : "—"}
            sublabel={displayedReturn?.changePct == null ? "Sin datos para este período" : undefined}
          />
          <StatTile
            label="Valor actual"
            value={portfolio ? formatArs(portfolio.totalValueArs) : latestSnapshot ? formatArs(latestSnapshot.total_value_ars) : "—"}
            sublabel={portfolio ? "En vivo · ahora" : latestSnapshot ? `Snapshot del ${latestSnapshot.date}` : "Sin snapshots todavía"}
          />
        </div>

        <section className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
          <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Evolución del valor
          </h2>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Cómo se movió tu portafolio en el período {period.label.toLowerCase()}
          </p>
          <PortfolioHistoryChart
            key={periodId}
            snapshots={seriesWithLive}
            broker="all"
            defaultRange={period.chartRange}
            liveDate={liveDate}
          />
        </section>

        <section className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
          <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Ganancia por semana
          </h2>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Cuánto ganaste o perdiste cada semana
          </p>
          <WeeklyPnlChart weeks={weeklyPnl} />
        </section>

        <section>
          <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
            Contra el mercado
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label="Tu cartera (histórico, USD)"
              value={benchmark ? formatPct(benchmark.portfolioReturnPct) : "—"}
              sublabel={benchmark ? `desde ${benchmark.baselineDate}` : "Datos insuficientes"}
              delta={benchmark ? { text: formatPct(benchmark.portfolioReturnPct), positive: benchmark.portfolioReturnPct >= 0 } : null}
            />
            <StatTile
              label="S&P 500 (mismo período)"
              value={benchmark ? formatPct(benchmark.benchmarkReturnPct) : "—"}
              sublabel={benchmark ? undefined : "Datos insuficientes"}
              delta={benchmark ? { text: formatPct(benchmark.benchmarkReturnPct), positive: benchmark.benchmarkReturnPct >= 0 } : null}
            />
            <StatTile
              label="Diferencia"
              value={benchmark ? `${benchmark.diffPp >= 0 ? "+" : ""}${benchmark.diffPp.toFixed(2)} pp` : "—"}
              sublabel={benchmark ? "En USD, no aísla aportes/retiros" : "Datos insuficientes"}
              delta={benchmark ? { text: benchmark.diffPp >= 0 ? "le ganás al mercado" : "el mercado te gana", positive: benchmark.diffPp >= 0 } : null}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
            Retorno: TIR vs. TWR
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatTile
              label="TIR anualizada (XIRR)"
              value={xirr != null ? formatPct(xirr) : "—"}
              sublabel="Tu experiencia real, según cuándo aportaste"
            />
            <StatTile
              label="TWR anualizado"
              value={twr != null ? formatPct(twr) : "—"}
              sublabel={twr == null ? "Datos insuficientes (necesita más historial mensual)" : "Neutraliza el efecto de tus aportes"}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
            Riesgo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatTile
              label="Volatilidad"
              value={volatility != null ? formatPct(volatility) : "—"}
              sublabel={volatility == null ? "Datos insuficientes" : "Anualizada (mensual × √12)"}
            />
            <StatTile
              label="Caída máxima"
              value={maxDrawdown != null ? formatPct(maxDrawdown) : "—"}
              sublabel={maxDrawdown == null ? "Datos insuficientes" : "Pérdida máx. desde pico"}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
            Costos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatTile
              label="Comisiones pagadas"
              value={fees ? formatArs(fees.totalArs) : "—"}
              sublabel={fees?.totalUsd != null ? formatUsd(fees.totalUsd) : undefined}
            />
            <StatTile
              label="Comisiones sobre lo comprado"
              value={fees?.pctOfCostBasis != null ? formatShare(fees.pctOfCostBasis) : "—"}
              sublabel="% del bruto invertido en compras"
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
            Concentración
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label="Índice HHI"
              value={hhi ? hhi.hhi.toFixed(0) : "—"}
              sublabel={hhi ? hhi.interpretation : "Sin posiciones valuadas"}
            />
            <div className="rounded-lg border p-4 flex flex-col gap-1.5" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Por broker
              </span>
              {byBroker.length === 0 ? (
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  —
                </span>
              ) : (
                byBroker.map((e) => (
                  <div key={e.key} className="flex items-baseline justify-between text-sm">
                    <span style={{ color: "var(--text-primary)" }}>{BROKER_LABELS[e.key] ?? e.key}</span>
                    <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {formatShare(e.sharePct)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="rounded-lg border p-4 flex flex-col gap-1.5" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Por moneda
              </span>
              {byCurrency.length === 0 ? (
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  —
                </span>
              ) : (
                byCurrency.map((e) => (
                  <div key={e.key} className="flex items-baseline justify-between text-sm">
                    <span style={{ color: "var(--text-primary)" }}>{CURRENCY_LABELS[e.key] ?? e.key}</span>
                    <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {formatShare(e.sharePct)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
            Dividendos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <StatTile
              label="Ingreso últimos 12 meses"
              value={dividendMetrics ? formatArs(dividendMetrics.income12mArs) : "—"}
              sublabel={dividendMetrics?.income12mUsd != null ? formatUsd(dividendMetrics.income12mUsd) : undefined}
            />
            <StatTile
              label="Yield on cost"
              value={dividendMetrics?.yieldOnCostPct != null ? formatShare(dividendMetrics.yieldOnCostPct) : "—"}
              sublabel="Sobre el costo histórico"
            />
            <StatTile
              label="Yield actual"
              value={dividendMetrics?.currentYieldPct != null ? formatShare(dividendMetrics.currentYieldPct) : "—"}
              sublabel="Sobre el valor de mercado"
            />
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
            <h3 className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              Calendario histórico de cobros
            </h3>
            <DividendCalendarChart months={dividendMetrics?.byMonth ?? []} />
          </div>
        </section>
      </div>
    </div>
  );
}
