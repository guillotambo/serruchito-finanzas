"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { useInstruments } from "@/lib/hooks";
import { useMounted } from "@/lib/use-mounted";
import type { AssetType, Broker, Currency, Side, Transaction } from "@serruchito/core";

const today = () => new Date().toISOString().slice(0, 10);

const inputStyle: React.CSSProperties = {
  borderColor: "var(--border)",
  background: "var(--surface-1)",
  color: "var(--text-primary)",
};

/**
 * Alta y edición de una transacción. Con `initial` el form arranca cargado y
 * hace PUT en vez de POST; el PUT es un reemplazo completo (ver la route), así
 * que siempre se manda el registro entero, nunca un patch.
 */
export function TransactionForm({ initial, onDone }: { initial?: Transaction; onDone?: () => void } = {}) {
  const { mutate } = useSWRConfig();
  const { data: instruments } = useInstruments();
  // El cache de SWR persistido en localStorage puede tener `instruments` ya
  // en el primer render del cliente aunque el server (sin ese cache) haya
  // renderizado el <datalist> vacío -> mismatch de hidratación sin esto (ver
  // lib/use-mounted.ts). El resto del form no depende de datos remotos, así
  // que solo hace falta acá.
  const mounted = useMounted();
  const [form, setForm] = useState({
    date: initial?.date ?? today(),
    broker: (initial?.broker ?? "cocos") as Broker,
    ticker: initial?.ticker ?? "",
    asset_type: (initial?.asset_type ?? "cedear") as AssetType,
    side: (initial?.side ?? "buy") as Side,
    quantity: initial ? String(initial.quantity) : "",
    price: initial ? String(initial.price) : "",
    currency: (initial?.currency ?? "ARS") as Currency,
    fees: initial ? String(initial.fees) : "0",
    notes: initial?.notes ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleTickerBlur() {
    const known = instruments?.find((i) => i.ticker === form.ticker.toUpperCase());
    if (known) {
      update("asset_type", known.asset_type);
      if (known.asset_type === "stock_us" || known.asset_type === "etf") update("currency", "USD");
      if (known.asset_type === "cedear" || known.asset_type === "accion_arg") update("currency", "ARS");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const quantity = Number(form.quantity);
    const price = Number(form.price);
    const fees = Number(form.fees || 0);
    if (!form.ticker || quantity <= 0 || price < 0) {
      setError("Revisá ticker, cantidad y precio.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(initial ? `/api/transactions/${initial.id}` : "/api/transactions", {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, quantity, price, fees }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "No se pudo guardar la transacción.");
      }
      await mutate("/api/transactions");
      await mutate("/api/portfolio");
      // Al editar el form se cierra; al dar de alta se vacía para seguir
      // cargando (el caso típico es entrar varias operaciones seguidas).
      if (onDone) onDone();
      else setForm((prev) => ({ ...prev, ticker: "", quantity: "", price: "", notes: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border p-4 grid grid-cols-2 sm:grid-cols-4 gap-3"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      <label className="flex flex-col gap-1 text-sm col-span-1">
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

      <label className="flex flex-col gap-1 text-sm col-span-1">
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

      <label className="flex flex-col gap-1 text-sm col-span-1">
        <span style={{ color: "var(--text-secondary)" }}>Ticker</span>
        <input
          type="text"
          list="instrument-tickers"
          value={form.ticker}
          onChange={(e) => update("ticker", e.target.value.toUpperCase())}
          onBlur={handleTickerBlur}
          placeholder="SPY"
          className="rounded-md border px-2 py-1.5 uppercase"
          style={inputStyle}
          required
        />
        <datalist id="instrument-tickers">
          {mounted && instruments?.map((i) => (
            <option key={i.ticker} value={i.ticker} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1 text-sm col-span-1">
        <span style={{ color: "var(--text-secondary)" }}>Tipo</span>
        <select
          value={form.asset_type}
          onChange={(e) => update("asset_type", e.target.value as AssetType)}
          className="rounded-md border px-2 py-1.5"
          style={inputStyle}
        >
          <option value="cedear">CEDEAR</option>
          <option value="accion_arg">Acción AR</option>
          <option value="stock_us">Acción US</option>
          <option value="etf">ETF</option>
          <option value="bono">Bono</option>
          <option value="otro">Otro</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm col-span-1">
        <span style={{ color: "var(--text-secondary)" }}>Operación</span>
        <select
          value={form.side}
          onChange={(e) => update("side", e.target.value as Side)}
          className="rounded-md border px-2 py-1.5"
          style={inputStyle}
        >
          <option value="buy">Compra</option>
          <option value="sell">Venta</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm col-span-1">
        <span style={{ color: "var(--text-secondary)" }}>Cantidad</span>
        <input
          type="number"
          step="any"
          min="0"
          value={form.quantity}
          onChange={(e) => update("quantity", e.target.value)}
          className="rounded-md border px-2 py-1.5"
          style={inputStyle}
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm col-span-1">
        <span style={{ color: "var(--text-secondary)" }}>Precio</span>
        <input
          type="number"
          step="any"
          min="0"
          value={form.price}
          onChange={(e) => update("price", e.target.value)}
          className="rounded-md border px-2 py-1.5"
          style={inputStyle}
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm col-span-1">
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

      <label className="flex flex-col gap-1 text-sm col-span-1">
        <span style={{ color: "var(--text-secondary)" }}>Comisiones</span>
        <input
          type="number"
          step="any"
          min="0"
          value={form.fees}
          onChange={(e) => update("fees", e.target.value)}
          className="rounded-md border px-2 py-1.5"
          style={inputStyle}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm col-span-2 sm:col-span-3">
        <span style={{ color: "var(--text-secondary)" }}>Notas (opcional)</span>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          className="rounded-md border px-2 py-1.5"
          style={inputStyle}
        />
      </label>

      <div className="col-span-2 sm:col-span-1 flex items-end">
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
        <p className="col-span-2 sm:col-span-4 text-sm" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
