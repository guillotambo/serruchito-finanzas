"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Currency } from "@serruchito/core";

const STORAGE_KEY = "serruchito:currency";

type CurrencyContextValue = {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("ARS");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Currency | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "ARS" || stored === "USD") setCurrencyState(stored);
  }, []);

  const setCurrency = useCallback((next: Currency) => {
    setCurrencyState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return <CurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency debe usarse dentro de <CurrencyProvider>");
  return ctx;
}
