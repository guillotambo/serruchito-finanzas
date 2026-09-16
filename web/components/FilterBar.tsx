"use client";

import { SlidersHorizontal, X } from "lucide-react";

/**
 * Chrome del botón "Filtros" (contador + chips removibles + "Limpiar"),
 * extraído de ActivityFilterBar.tsx para no duplicarlo en Cartera/Inicio (ver
 * PortfolioFilterBar.tsx): antes de esto, Movimientos era la única pantalla
 * con este patrón. `leading` es el buscador de Movimientos, que no aplica
 * acá -> queda opcional.
 */
export function FilterBar<K extends string>({
  chips,
  onRemoveChip,
  onClear,
  onOpenFilters,
  leading,
}: {
  chips: { key: K; label: string }[];
  onRemoveChip: (key: K) => void;
  onClear: () => void;
  onOpenFilters: () => void;
  leading?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {leading}
        <button
          type="button"
          onClick={onOpenFilters}
          className="filter-pill flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm cursor-pointer"
          aria-pressed={chips.length > 0}
          style={{
            borderColor: chips.length > 0 ? "var(--text-primary)" : "var(--border)",
            background: chips.length > 0 ? "var(--text-primary)" : "var(--surface-1)",
            color: chips.length > 0 ? "var(--surface-1)" : "var(--text-secondary)",
          }}
        >
          <SlidersHorizontal aria-hidden="true" size={15} />
          Filtros
          {chips.length > 0 && <span className="tabular-nums">· {chips.length}</span>}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onRemoveChip(chip.key)}
              className="filter-pill flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer"
              aria-pressed={false}
              aria-label={`Sacar el filtro ${chip.label}`}
              style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-secondary)" }}
            >
              {chip.label}
              <X aria-hidden="true" size={13} />
            </button>
          ))}
          <button
            type="button"
            onClick={onClear}
            className="ml-1 text-xs underline cursor-pointer"
            style={{ color: "var(--text-muted)" }}
          >
            Limpiar
          </button>
        </div>
      )}
    </div>
  );
}
