"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { formatRelativeTime } from "@serruchito/core";
import { refreshPrices, usePortfolio } from "@/lib/hooks";
import { IconRefresh } from "@/components/shell/icons";

// Vive en el header global (ver shell/Header.tsx) para poder refrescar desde
// cualquier página, no solo desde Inicio: lee usePortfolio() directamente en
// vez de recibir fetchedAt/stale por props, porque el header no tiene acceso
// a los datos que carga cada página.
//
// Páginas como /mercado o /rendimiento no cargan /api/portfolio por su
// cuenta, pero este hook sí lo hace (con la misma key, SWR dedupea la
// petición). Mientras no haya datos ni error se muestra un estado neutro en
// vez de "sin datos" con el punto en rojo, que sería un falso "no anda".
export function PriceRefreshStatus() {
  const { data, error, isLoading } = usePortfolio();
  const { mutate } = useSWRConfig();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setLoading(true);
    setFailed(false);
    try {
      await refreshPrices(mutate);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const neutral = isLoading && !data && !error;
  const disconnected = failed || (!!error && !data);
  const hasIssue = disconnected || !!data?.pricesStale;
  const dotColor = neutral ? "var(--text-muted)" : hasIssue ? "var(--status-critical)" : "var(--status-good)";
  const label = neutral
    ? "—"
    : disconnected
      ? `sin conexión · ${formatRelativeTime(data?.pricesFetchedAt ?? null)}`
      : formatRelativeTime(data?.pricesFetchedAt ?? null);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 h-8 rounded-full text-sm transition-colors disabled:opacity-70 hover:opacity-90"
      style={{ background: "var(--gridline)", color: "var(--text-secondary)" }}
      title={hasIssue ? "No se pudo actualizar todos los precios. Click para reintentar." : "Click para actualizar precios"}
    >
      <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
      <span className="tabular-nums hidden sm:inline">{loading ? "actualizando…" : label}</span>
      <IconRefresh className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}
