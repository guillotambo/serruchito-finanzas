"use client";

import { useMemo, useState } from "react";
import { buildRealizedSummary, AMOUNT_MASK, formatArs as formatArsRaw, formatNumber, formatPct, formatUsd as formatUsdRaw } from "@serruchito/core";
import type { Dividend, RealizedPeriod, RealizedTrade } from "@serruchito/core";
import { useCurrency } from "@/lib/currency-context";
import { useHideAmounts } from "@/lib/privacy-context";
import { StatTile } from "@/components/StatTile";
import { ClosedPositionsTable } from "@/components/ClosedPositionsTable";
import { RealizedCumulativeChart } from "@/components/RealizedCumulativeChart";

const PERIODS: { id: RealizedPeriod; label: string }[] = [
  { id: "month", label: "Este mes" },
  { id: "year", label: "Este año" },
  { id: "all", label: "Histórico" },
];

type ViewMode = "detalle" | "ticker";

function PillGroup<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className="text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer"
          style={{
            background: value === o.id ? "var(--text-primary)" : "var(--gridline)",
            color: value === o.id ? "var(--surface-1)" : "var(--text-secondary)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Panel de "ganancia tomada": a diferencia del tile global "P&L realizado"
// de la cabecera de /posiciones (que siempre es histórico completo), esta
// sección filtra por período y agrega tres lecturas más -> por ticker,
// curva acumulada, y el total sumando dividendos cobrados.
export function RealizedPnlSection({ trades, dividends, ccl }: { trades: RealizedTrade[]; dividends: Dividend[]; ccl: number | null }) {
  const { currency } = useCurrency();
  const { hidden } = useHideAmounts();
  const [period, setPeriod] = useState<RealizedPeriod>("all");
  const [view, setView] = useState<ViewMode>("detalle");

  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;
  const formatUsd = hidden ? () => AMOUNT_MASK : formatUsdRaw;
  const fmt = currency === "USD" ? formatUsd : formatArs;

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const summary = useMemo(
    () => buildRealizedSummary({ trades, dividends, ccl, period, today }),
    [trades, dividends, ccl, period, today]
  );

  const realizedPnl = currency === "USD" ? summary.realizedPnlUsd : summary.realizedPnlArs;
  const dividendsTotal = currency === "USD" ? summary.dividendsUsd : summary.dividendsArs;
  const totalCashed = currency === "USD" ? summary.totalCashedUsd : summary.totalCashedArs;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PillGroup options={PERIODS} value={period} onChange={setPeriod} />
        <PillGroup
          options={[
            { id: "detalle" as ViewMode, label: "Detalle" },
            { id: "ticker" as ViewMode, label: "Por activo" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="P&L realizado" value={fmt(realizedPnl)} tone="auto" />
        <StatTile label="Dividendos cobrados" value={fmt(dividendsTotal)} tone="auto" />
        <StatTile label="Total tomado" value={fmt(totalCashed)} tone="auto" sublabel="Realizado + dividendos" />
        <StatTile label="Ganadoras / perdedoras" value={`${summary.winners} / ${summary.losers}`} />
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Las conversiones ARS/USD de cada movimiento usan el dólar CCL del momento en que se cargó la
        transacción o el dividendo, no un tipo de cambio histórico exacto de esa fecha.
      </p>

      {view === "detalle" ? (
        <ClosedPositionsTable trades={summary.trades} />
      ) : (
        <ByTickerTable summary={summary} fmt={fmt} />
      )}

      <div>
        <h3 className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
          Evolución acumulada
        </h3>
        <RealizedCumulativeChart points={summary.cumulative} />
      </div>
    </div>
  );
}

function ByTickerTable({ summary, fmt }: { summary: ReturnType<typeof buildRealizedSummary>; fmt: (v: number | null | undefined) => string }) {
  if (summary.byTicker.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Todavía no hay ventas cerradas en este período.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ borderBottom: "1px solid var(--border)" }}>
            <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              Activo
            </th>
            <th scope="col" className="px-3 py-2 font-medium text-right whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              Ventas
            </th>
            <th scope="col" className="px-3 py-2 font-medium text-right whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              Cantidad
            </th>
            <th scope="col" className="px-3 py-2 font-medium text-right whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              P&L realiz.
            </th>
            <th scope="col" className="px-3 py-2 font-medium text-right whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {summary.byTicker.map((t) => {
            const positive = (t.pnlArs ?? 0) >= 0;
            const rowTint = positive
              ? "color-mix(in srgb, var(--status-good) 5%, transparent)"
              : "color-mix(in srgb, var(--status-critical) 5%, transparent)";
            return (
              <tr key={t.ticker} style={{ borderBottom: "1px solid var(--border)", background: rowTint }}>
                <td className="px-3 py-2 font-medium" style={{ color: "var(--text-primary)" }}>
                  {t.ticker}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{t.tradeCount}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(t.quantity)}</td>
                <td
                  className="px-3 py-2 text-right tabular-nums font-medium"
                  style={{ color: positive ? "var(--status-good)" : "var(--status-critical)" }}
                >
                  {fmt(t.pnlArs)}
                </td>
                <td
                  className="px-3 py-2 text-right tabular-nums font-medium"
                  style={{ color: t.pnlPct == null ? "var(--text-muted)" : positive ? "var(--status-good)" : "var(--status-critical)" }}
                >
                  {formatPct(t.pnlPct)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
