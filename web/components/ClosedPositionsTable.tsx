"use client";

import { AMOUNT_MASK, BROKER_LABELS, formatArs as formatArsRaw, formatNumber, formatPct, formatUsd as formatUsdRaw } from "@serruchito/core";
import type { RealizedTrade } from "@serruchito/core";
import { useHideAmounts } from "@/lib/privacy-context";

// Ledger de ventas cerradas: a diferencia de PositionsTable (posiciones
// abiertas, con sort interactivo), esto es un historial -> orden fijo, más
// reciente primero (ya viene ordenado así desde buildPortfolioSummary).
export function ClosedPositionsTable({ trades }: { trades: RealizedTrade[] }) {
  const { hidden } = useHideAmounts();
  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;
  const formatUsd = hidden ? () => AMOUNT_MASK : formatUsdRaw;
  if (trades.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Todavía no hay posiciones cerradas con movimientos económicos.
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
            <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              Broker
            </th>
            <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              Fecha
            </th>
            <th scope="col" className="px-3 py-2 font-medium text-right whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              Cantidad
            </th>
            <th scope="col" className="px-3 py-2 font-medium text-right whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              Costo
            </th>
            <th scope="col" className="px-3 py-2 font-medium text-right whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              Venta
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
          {trades.map((t, i) => {
            const fmt = t.currency === "ARS" ? formatArs : formatUsd;
            const positive = t.pnlNative >= 0;
            const rowTint = positive
              ? "color-mix(in srgb, var(--status-good) 5%, transparent)"
              : "color-mix(in srgb, var(--status-critical) 5%, transparent)";
            return (
              <tr key={`${t.ticker}-${t.broker}-${t.date}-${i}`} style={{ borderBottom: "1px solid var(--border)", background: rowTint }}>
                <td className="px-3 py-2 font-medium" style={{ color: "var(--text-primary)" }}>
                  {t.ticker}
                </td>
                <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>
                  {BROKER_LABELS[t.broker] ?? t.broker}
                </td>
                <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                  {t.date}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(t.quantity)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(t.buyPrice)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(t.sellPrice)}</td>
                <td
                  className="px-3 py-2 text-right tabular-nums font-medium"
                  style={{ color: positive ? "var(--status-good)" : "var(--status-critical)" }}
                >
                  {fmt(t.pnlNative)}
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
