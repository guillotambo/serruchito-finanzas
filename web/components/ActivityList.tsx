"use client";

import { Fragment } from "react";
import { ArrowRight } from "lucide-react";
import {
  ACTIVITY_KIND_LABELS,
  AMOUNT_MASK,
  BROKER_LABELS,
  formatActivityDay,
  formatArs as formatArsRaw,
  formatNumber,
  formatUsd as formatUsdRaw,
} from "@serruchito/core";
import type { ActivityEvent, ActivityKind } from "@serruchito/core";
import { EmptyState } from "@/components/ui/EmptyState";
import { useHideAmounts } from "@/lib/privacy-context";

// Color de estado por tipo de movimiento. Misma convención que ya usaban
// TransactionsList (compra verde / venta roja) y DividendsList (cobro verde):
// acá señala el tipo de operación, no el signo de un P&L. "cash" es un saldo,
// no un flujo -> queda neutro.
const KIND_STATUS: Record<ActivityKind, string | null> = {
  buy: "var(--status-good)",
  sell: "var(--status-critical)",
  dividend: null,
  cash: null,
};

/**
 * Feed de actividad: una tabla por día, con un encabezado por fecha para que
 * se lea como un historial y no como una planilla. Cada fila abre el detalle
 * del movimiento, que es donde viven las acciones (editar, borrar) y el
 * resultado de la operación.
 */
export function ActivityList({
  events,
  todayIso,
  hasFilters,
  onSelect,
}: {
  events: ActivityEvent[];
  todayIso: string;
  hasFilters: boolean;
  onSelect: (event: ActivityEvent) => void;
}) {
  const { hidden } = useHideAmounts();
  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;
  const formatUsd = hidden ? () => AMOUNT_MASK : formatUsdRaw;

  if (events.length === 0) {
    return hasFilters ? (
      <EmptyState
        title="Ningún movimiento coincide con estos filtros"
        description="Probá ampliar el período o sacar alguno de los filtros activos."
      />
    ) : (
      <EmptyState
        title="Todavía no hay actividad"
        description="Cuando cargues transacciones, dividendos o saldos de efectivo, van a aparecer acá. Si tenés muchas, podés importarlas desde una planilla en Ajustes."
      />
    );
  }

  const days = groupByDay(events);

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ borderBottom: "1px solid var(--border)" }}>
            <Th>Tipo</Th>
            <Th>Detalle</Th>
            <Th>Broker</Th>
            <Th align="right">Cantidad</Th>
            <Th align="right">Precio</Th>
            <Th align="right">Monto</Th>
            <Th></Th>
          </tr>
        </thead>

        {days.map(([date, dayEvents]) => (
          <Fragment key={date}>
            <tbody>
              <tr className="activity-day-header">
                <td colSpan={7} className="px-3 py-1.5 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {formatActivityDay(date, todayIso)}
                </td>
              </tr>
            </tbody>
            <tbody>
              {dayEvents.map((e) => {
                const status = KIND_STATUS[e.kind];
                const fmt = e.currency === "ARS" ? formatArs : formatUsd;
                return (
                  <tr
                    key={e.key}
                    className="activity-row cursor-pointer"
                    tabIndex={0}
                    onClick={() => onSelect(e)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(e);
                      }
                    }}
                    aria-label={`Ver detalle de ${ACTIVITY_KIND_LABELS[e.kind].toLowerCase()} de ${e.title}`}
                    style={
                      {
                        "--row-status": status ?? "var(--text-primary)",
                        "--row-tint": status ? `color-mix(in srgb, ${status} 5%, transparent)` : "transparent",
                      } as React.CSSProperties
                    }
                  >
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: status ?? "var(--text-secondary)" }}>
                      {ACTIVITY_KIND_LABELS[e.kind]}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {e.title}
                      </span>
                      {e.notes && (
                        <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                          {e.notes}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {e.broker ? (BROKER_LABELS[e.broker] ?? e.broker) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {e.quantity == null ? "—" : formatNumber(e.quantity)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {e.price == null ? "—" : fmt(e.price)}
                    </td>
                    <td
                      className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap"
                      style={{ color: e.kind === "dividend" ? "var(--status-good)" : "var(--text-primary)" }}
                    >
                      {e.kind === "dividend" && !hidden ? "+" : ""}
                      {fmt(e.amount)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ArrowRight aria-hidden="true" size={15} style={{ color: "var(--text-muted)" }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Fragment>
        ))}
      </table>
    </div>
  );
}

// El feed ya viene ordenado por fecha descendente desde buildActivityFeed, así
// que alcanza con cortar cuando cambia el día: no hace falta reordenar ni usar
// un Map intermedio.
function groupByDay(events: ActivityEvent[]): [string, ActivityEvent[]][] {
  const days: [string, ActivityEvent[]][] = [];
  for (const event of events) {
    const last = days.at(-1);
    if (last && last[0] === event.date) last[1].push(event);
    else days.push([event.date, [event]]);
  }
  return days;
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 font-medium whitespace-nowrap ${align === "right" ? "text-right" : ""}`}
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </th>
  );
}
