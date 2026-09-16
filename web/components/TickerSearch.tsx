"use client";

import { useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { ASSET_TYPE_LABELS } from "@serruchito/core";
import type { AssetType, InstrumentSearchResult } from "@serruchito/core";
import { useInstrumentSearch } from "@/lib/hooks";

const ASSET_TYPES: AssetType[] = ["cedear", "accion_arg", "stock_us", "etf", "bono", "otro"];

// Buscador de tickers para agregar a la watchlist. AAPL puede ser CEDEAR
// (Cocos) o acción US (IBKR) y solo el usuario sabe cuál quiere seguir -> el
// asset_type inferido por el buscador queda preseleccionado pero editable.
export function TickerSearch() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<InstrumentSearchResult | null>(null);
  const [assetType, setAssetType] = useState<AssetType>("cedear");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate } = useSWRConfig();

  const { data: results, isLoading } = useInstrumentSearch(query);
  const showResults = query.trim().length >= 2 && !selected;
  const visibleResults = useMemo(() => (results ?? []).filter((r) => !r.inWatchlist), [results]);

  function pick(result: InstrumentSearchResult) {
    setSelected(result);
    setAssetType(result.asset_type);
    setError(null);
  }

  function reset() {
    setSelected(null);
    setQuery("");
    setError(null);
    inputRef.current?.focus();
  }

  async function handleAdd() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: selected.ticker,
          asset_type: assetType,
          name: selected.name,
          market: selected.market,
          underlying_ticker: selected.underlying_ticker,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Error ${res.status}`);
      }
      await mutate("/api/watchlist");
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el ticker.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={showResults}
        aria-controls="ticker-search-results"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
        }}
        placeholder="Buscar ticker (ej. MSFT, GGAL)…"
        className="w-full max-w-sm h-10 rounded-md border px-3 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
      />

      {showResults && (
        <div
          id="ticker-search-results"
          role="listbox"
          className="absolute z-10 mt-1 w-full max-w-sm rounded-md border shadow-sm max-h-72 overflow-y-auto"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
        >
          {isLoading && (
            <p className="px-3 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Buscando…
            </p>
          )}
          {!isLoading && visibleResults.length === 0 && (
            <p className="px-3 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Sin resultados para &quot;{query}&quot;.
            </p>
          )}
          {visibleResults.map((r) => (
            <button
              key={`${r.ticker}::${r.asset_type}`}
              role="option"
              aria-selected={false}
              onClick={() => pick(r)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm cursor-pointer"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {r.ticker}
                </span>
                <span className="ml-2" style={{ color: "var(--text-muted)" }}>
                  {r.name ?? ASSET_TYPE_LABELS[r.asset_type]}
                </span>
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {ASSET_TYPE_LABELS[r.asset_type]}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="mt-2 w-full max-w-sm rounded-md border p-3 flex flex-col gap-3"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                {selected.ticker}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {selected.name ?? "Sin nombre cargado"}
              </p>
            </div>
            <button onClick={reset} className="text-xs underline" style={{ color: "var(--text-muted)" }}>
              Cancelar
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {ASSET_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAssetType(t)}
                className="text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                style={{
                  background: assetType === t ? "var(--text-primary)" : "var(--gridline)",
                  color: assetType === t ? "var(--surface-1)" : "var(--text-secondary)",
                }}
              >
                {ASSET_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {error && (
            <p className="text-xs" style={{ color: "var(--status-critical)" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleAdd}
            disabled={submitting}
            className="h-9 rounded-md text-sm font-medium disabled:opacity-60"
            style={{ background: "var(--accent)", color: "var(--accent-on)" }}
          >
            {submitting ? "Agregando…" : "Agregar a la watchlist"}
          </button>
        </div>
      )}
    </div>
  );
}
