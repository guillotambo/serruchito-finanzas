"use client";

import { BrokerFilter } from "@/components/BrokerFilter";
import { usePortfolioFilters } from "@/lib/portfolio-filters";

// Interruptor "Incluir efectivo": permite sacar de la vista el efectivo/banco
// sumado al patrimonio cuando lo que se quiere ver es solo lo puesto en
// brokers (a diferencia del filtro de broker, que ya existe, esto es una
// exclusión total del efectivo en vez de un recorte por cuenta). Antes vivía
// inline en web/app/page.tsx; ahora es parte del cuerpo del modal de
// filtros, compartido con Cartera.
function IncludeCashToggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2">
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        Incluir efectivo
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
        style={{ background: value ? "var(--accent)" : "var(--gridline)" }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full transition-transform"
          style={{ left: 2, background: "var(--accent-on)", transform: value ? "translateX(16px)" : "translateX(0)" }}
        />
      </button>
    </label>
  );
}

/**
 * Cuerpo del modal de filtros de cartera (ver PortfolioFilterBar.tsx),
 * compartido entre Inicio y Cartera: antes el broker y el switch de efectivo
 * vivían sueltos arriba del hero card de Inicio, y Cartera no tenía ninguno
 * de los dos. Réplica de ActivityFilters.tsx para el patrón del modal.
 */
export function PortfolioFilters() {
  const { filters, setBroker, setIncludeCash } = usePortfolioFilters();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Broker
        </span>
        <BrokerFilter value={filters.broker} onChange={setBroker} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Efectivo
        </span>
        <IncludeCashToggle value={filters.includeCash} onChange={setIncludeCash} />
      </div>
    </div>
  );
}
