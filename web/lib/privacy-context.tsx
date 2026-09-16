"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "serruchito:hideAmounts";

type PrivacyContextValue = {
  hidden: boolean;
  toggleHidden: () => void;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHiddenState] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "true") setHiddenState(true);
  }, []);

  const toggleHidden = useCallback(() => {
    setHiddenState((current) => {
      const next = !current;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return <PrivacyContext.Provider value={{ hidden, toggleHidden }}>{children}</PrivacyContext.Provider>;
}

export function useHideAmounts() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error("useHideAmounts debe usarse dentro de <PrivacyProvider>");
  return ctx;
}
