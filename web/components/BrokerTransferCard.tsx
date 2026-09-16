"use client";

import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { useTransactions } from "@/lib/hooks";
import { BROKERS, BROKER_LABELS } from "@serruchito/core";
import type { Broker } from "@serruchito/core";

const inputStyle: React.CSSProperties = {
  borderColor: "var(--border)",
  background: "var(--surface-1)",
  color: "var(--text-primary)",
};

/**
 * Reasigna en bloque las transacciones de un broker a otro (ej. "moví todo
 * de Cocos a IOL"). Ver web/app/api/transactions/move-broker/route.ts: es un
 * UPDATE del campo `broker`, no un registro nuevo, así que preserva fechas,
 * PPC y P&L exactos (el motor de packages/core/src/portfolio.ts recalcula
 * todo desde las transacciones). No mueve dividendos ni saldos de efectivo.
 */
export function BrokerTransferCard() {
  const { mutate } = useSWRConfig();
  const { data: transactions } = useTransactions();
  const [from, setFrom] = useState<Broker>("cocos");
  const [to, setTo] = useState<Broker>("iol");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ moved: number; tickers: string[] } | null>(null);

  const preview = useMemo(() => {
    const matches = transactions?.filter((t) => t.broker === from) ?? [];
    const tickers = [...new Set(matches.map((t) => t.ticker))].sort();
    return { count: matches.length, tickers };
  }, [transactions, from]);

  const disabled = submitting || from === to || preview.count === 0;

  async function handleTransfer() {
    setError(null);
    setResult(null);
    if (
      !confirm(
        `Se van a reasignar ${preview.count} movimiento${preview.count === 1 ? "" : "s"} de ${BROKER_LABELS[from]} a ${BROKER_LABELS[to]}. Los movimientos históricos van a figurar como hechos en ${BROKER_LABELS[to]}. Esta acción no se puede deshacer (salvo transfiriendo de vuelta).`
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions/move-broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "No se pudo transferir el broker.");
      }
      const data = await res.json();
      await mutate("/api/transactions");
      await mutate("/api/portfolio");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm flex-1">
          <span style={{ color: "var(--text-secondary)" }}>Desde</span>
          <select value={from} onChange={(e) => setFrom(e.target.value as Broker)} className="rounded-md border px-2 py-1.5" style={inputStyle}>
            {BROKERS.map((b) => (
              <option key={b} value={b}>
                {BROKER_LABELS[b]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm flex-1">
          <span style={{ color: "var(--text-secondary)" }}>Hacia</span>
          <select value={to} onChange={(e) => setTo(e.target.value as Broker)} className="rounded-md border px-2 py-1.5" style={inputStyle}>
            {BROKERS.map((b) => (
              <option key={b} value={b}>
                {BROKER_LABELS[b]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {preview.count === 0
          ? `No hay movimientos en ${BROKER_LABELS[from]}.`
          : `${preview.count} movimiento${preview.count === 1 ? "" : "s"} · ${preview.tickers.join(", ")}`}
      </p>

      <button
        type="button"
        onClick={handleTransfer}
        disabled={disabled}
        className="self-start rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 transition-colors hover:opacity-90"
        style={{ background: "var(--accent)", color: "var(--accent-on)" }}
      >
        {submitting ? "Transfiriendo…" : "Transferir"}
      </button>

      {error && (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      )}
      {result && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {`Listo: ${result.moved} movimiento${result.moved === 1 ? "" : "s"} transferido${result.moved === 1 ? "" : "s"}.`}
        </p>
      )}
    </div>
  );
}
