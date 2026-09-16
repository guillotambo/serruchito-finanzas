"use client";

import { useSWRConfig } from "swr";
import { useCashHoldings } from "@/lib/hooks";
import { ErrorState } from "@/components/ErrorState";
import { useMounted } from "@/lib/use-mounted";
import { BROKER_LABELS, formatNumber } from "@serruchito/core";

export function CashList() {
  const { data: cashHoldings, isLoading, error } = useCashHoldings();
  const { mutate } = useSWRConfig();
  // Ver TransactionsList.tsx: el cache de SWR persistido puede tener datos ya
  // en el primer render del cliente aunque el server haya renderizado
  // "Cargando…" -> mismatch de hidratación sin esto.
  const mounted = useMounted();

  async function handleDelete(id: number) {
    if (!confirm("¿Borrar este saldo?")) return;
    await fetch(`/api/cash/${id}`, { method: "DELETE" });
    await mutate("/api/cash");
    await mutate("/api/portfolio");
  }

  if (error) return <ErrorState message={error.message} onRetry={() => mutate("/api/cash")} />;
  if (!mounted || isLoading) return <p style={{ color: "var(--text-muted)" }}>Cargando…</p>;
  if (!cashHoldings || cashHoldings.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Todavía no cargaste ningún saldo.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
            <th className="px-3 py-2 font-medium">Etiqueta</th>
            <th className="px-3 py-2 font-medium">Broker</th>
            <th className="px-3 py-2 font-medium text-right">Monto</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {cashHoldings.map((c) => (
            <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="px-3 py-2 font-medium">{c.label}</td>
              <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>
                {c.broker ? (BROKER_LABELS[c.broker] ?? c.broker) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatNumber(c.amount)} {c.currency}
              </td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => handleDelete(c.id)} className="text-xs underline" style={{ color: "var(--text-muted)" }}>
                  Borrar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
