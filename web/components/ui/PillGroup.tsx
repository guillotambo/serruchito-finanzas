// Pill de filtro del sistema (ver DESIGN.md §5 "Pills / Chips"): el mismo
// botón redondeado que ya usaban BrokerFilter, RealizedPnlSection, los rangos
// de PortfolioHistoryChart y los tablists de Portfolio/Rendimiento, cada uno
// con su copia a mano. Acá vive una sola vez.
//
// El estado activo se distingue por relleno, nunca solo por peso de fuente; el
// hover de una pill inactiva insinúa el acento (clase .filter-pill en
// globals.css, porque un :hover no se puede expresar con style inline).

export type PillOption<T extends string> = { id: T; label: string };

export function PillGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <FilterPill
          key={option.id}
          active={option.id === value}
          onClick={() => onChange(option.id)}
          label={option.label}
        />
      ))}
    </div>
  );
}

export function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="filter-pill text-sm px-3 py-1.5 rounded-full border cursor-pointer"
      style={{
        borderColor: active ? "var(--text-primary)" : "var(--border)",
        background: active ? "var(--text-primary)" : "var(--surface-1)",
        color: active ? "var(--surface-1)" : "var(--text-secondary)",
      }}
    >
      {label}
    </button>
  );
}
