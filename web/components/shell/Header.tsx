"use client";

import { Eye, EyeOff } from "lucide-react";
import { useCurrency } from "@/lib/currency-context";
import { useSidebar } from "@/lib/sidebar-context";
import { useHideAmounts } from "@/lib/privacy-context";
import { IconMenu, IconPanelLeft } from "@/components/shell/icons";
import { PriceRefreshStatus } from "@/components/PriceRefreshStatus";
import type { Currency } from "@serruchito/core";

const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: "ARS", label: "Pesos" },
  { value: "USD", label: "Dólar CCL" },
];

function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency();
  return (
    <div className="flex items-center p-0.5 rounded-full" style={{ background: "var(--gridline)" }} role="group" aria-label="Moneda">
      {CURRENCY_OPTIONS.map((opt) => {
        const active = currency === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setCurrency(opt.value)}
            aria-pressed={active}
            className="px-3 h-8 rounded-full text-sm font-medium transition-colors"
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

function PrivacyToggle() {
  const { hidden, toggleHidden } = useHideAmounts();
  return (
    <button
      type="button"
      onClick={toggleHidden}
      aria-label={hidden ? "Mostrar montos" : "Ocultar montos"}
      aria-pressed={hidden}
      title={hidden ? "Mostrar montos" : "Ocultar montos"}
      className="flex items-center justify-center w-9 h-9 rounded-full transition-transform active:scale-[0.96]"
      style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
    >
      {hidden ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
    </button>
  );
}

export function Header() {
  const { collapsed, toggleCollapsed, setMobileOpen } = useSidebar();
  return (
    <header
      className="flex items-center justify-between gap-3 h-16 px-4 sm:px-6 border-b"
      style={{ borderColor: "var(--border)", background: "var(--surface-page)" }}
    >
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
        className="md:hidden flex items-center justify-center w-8 h-8 rounded-md"
        style={{ color: "var(--text-secondary)" }}
      >
        <IconMenu className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        aria-expanded={!collapsed}
        className="hidden md:flex items-center justify-center w-9 h-9 rounded-md cursor-pointer transition-transform active:scale-[0.96]"
        style={{ color: "var(--text-secondary)" }}
      >
        <IconPanelLeft className="w-4 h-4" />
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <PriceRefreshStatus />
        <CurrencyToggle />
        <PrivacyToggle />
      </div>
    </header>
  );
}
