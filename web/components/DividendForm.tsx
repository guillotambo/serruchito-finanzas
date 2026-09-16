"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import type { Broker, Currency, Dividend } from "@serruchito/core";

const today = () => new Date().toISOString().slice(0, 10);

const inputStyle: React.CSSProperties = {
  borderColor: "var(--border)",
  background: "var(--surface-1)",
  color: "var(--text-primary)",
};

// Con `initial` el form edita en vez de dar de alta (PUT de reemplazo
// completo, igual que TransactionForm).
export function DividendForm({ initial, onDone }: { initial?: Dividend; onDone?: () => void } = {}) {
  const { mutate } = useSWRConfig();
  const [form, setForm] = useState({
    date: initial?.date ?? today(),
    broker: (initial?.broker ?? "cocos") as Broker,
    ticker: initial?.ticker ?? "",
    amount: initial ? String(initial.amount) : "",
    currency: (initial?.currency ?? "USD") as Currency,
    notes: initial?.notes ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = Number(form.amount);
    if (!form.ticker || amount < 0) {
      setError("Revisá ticker y monto.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(initial ? `/api/dividends/${initial.id}` : "/api/dividends", {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "No se pudo guardar el dividendo.");
      }
      await mutate("/api/dividends");
      await mutate("/api/portfolio");
      if (onDone) onDone();
      else setForm((prev) => ({ ...prev, ticker: "", amount: "", notes: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border p-4 grid grid-cols-2 sm:grid-cols-5 gap-3"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span style={{ color: "var(--text-secondary)" }}>Fecha</span>
        <input
          type="date"
          value={form.date}
          onChange={(e) => update("date", e.target.value)}
          className="rounded-md border px-2 py-1.5"
          style={inputStyle}
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span style={{ color: "var(--text-secondary)" }}>Broker</span>
        <select
          value={form.broker}
          onChange={(e) => update("broker", e.target.value as Broker)}
          className="rounded-md border px-2 py-1.5"
          style={inputStyle}
        >
          <option value="cocos">Cocos Capital</option>
          <option value="balanz">Balanz</option>
          <option value="ibkr">Interactive Brokers</option>
          <option value="iol">InvertirOnline</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span style={{ color: "var(--text-secondary)" }}>Ticker</span>
        <input
          type="text"
          value={form.ticker}
          onChange={(e) => update("ticker", e.target.value.toUpperCase())}
          className="rounded-md border px-2 py-1.5 uppercase"
          style={inputStyle}
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span style={{ color: "var(--text-secondary)" }}>Monto</span>
        <input
          type="number"
          step="any"
          min="0"
          value={form.amount}
          onChange={(e) => update("amount", e.target.value)}
          className="rounded-md border px-2 py-1.5"
          style={inputStyle}
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span style={{ color: "var(--text-secondary)" }}>Moneda</span>
        <select
          value={form.currency}
          onChange={(e) => update("currency", e.target.value as Currency)}
          className="rounded-md border px-2 py-1.5"
          style={inputStyle}
        >
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm col-span-2 sm:col-span-4">
        <span style={{ color: "var(--text-secondary)" }}>Notas (opcional)</span>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          className="rounded-md border px-2 py-1.5"
          style={inputStyle}
        />
      </label>

      <div className="flex items-end">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 transition-colors hover:opacity-90"
          style={{ background: "var(--accent)", color: "var(--accent-on)" }}
        >
          {submitting ? "Guardando…" : initial ? "Guardar cambios" : "Agregar"}
        </button>
      </div>

      {error && (
        <p className="col-span-2 sm:col-span-5 text-sm" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
