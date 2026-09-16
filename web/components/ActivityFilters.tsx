"use client";

import type { ActivityKind, ActivityRangePreset, Broker, Currency } from "@serruchito/core";
import { BrokerFilter } from "@/components/BrokerFilter";
import { PillGroup, type PillOption } from "@/components/ui/PillGroup";

// Mismo estilo de input que TransactionForm/CashForm, para que los campos de
// rango no se vean como otra familia de controles.
const inputStyle: React.CSSProperties = {
  background: "var(--surface-1)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

export type ActivityKindFilter = "all" | ActivityKind;

const KIND_OPTIONS: PillOption<ActivityKindFilter>[] = [
  { id: "all", label: "Todos" },
  { id: "buy", label: "Compras" },
  { id: "sell", label: "Ventas" },
  { id: "dividend", label: "Dividendos" },
  { id: "cash", label: "Efectivo" },
];

const RANGE_OPTIONS: PillOption<ActivityRangePreset>[] = [
  { id: "30d", label: "30 días" },
  { id: "90d", label: "3 meses" },
  { id: "year", label: "Este año" },
  { id: "all", label: "Todo" },
  { id: "custom", label: "Personalizado" },
];

const CURRENCY_OPTIONS: PillOption<"all" | Currency>[] = [
  { id: "all", label: "Todas" },
  { id: "ARS", label: "ARS" },
  { id: "USD", label: "USD" },
];

export type ActivityFiltersState = {
  kind: ActivityKindFilter;
  broker: "all" | Broker;
  range: ActivityRangePreset;
  from: string;
  to: string;
  currency: "all" | Currency;
  query: string;
};

// Cuerpo del panel de filtros, totalmente controlado: el estado (y su
// persistencia en la URL) vive en app/movimientos/page.tsx, acá solo se
// dibuja. La búsqueda no está acá: vive en ActivityFilterBar, siempre visible.
export function ActivityFilters({
  state,
  onChange,
  onClear,
  showClear,
  todayIso,
}: {
  state: ActivityFiltersState;
  onChange: (patch: Partial<ActivityFiltersState>) => void;
  onClear: () => void;
  showClear: boolean;
  todayIso: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Tipo">
        <PillGroup
          options={KIND_OPTIONS}
          value={state.kind}
          onChange={(kind) => onChange({ kind })}
          ariaLabel="Filtrar por tipo de movimiento"
        />
      </Field>

      <Field label="Broker">
        <BrokerFilter value={state.broker} onChange={(broker) => onChange({ broker })} />
      </Field>

      <Field label="Período">
        <div className="flex flex-col gap-2">
          <PillGroup
            options={RANGE_OPTIONS}
            value={state.range}
            onChange={(range) => onChange({ range })}
            ariaLabel="Filtrar por período"
          />
          {state.range === "custom" && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Desde
                </span>
                <input
                  type="date"
                  value={state.from}
                  max={state.to || todayIso}
                  onChange={(e) => onChange({ from: e.target.value })}
                  className="rounded-md border px-2 py-1.5 text-sm"
                  style={inputStyle}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Hasta
                </span>
                <input
                  type="date"
                  value={state.to}
                  min={state.from || undefined}
                  max={todayIso}
                  onChange={(e) => onChange({ to: e.target.value })}
                  className="rounded-md border px-2 py-1.5 text-sm"
                  style={inputStyle}
                />
              </label>
            </div>
          )}
        </div>
      </Field>

      <Field label="Moneda">
        <PillGroup
          options={CURRENCY_OPTIONS}
          value={state.currency}
          onChange={(currency) => onChange({ currency })}
          ariaLabel="Filtrar por moneda"
        />
      </Field>

      {showClear && (
        <div>
          <button
            type="button"
            onClick={onClear}
            className="text-sm underline cursor-pointer"
            style={{ color: "var(--text-muted)" }}
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}
