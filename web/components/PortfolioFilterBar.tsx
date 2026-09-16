"use client";

import { FilterBar } from "@/components/FilterBar";
import { usePortfolioFilters } from "@/lib/portfolio-filters";

/**
 * Botón "Filtros" de Inicio y Cartera: mismo chrome que Movimientos
 * (FilterBar), sin buscador. `onOpenFilters` lo pasa cada página (abre su
 * propio Modal con <PortfolioFilters />).
 */
export function PortfolioFilterBar({ onOpenFilters }: { onOpenFilters: () => void }) {
  const { chips, removeChip, clear } = usePortfolioFilters();

  return <FilterBar chips={chips} onRemoveChip={removeChip} onClear={clear} onOpenFilters={onOpenFilters} />;
}
