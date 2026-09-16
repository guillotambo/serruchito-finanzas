"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSWRConfig } from "swr";
import {
  AMOUNT_MASK,
  buildActivityFeed,
  buildMovementDetail,
  describeActivityFilters,
  filterActivity,
  formatArs as formatArsRaw,
  formatUsd as formatUsdRaw,
  hasActiveActivityFilters,
  resolveActivityRange,
  summarizeActivity,
  todayIsoLocal,
} from "@serruchito/core";
import type {
  ActivityEvent,
  ActivityFilterChip,
  ActivityFilters as ActivityFilterValues,
  ActivityKind,
  ActivityRangePreset,
  Broker,
  Currency,
} from "@serruchito/core";
import { useCashHoldings, useDividends, usePortfolio, useTransactions } from "@/lib/hooks";
import { ActivityFilterBar } from "@/components/ActivityFilterBar";
import { ActivityFilters, type ActivityFiltersState, type ActivityKindFilter } from "@/components/ActivityFilters";
import { ActivityList } from "@/components/ActivityList";
import { CashList } from "@/components/CashList";
import { MovementDetailPanel } from "@/components/MovementDetail";
import { TransactionForm } from "@/components/TransactionForm";
import { DividendForm } from "@/components/DividendForm";
import { CashForm } from "@/components/CashForm";
import { ErrorState } from "@/components/ErrorState";
import { StaleDataNotice } from "@/components/StaleDataNotice";
import { StatTile } from "@/components/StatTile";
import { Modal } from "@/components/ui/Overlay";
import { useCurrency } from "@/lib/currency-context";
import { useHideAmounts } from "@/lib/privacy-context";
import { useMounted } from "@/lib/use-mounted";

// Fusión de lo que antes eran /actividad (feed de lectura), /transacciones y
// /dividendos (las dos, formularios disfrazados de pantalla): acá el feed es
// la vista principal y la carga vive en un modal detrás del botón "+", con
// un selector Compra/Venta · Dividendo · Efectivo que reusa los mismos
// formularios de antes (TransactionForm/DividendForm/CashForm) tal cual,
// sin reescribir su lógica de validación/submit. Esos mismos formularios
// sirven para editar cuando reciben `initial`.
const VALID_KINDS: ActivityKind[] = ["buy", "sell", "dividend", "cash"];
const VALID_BROKERS: Broker[] = ["cocos", "balanz", "ibkr", "iol"];
const VALID_RANGES: ActivityRangePreset[] = ["30d", "90d", "year", "all", "custom"];
const VALID_CURRENCIES: Currency[] = ["ARS", "USD"];
const DEFAULT_RANGE: ActivityRangePreset = "all";

type AddKind = "transaccion" | "dividendo" | "efectivo";

// A qué colección pertenece cada tipo de evento: define el endpoint de
// borrado y qué formulario abre "Editar".
const KIND_SOURCE: Record<ActivityKind, { endpoint: string; form: AddKind }> = {
  buy: { endpoint: "/api/transactions", form: "transaccion" },
  sell: { endpoint: "/api/transactions", form: "transaccion" },
  dividend: { endpoint: "/api/dividends", form: "dividendo" },
  cash: { endpoint: "/api/cash", form: "efectivo" },
};

function parseKind(value: string | null): ActivityKindFilter {
  return VALID_KINDS.includes(value as ActivityKind) ? (value as ActivityKind) : "all";
}
function parseBroker(value: string | null): "all" | Broker {
  return VALID_BROKERS.includes(value as Broker) ? (value as Broker) : "all";
}
function parseRange(value: string | null): ActivityRangePreset {
  return VALID_RANGES.includes(value as ActivityRangePreset) ? (value as ActivityRangePreset) : DEFAULT_RANGE;
}
function parseCurrency(value: string | null): "all" | Currency {
  return VALID_CURRENCIES.includes(value as Currency) ? (value as Currency) : "all";
}
function parseIsoDate(value: string | null): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}
function plural(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

export default function MovimientosPage() {
  return (
    <Suspense fallback={<MovimientosFallback />}>
      <MovimientosContent />
    </Suspense>
  );
}

function MovimientosFallback() {
  return (
    <div className="flex flex-col gap-6">
      <div className="skeleton h-8 w-40" />
      <div className="skeleton h-44 w-full" />
      <div className="skeleton h-96 w-full" />
    </div>
  );
}

/**
 * Alta y edición de movimientos. En alta muestra el selector de tipo; al
 * editar el tipo ya está decidido por el registro, así que se fija.
 */
function MovementFormModal({
  editing,
  onClose,
}: {
  editing: { kind: AddKind; initial: NonNullable<unknown> } | null;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<AddKind>(editing?.kind ?? "transaccion");
  const isEditing = editing != null;

  return (
    <Modal
      onClose={onClose}
      maxWidth="42rem"
      header={(titleId) => (
        <h2 id={titleId} className="text-lg font-semibold">
          {isEditing ? "Editar movimiento" : "Cargar movimiento"}
        </h2>
      )}
    >
      <div className="flex flex-col gap-4">
        {!isEditing && (
          <div className="inline-flex flex-wrap p-0.5 rounded-full self-start" style={{ background: "var(--gridline)" }} role="tablist">
            {(
              [
                { id: "transaccion", label: "Compra/Venta" },
                { id: "dividendo", label: "Dividendo" },
                { id: "efectivo", label: "Efectivo" },
              ] as { id: AddKind; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={kind === opt.id}
                onClick={() => setKind(opt.id)}
                className="px-4 h-8 rounded-full text-sm font-medium transition-colors"
                style={{
                  background: kind === opt.id ? "var(--accent)" : "transparent",
                  color: kind === opt.id ? "var(--accent-on)" : "var(--text-secondary)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* eslint-disable @typescript-eslint/no-explicit-any -- el registro ya
            viene tipado desde su hook; acá solo se enruta al form correcto. */}
        {kind === "transaccion" && <TransactionForm initial={editing?.initial as any} onDone={isEditing ? onClose : undefined} />}
        {kind === "dividendo" && <DividendForm initial={editing?.initial as any} onDone={isEditing ? onClose : undefined} />}
        {kind === "efectivo" && <CashForm initial={editing?.initial as any} onDone={isEditing ? onClose : undefined} />}
        {/* eslint-enable @typescript-eslint/no-explicit-any */}
      </div>
    </Modal>
  );
}

function MovimientosContent() {
  const transactionsResult = useTransactions();
  const dividendsResult = useDividends();
  const cashResult = useCashHoldings();
  const { data: portfolio } = usePortfolio();
  const { mutate } = useSWRConfig();
  const { currency } = useCurrency();
  const { hidden } = useHideAmounts();
  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;
  const formatUsd = hidden ? () => AMOUNT_MASK : formatUsdRaw;
  const [showAdd, setShowAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<{ kind: AddKind; initial: NonNullable<unknown> } | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mounted = useMounted();

  const state: ActivityFiltersState = useMemo(
    () => ({
      kind: parseKind(searchParams.get("tipo")),
      broker: parseBroker(searchParams.get("broker")),
      range: parseRange(searchParams.get("periodo")),
      from: parseIsoDate(searchParams.get("desde")),
      to: parseIsoDate(searchParams.get("hasta")),
      currency: parseCurrency(searchParams.get("moneda")),
      query: searchParams.get("q") ?? "",
    }),
    [searchParams]
  );

  // Movimiento abierto en el detalle. Va en la URL para que el panel
  // sobreviva a un refresh y se pueda compartir el link.
  const selectedKey = searchParams.get("mov");

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleChange = useCallback(
    (patch: Partial<ActivityFiltersState>) => {
      const next: Record<string, string | null> = {};
      if ("kind" in patch) next.tipo = patch.kind === "all" ? null : patch.kind!;
      if ("broker" in patch) next.broker = patch.broker === "all" ? null : patch.broker!;
      if ("currency" in patch) next.moneda = patch.currency === "all" ? null : patch.currency!;
      if ("query" in patch) next.q = patch.query ?? null;
      if ("from" in patch) next.desde = patch.from ?? null;
      if ("to" in patch) next.hasta = patch.to ?? null;
      if ("range" in patch) {
        next.periodo = patch.range === DEFAULT_RANGE ? null : patch.range!;
        if (patch.range !== "custom") {
          next.desde = null;
          next.hasta = null;
        }
      }
      setParams(next);
    },
    [setParams]
  );

  const handleClear = useCallback(() => {
    // El movimiento abierto no es un filtro: limpiar no tiene por qué cerrar
    // el panel que el usuario está leyendo.
    setParams({ tipo: null, broker: null, periodo: null, desde: null, hasta: null, moneda: null, q: null });
  }, [setParams]);

  const handleRemoveChip = useCallback(
    (key: ActivityFilterChip["key"]) => {
      if (key === "range") handleChange({ range: DEFAULT_RANGE });
      else if (key === "kind") handleChange({ kind: "all" });
      else if (key === "broker") handleChange({ broker: "all" });
      else handleChange({ currency: "all" });
    },
    [handleChange]
  );

  const todayIso = todayIsoLocal();

  const events = useMemo(
    () =>
      buildActivityFeed({
        transactions: transactionsResult.data ?? [],
        dividends: dividendsResult.data ?? [],
        cashHoldings: cashResult.data ?? [],
      }),
    [transactionsResult.data, dividendsResult.data, cashResult.data]
  );

  const filterValues: ActivityFilterValues = useMemo(() => {
    const range =
      state.range === "custom"
        ? { from: state.from || null, to: state.to || null }
        : resolveActivityRange(state.range, todayIso);
    return {
      kinds: state.kind === "all" ? "all" : [state.kind],
      broker: state.broker,
      from: range.from,
      to: range.to,
      currency: state.currency,
      query: state.query,
    };
  }, [state, todayIso]);

  const filtered = useMemo(() => filterActivity(events, filterValues), [events, filterValues]);
  const summary = useMemo(() => summarizeActivity(filtered, portfolio?.ccl ?? null), [filtered, portfolio?.ccl]);
  const hasFilters = hasActiveActivityFilters(filterValues);
  const chips = useMemo(() => describeActivityFilters(filterValues), [filterValues]);

  const selectedIndex = selectedKey ? filtered.findIndex((e) => e.key === selectedKey) : -1;
  const selectedEvent = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  const detail = useMemo(
    () =>
      selectedEvent
        ? buildMovementDetail({
            event: selectedEvent,
            transactions: transactionsResult.data ?? [],
            dividends: dividendsResult.data ?? [],
            positions: portfolio?.positions ?? [],
            ccl: portfolio?.ccl ?? null,
          })
        : null,
    [selectedEvent, transactionsResult.data, dividendsResult.data, portfolio]
  );

  const openMovement = useCallback((event: ActivityEvent) => setParams({ mov: event.key }), [setParams]);
  const closeMovement = useCallback(() => setParams({ mov: null }), [setParams]);

  const navigateMovement = useCallback(
    (delta: -1 | 1) => {
      const next = filtered[selectedIndex + delta];
      if (next) setParams({ mov: next.key });
    },
    [filtered, selectedIndex, setParams]
  );

  // Si el movimiento apuntado por la URL no está en el feed visible (lo tapó
  // un filtro, o se borró), se limpia el param en vez de dejar un panel
  // fantasma o un link roto.
  const feedLoading = transactionsResult.isLoading || dividendsResult.isLoading || cashResult.isLoading;
  useEffect(() => {
    if (selectedKey && selectedIndex < 0 && !feedLoading) setParams({ mov: null });
  }, [selectedKey, selectedIndex, feedLoading, setParams]);

  // ← / → recorren el feed con el detalle abierto. Se ignora cuando el foco
  // está en un campo de texto, donde esas teclas mueven el cursor.
  useEffect(() => {
    if (!selectedEvent) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "ArrowLeft") navigateMovement(-1);
      if (event.key === "ArrowRight") navigateMovement(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEvent, navigateMovement]);

  const handleDelete = useCallback(
    async (event: ActivityEvent) => {
      if (!confirm("¿Borrar este movimiento?")) return;
      const { endpoint } = KIND_SOURCE[event.kind];
      await fetch(`${endpoint}/${event.id}`, { method: "DELETE" });
      await mutate(endpoint);
      await mutate("/api/portfolio");
      closeMovement();
    },
    [mutate, closeMovement]
  );

  const handleEdit = useCallback(
    (event: ActivityEvent) => {
      const source = KIND_SOURCE[event.kind];
      const record =
        source.form === "transaccion"
          ? transactionsResult.data?.find((t) => t.id === event.id)
          : source.form === "dividendo"
            ? dividendsResult.data?.find((d) => d.id === event.id)
            : cashResult.data?.find((c) => c.id === event.id);
      if (!record) return;
      // Cerrar el detalle antes de abrir la edición: dos overlays apilados se
      // pelean por el bloqueo de scroll y por Escape (los cerraría a los dos).
      setParams({ mov: null });
      setEditing({ kind: source.form, initial: record });
    },
    [transactionsResult.data, dividendsResult.data, cashResult.data, setParams]
  );

  const fmtTotal = currency === "ARS" ? formatArs : formatUsd;
  const pick = (ars: number | null, usd: number | null) => (currency === "ARS" ? ars : usd);

  const error = transactionsResult.error ?? dividendsResult.error ?? cashResult.error;
  const retry = () => {
    mutate("/api/transactions");
    mutate("/api/dividends");
    mutate("/api/cash");
  };

  if (!mounted || feedLoading) return <MovimientosFallback />;
  if (error && events.length === 0) return <ErrorState message={error.message} onRetry={retry} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Movimientos
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Todo lo que fuiste cargando, en orden: compras, ventas, dividendos cobrados y altas de saldo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="shrink-0 rounded-full px-4 h-9 text-sm font-medium transition-colors hover:opacity-90"
          style={{ background: "var(--accent)", color: "var(--accent-on)" }}
        >
          + Cargar movimiento
        </button>
      </div>

      {error && <StaleDataNotice message={error.message} onRetry={retry} />}

      <ActivityFilterBar
        query={state.query}
        onQueryChange={(query) => handleChange({ query })}
        chips={chips}
        onRemoveChip={handleRemoveChip}
        onClear={handleClear}
        onOpenFilters={() => setShowFilters(true)}
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Movimientos"
          value={String(summary.count)}
          sublabel={`${plural(summary.byKind.buy, "compra")} · ${plural(summary.byKind.sell, "venta")}`}
        />
        <StatTile label="Invertido" value={fmtTotal(pick(summary.investedArs, summary.investedUsd))} />
        <StatTile label="Vendido" value={fmtTotal(pick(summary.soldArs, summary.soldUsd))} />
        <StatTile label="Dividendos" value={fmtTotal(pick(summary.dividendsArs, summary.dividendsUsd))} />
      </div>

      <ActivityList events={filtered} todayIso={todayIso} hasFilters={hasFilters} onSelect={openMovement} />

      <section className="flex flex-col gap-3 border-t pt-5" style={{ borderColor: "var(--border)" }}>
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Efectivo y otros saldos
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Montos fijos que no vienen de una cotización (efectivo, plata en el banco). Se cargan desde
            &quot;+ Cargar movimiento&quot; y se editan desde el detalle de cada saldo en el feed.
          </p>
        </div>
        <CashList />
      </section>

      {showFilters && (
        <Modal
          onClose={() => setShowFilters(false)}
          maxWidth="32rem"
          header={(titleId) => (
            <h2 id={titleId} className="text-lg font-semibold">
              Filtros
            </h2>
          )}
        >
          <ActivityFilters
            state={state}
            onChange={handleChange}
            onClear={handleClear}
            showClear={chips.length > 0}
            todayIso={todayIso}
          />
        </Modal>
      )}

      {detail && selectedEvent && (
        <MovementDetailPanel
          detail={detail}
          todayIso={todayIso}
          position={{ index: selectedIndex, total: filtered.length }}
          onNavigate={navigateMovement}
          onClose={closeMovement}
          onEdit={() => handleEdit(selectedEvent)}
          onDelete={() => handleDelete(selectedEvent)}
          // Un solo setParams: dos llamadas seguidas parten del mismo
          // searchParams y la segunda pisaría a la primera.
          onFilterByTicker={(ticker) => setParams({ q: ticker, mov: null })}
        />
      )}

      {(showAdd || editing) && (
        <MovementFormModal
          editing={editing}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
