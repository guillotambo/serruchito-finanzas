import { BROKER_LABELS } from "./format";
import { convert } from "./portfolio";
import type { Broker, CashHolding, Currency, Dividend, Transaction } from "./types";

/**
 * Feed de actividad: colapsa las tres fuentes de movimientos (transacciones,
 * dividendos, altas de saldo de efectivo) en una única lista cronológica que
 * se puede filtrar. Función pura, sin reloj propio ni acceso a DB -> `today`
 * entra por parámetro, igual que en realized.ts, para poder testear los
 * cortes de período.
 *
 * Las fechas son strings ISO `YYYY-MM-DD` de punta a punta: se comparan como
 * strings (el orden lexicográfico coincide con el cronológico en ese formato)
 * y nunca se convierten a Date para filtrar, así no hay corrimientos de zona
 * horaria entre el server y el browser.
 */

export type ActivityKind = "buy" | "sell" | "dividend" | "cash";

export type ActivityEvent = {
  // Key estable para React: los ids son únicos por tabla, no entre tablas.
  key: string;
  // Id en su tabla de origen (transactions / dividends / cash_holdings), para
  // poder editar, borrar o abrir el detalle sin volver a parsear `key`.
  id: number;
  kind: ActivityKind;
  date: string; // ISO YYYY-MM-DD
  // null solo para efectivo sin broker asignado (ej. plata en el banco).
  broker: Broker | null;
  // Ticker, o el label del saldo cuando kind es "cash".
  title: string;
  /**
   * Magnitud del movimiento en su moneda nativa, siempre positiva:
   *   buy      -> lo que pagaste (quantity * price + fees)
   *   sell     -> lo que te quedó (quantity * price - fees)
   *   dividend -> el monto cobrado
   *   cash     -> el saldo cargado
   * El signo lo pone la UI según `kind`: guardarlo con signo acá haría que
   * los totales de summarizeActivity se cancelen entre sí y obligaría a
   * volver a tomar el valor absoluto en cada consumidor.
   */
  amount: number;
  currency: Currency;
  quantity: number | null; // solo buy/sell
  price: number | null; // solo buy/sell
  fees: number | null; // solo buy/sell
  notes: string | null;
};

// Orden fijo para desempatar eventos del mismo día: sin esto el feed cambia
// de orden entre renders según cómo se hayan concatenado las fuentes.
const KIND_ORDER: Record<ActivityKind, number> = { buy: 0, sell: 1, dividend: 2, cash: 3 };

function transactionEvent(t: Transaction): ActivityEvent {
  const gross = t.quantity * t.price;
  return {
    key: `${t.side}-${t.id}`,
    id: t.id,
    kind: t.side === "buy" ? "buy" : "sell",
    date: t.date,
    broker: t.broker,
    title: t.ticker,
    amount: t.side === "buy" ? gross + t.fees : gross - t.fees,
    currency: t.currency,
    quantity: t.quantity,
    price: t.price,
    fees: t.fees,
    notes: t.notes,
  };
}

function dividendEvent(d: Dividend): ActivityEvent {
  return {
    key: `dividend-${d.id}`,
    id: d.id,
    kind: "dividend",
    date: d.date,
    broker: d.broker,
    title: d.ticker,
    amount: d.amount,
    currency: d.currency,
    quantity: null,
    price: null,
    fees: null,
    notes: d.notes,
  };
}

function cashEvent(c: CashHolding): ActivityEvent {
  return {
    key: `cash-${c.id}`,
    id: c.id,
    kind: "cash",
    // El saldo se edita en el lugar y no guarda historia de montos, así que
    // el único momento que se puede ubicar en el tiempo es el alta.
    // `created_date` puede faltar en respuestas cacheadas de versiones
    // previas del backend; sin fallback, el sort/format de abajo rompe.
    date: c.created_date ?? "",
    broker: c.broker,
    title: c.label,
    amount: c.amount,
    currency: c.currency,
    quantity: null,
    price: null,
    fees: null,
    notes: c.notes,
  };
}

export function buildActivityFeed(params: {
  transactions: Transaction[];
  dividends: Dividend[];
  cashHoldings: CashHolding[];
}): ActivityEvent[] {
  const events: ActivityEvent[] = [
    ...params.transactions.map(transactionEvent),
    ...params.dividends.map(dividendEvent),
    ...params.cashHoldings.map(cashEvent),
  ];

  return events.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    // Mismo día y mismo tipo: lo cargado más tarde (id más alto) va primero.
    return b.key.localeCompare(a.key, undefined, { numeric: true });
  });
}

export type ActivityFilters = {
  kinds: ActivityKind[] | "all";
  broker: "all" | Broker;
  from: string | null; // ISO, inclusive
  to: string | null; // ISO, inclusive
  currency: "all" | Currency;
  query: string; // matchea título y notas, sin distinguir mayúsculas
};

export const ALL_ACTIVITY_FILTERS: ActivityFilters = {
  kinds: "all",
  broker: "all",
  from: null,
  to: null,
  currency: "all",
  query: "",
};

export function filterActivity(events: ActivityEvent[], filters: ActivityFilters): ActivityEvent[] {
  const query = filters.query.trim().toLowerCase();

  return events.filter((e) => {
    if (filters.kinds !== "all" && !filters.kinds.includes(e.kind)) return false;
    // Un saldo sin broker no pertenece a ninguna cuenta: al filtrar por un
    // broker concreto queda afuera. (En el Dashboard pasa lo contrario, pero
    // ahí se está repartiendo patrimonio, no listando movimientos.)
    if (filters.broker !== "all" && e.broker !== filters.broker) return false;
    if (filters.from && e.date < filters.from) return false;
    if (filters.to && e.date > filters.to) return false;
    if (filters.currency !== "all" && e.currency !== filters.currency) return false;
    if (query) {
      const haystack = `${e.title} ${e.notes ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function hasActiveActivityFilters(filters: ActivityFilters): boolean {
  return (
    filters.kinds !== "all" ||
    filters.broker !== "all" ||
    filters.from != null ||
    filters.to != null ||
    filters.currency !== "all" ||
    filters.query.trim() !== ""
  );
}

/**
 * Los filtros activos, ya traducidos a chips legibles ("Ventas", "Balanz",
 * "desde 1 mar 2026"). Vive acá y no en la UI para que web y mobile muestren
 * exactamente las mismas etiquetas, y porque el criterio de qué cuenta como
 * "activo" tiene que ser el mismo que usa hasActiveActivityFilters.
 *
 * `query` queda afuera a propósito: el buscador está siempre visible, así que
 * no necesita un chip que le recuerde al usuario lo que ya está escrito.
 */
export type ActivityFilterChip = {
  // Qué parte del estado resetea este chip al cerrarse.
  key: "kind" | "broker" | "range" | "currency";
  label: string;
};

export function describeActivityFilters(filters: ActivityFilters): ActivityFilterChip[] {
  const chips: ActivityFilterChip[] = [];

  if (filters.kinds !== "all" && filters.kinds.length > 0) {
    chips.push({ key: "kind", label: filters.kinds.map((k) => ACTIVITY_KIND_LABELS[k]).join(" · ") });
  }
  if (filters.broker !== "all") {
    chips.push({ key: "broker", label: BROKER_LABELS[filters.broker] ?? filters.broker });
  }
  if (filters.from || filters.to) {
    const from = filters.from ? formatChipDate(filters.from) : null;
    const to = filters.to ? formatChipDate(filters.to) : null;
    chips.push({
      key: "range",
      label: from && to ? `${from} – ${to}` : from ? `desde ${from}` : `hasta ${to}`,
    });
  }
  if (filters.currency !== "all") {
    chips.push({ key: "currency", label: filters.currency });
  }

  return chips;
}

// Fecha numérica para los chips ("01/03/2026"). A diferencia de
// formatActivityDay, que puede darse el lujo de "1 de mar de 2026" en un
// encabezado de día, acá entran dos fechas en un chip de una línea. Mismo
// parseo: medianoche local, nunca UTC.
function formatChipDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

export type ActivitySummary = {
  count: number;
  byKind: Record<ActivityKind, number>;
  // Totales de flujo, en ambas monedas. null cuando falta el CCL para
  // convertir alguno de los eventos (mismo criterio que realized.ts: un total
  // incompleto se informa como "no sé", nunca como 0).
  investedArs: number | null;
  investedUsd: number | null;
  soldArs: number | null;
  soldUsd: number | null;
  dividendsArs: number | null;
  dividendsUsd: number | null;
};

// Suma un monto ya convertido a un acumulador que se "contagia" de null: si
// falta una sola conversión, el total entero pasa a null (ver ActivitySummary).
function addOrNull(total: number | null, value: number | null): number | null {
  return total != null && value != null ? total + value : null;
}

export function summarizeActivity(events: ActivityEvent[], ccl: number | null): ActivitySummary {
  const byKind: Record<ActivityKind, number> = { buy: 0, sell: 0, dividend: 0, cash: 0 };
  let investedArs: number | null = 0;
  let investedUsd: number | null = 0;
  let soldArs: number | null = 0;
  let soldUsd: number | null = 0;
  let dividendsArs: number | null = 0;
  let dividendsUsd: number | null = 0;

  for (const e of events) {
    byKind[e.kind] += 1;
    // El efectivo es un saldo, no un flujo: cuenta como movimiento pero no
    // suma a invertido/vendido/cobrado.
    if (e.kind === "cash") continue;

    const { ars, usd } = convert(e.amount, e.currency, ccl);
    if (e.kind === "buy") {
      investedArs = addOrNull(investedArs, ars);
      investedUsd = addOrNull(investedUsd, usd);
    } else if (e.kind === "sell") {
      soldArs = addOrNull(soldArs, ars);
      soldUsd = addOrNull(soldUsd, usd);
    } else {
      dividendsArs = addOrNull(dividendsArs, ars);
      dividendsUsd = addOrNull(dividendsUsd, usd);
    }
  }

  return { count: events.length, byKind, investedArs, investedUsd, soldArs, soldUsd, dividendsArs, dividendsUsd };
}

// --- Rangos de fecha -------------------------------------------------------

export type ActivityRangePreset = "30d" | "90d" | "year" | "all" | "custom";

/**
 * Fecha de hoy en ISO, según el reloj local del dispositivo. Es la única
 * función de este módulo que lee el reloj: el resto recibe `today` por
 * parámetro para poder testearse. Vive acá porque web y mobile necesitan
 * exactamente el mismo "hoy" para decidir qué eventos son de hoy.
 *
 * No usa `toISOString()` a secas porque eso da la fecha en UTC: en Argentina
 * (UTC-3), después de las 21:00 un movimiento cargado hoy aparecería como
 * "mañana".
 */
export function todayIsoLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

// Corre una fecha ISO N días hacia atrás sin tocar la zona horaria local:
// Date.UTC + toISOString mantiene el cálculo enteramente en UTC, así que el
// resultado no depende de dónde corra (server, browser o test).
export function isoDaysAgo(todayIso: string, days: number): string {
  const [year, month, day] = todayIso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
}

/**
 * Traduce un preset de período a un rango `{from, to}` para filterActivity.
 * "custom" devuelve el rango vacío: en ese caso las fechas las pone el
 * usuario y este helper no tiene nada que decidir.
 */
export function resolveActivityRange(
  preset: ActivityRangePreset,
  todayIso: string
): { from: string | null; to: string | null } {
  switch (preset) {
    case "30d":
      return { from: isoDaysAgo(todayIso, 30), to: null };
    case "90d":
      return { from: isoDaysAgo(todayIso, 90), to: null };
    case "year":
      return { from: `${todayIso.slice(0, 4)}-01-01`, to: null };
    default:
      return { from: null, to: null };
  }
}

// --- Etiquetas -------------------------------------------------------------

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  buy: "Compra",
  sell: "Venta",
  dividend: "Dividendo",
  cash: "Saldo",
};

/**
 * Encabezado del grupo de un día en el feed: "Hoy" / "Ayer" / "12 mar 2026".
 * La fecha ISO se parsea como medianoche local (`T00:00:00`) y no como UTC:
 * `new Date("2026-03-12")` es UTC y en Argentina se formatearía como el 11.
 */
export function formatActivityDay(iso: string, todayIso: string): string {
  if (iso === todayIso) return "Hoy";
  if (iso === isoDaysAgo(todayIso, 1)) return "Ayer";
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Fecha desconocida";
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}
