"use client";

import type { ActivityFilterChip } from "@serruchito/core";
import { FilterBar } from "@/components/FilterBar";

/**
 * Fila de control del feed: buscador siempre visible + un botón que abre el
 * resto de los filtros en un panel. Antes los seis filtros vivían apilados en
 * un card fijo que empujaba el primer movimiento fuera de la pantalla. El
 * chrome del botón/chips es el de FilterBar (ver PortfolioFilterBar.tsx, que
 * lo usa sin buscador); acá solo se le agrega el `<input>` como `leading`.
 *
 * Los filtros activos se resumen en chips con una × para sacarlos de a uno:
 * sin eso, replegar el panel esconde el estado y deja al usuario sin saber
 * por qué el feed le muestra tres filas.
 */
export function ActivityFilterBar({
  query,
  onQueryChange,
  chips,
  onRemoveChip,
  onClear,
  onOpenFilters,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  chips: ActivityFilterChip[];
  onRemoveChip: (key: ActivityFilterChip["key"]) => void;
  onClear: () => void;
  onOpenFilters: () => void;
}) {
  return (
    <FilterBar
      chips={chips}
      onRemoveChip={onRemoveChip}
      onClear={onClear}
      onOpenFilters={onOpenFilters}
      leading={
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar por ticker o nota…"
          aria-label="Buscar movimientos"
          className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
      }
    />
  );
}
