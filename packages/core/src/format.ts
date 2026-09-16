// Máscara para montos cuando el modo privacidad (ícono de ojo) está activo.
export const AMOUNT_MASK = "••••••";

export function formatArs(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// Para un porcentaje de participación (share of total), nunca una variación:
// no lleva signo "+", a diferencia de formatPct.
export function formatShare(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(value);
}

// Tiempo relativo corto ("hace 22m") para el indicador de última
// actualización de precios. No usa Intl.RelativeTimeFormat porque ese
// formato es más verboso ("hace 22 minutos") de lo que entra en el chip.
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "sin datos";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0 || diffMs < 60_000) return "hace instantes";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

// Etiqueta ultracompacta para el chip de frescura de precios (mobile): sin
// el prefijo "hace" de formatRelativeTime, para que quepa al lado de la
// tuerca de ajustes. "" significa "recién actualizado" (menos de un
// minuto) -> el chip lo muestra como un punto de color solo, nunca como
// texto ("hace instantes" no debería aparecer en ningún lado). `now` entra
// por parámetro para poder testear los cortes, igual que `today` en
// activity.ts.
export function formatCompactRelativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "—";
  const diffMs = now - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return "—";
  if (diffMs < 60_000) return "";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export const BROKER_LABELS: Record<string, string> = {
  cocos: "Cocos Capital",
  balanz: "Balanz",
  ibkr: "Interactive Brokers",
  iol: "InvertirOnline",
};

export const ASSET_TYPE_LABELS: Record<string, string> = {
  cedear: "CEDEAR",
  accion_arg: "Acción AR",
  stock_us: "Acción US",
  etf: "ETF",
  bono: "Bono",
  otro: "Otro",
};

export const CURRENCY_LABELS: Record<string, string> = {
  ARS: "Pesos (ARS)",
  USD: "Dólares (USD)",
};

// Color fijo por broker (orden categórico de la paleta: nunca reasignar por ranking).
export const BROKER_COLORS: Record<string, string> = {
  ibkr: "var(--series-1)",
  cocos: "var(--series-2)",
  balanz: "var(--series-3)",
  iol: "var(--series-4)",
};

// Color fijo por tipo de activo. "otro" es un cajón de sastre, no una
// categoría sustantiva -> tinta neutra en vez de generar un 6to hue
// categórico (ver dataviz/references/choosing-a-form.md).
export const ASSET_TYPE_COLORS: Record<string, string> = {
  cedear: "var(--series-1)",
  accion_arg: "var(--series-2)",
  stock_us: "var(--series-3)",
  etf: "var(--series-4)",
  bono: "var(--series-5)",
  otro: "var(--axis)",
};

// Color fijo por moneda.
export const CURRENCY_COLORS: Record<string, string> = {
  ARS: "var(--series-1)",
  USD: "var(--series-4)",
};
