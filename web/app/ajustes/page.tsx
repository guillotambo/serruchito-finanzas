"use client";

import { Eye, EyeOff } from "lucide-react";
import { useCurrency } from "@/lib/currency-context";
import { useHideAmounts } from "@/lib/privacy-context";
import { BrokerTransferCard } from "@/components/BrokerTransferCard";
import { ImportTransactionsCard } from "@/components/ImportTransactionsCard";
import { PriceRefreshStatus } from "@/components/PriceRefreshStatus";
import type { Currency } from "@serruchito/core";

// Ajustes: antes moneda/privacidad solo vivían como iconos sueltos en el
// Header (siguen ahí, son cómodos), y en mobile ni siquiera estaban
// conectados (currency-context/privacy-context existían pero nada los
// llamaba). Esta pantalla les da un lugar fijo y navegable en los dos lados.
const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: "ARS", label: "Pesos" },
  { value: "USD", label: "Dólar CCL" },
];

function SettingCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-4 flex flex-col gap-3" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
      <div>
        <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>
        {description && (
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function PillGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="inline-flex p-0.5 rounded-full self-start" style={{ background: "var(--gridline)" }} role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className="px-4 h-8 rounded-full text-sm font-medium transition-colors"
            style={{
              background: active ? "var(--accent)" : "transparent",
              color: active ? "var(--accent-on)" : "var(--text-secondary)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function AjustesPage() {
  const { currency, setCurrency } = useCurrency();
  const { hidden, toggleHidden } = useHideAmounts();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Ajustes
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Importar movimientos, moneda, privacidad y estado de los precios.
        </p>
      </div>

      <SettingCard
        title="Importar movimientos"
        description="Cargá muchas compras y ventas de una vez desde una planilla, en vez de hacerlo una por una."
      >
        <ImportTransactionsCard />
      </SettingCard>

      <SettingCard title="Moneda" description="En qué moneda se muestran los montos de toda la app.">
        <PillGroup options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} ariaLabel="Moneda" />
      </SettingCard>

      <SettingCard title="Privacidad" description="Oculta todos los montos con un enmascarado (útil para compartir pantalla).">
        <button
          type="button"
          onClick={toggleHidden}
          aria-pressed={hidden}
          className="inline-flex items-center gap-2 self-start px-4 h-8 rounded-full text-sm font-medium transition-colors"
          style={{ background: hidden ? "var(--accent)" : "var(--gridline)", color: hidden ? "var(--accent-on)" : "var(--text-secondary)" }}
        >
          {hidden ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
          {hidden ? "Montos ocultos" : "Montos visibles"}
        </button>
      </SettingCard>

      <SettingCard
        title="Transferir broker"
        description="Reasigna en bloque las compras/ventas de un broker a otro (ej. si transferiste tus tenencias de Cocos a IOL). No mueve dividendos ni saldos de efectivo."
      >
        <BrokerTransferCard />
      </SettingCard>

      <SettingCard title="Precios" description="Última vez que se actualizaron las cotizaciones y el CCL. El mismo indicador está en el header, en todas las páginas.">
        <PriceRefreshStatus />
      </SettingCard>
    </div>
  );
}
