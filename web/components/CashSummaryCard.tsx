"use client";

import { AMOUNT_MASK, BROKER_LABELS, formatNumber } from "@serruchito/core";
import type { CashHolding } from "@serruchito/core";
import { useHideAmounts } from "@/lib/privacy-context";

// Vista de solo lectura (sin borrar/editar, eso vive en Movimientos): la
// idea es que el efectivo que se suma al patrimonio del dashboard sea
// rastreable a simple vista, no un número que aparece de la nada en la card
// de arriba.
export function CashSummaryCard({ cashHoldings }: { cashHoldings: CashHolding[] }) {
  const { hidden } = useHideAmounts();
  if (cashHoldings.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Todavía no cargaste efectivo ni otros saldos.{" "}
        <a href="/movimientos" className="underline">
          Agregar uno
        </a>
        .
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {cashHoldings.map((c) => (
        <li key={c.id} className="flex items-center justify-between text-sm">
          <span style={{ color: "var(--text-primary)" }}>
            {c.label}
            {c.broker && (
              <span className="ml-1.5" style={{ color: "var(--text-muted)" }}>
                · {BROKER_LABELS[c.broker] ?? c.broker}
              </span>
            )}
          </span>
          <span className="tabular-nums font-medium" style={{ color: "var(--text-secondary)" }}>
            {hidden ? AMOUNT_MASK : `${formatNumber(c.amount)} ${c.currency}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
