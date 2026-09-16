"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { AMOUNT_MASK, ASSET_TYPE_LABELS, BROKER_COLORS, BROKER_LABELS, CURRENCY_LABELS, formatArs, formatNumber, formatPct, formatShare, formatUsd } from "@serruchito/core";
import type { Position } from "@serruchito/core";
import { Metric } from "@/components/ui/Metric";
import { Drawer, Modal } from "@/components/ui/Overlay";
import { useCurrency } from "@/lib/currency-context";
import { useHideAmounts } from "@/lib/privacy-context";

type SortKey = "ticker" | "marketPrice" | "dayChangePct" | "value" | "unrealizedPnlPct";
type SortState = { key: SortKey; dir: "asc" | "desc" };

const COLUMNS: { key: SortKey; label: string; align: "left" | "right"; type: "string" | "number" }[] = [
  { key: "ticker", label: "Posicion", align: "left", type: "string" },
  { key: "marketPrice", label: "Precio", align: "right", type: "number" },
  { key: "dayChangePct", label: "Hoy", align: "right", type: "number" },
  { key: "value", label: "Valuacion", align: "right", type: "number" },
  { key: "unrealizedPnlPct", label: "Resultado", align: "right", type: "number" },
];

function sortValue(position: Position, key: SortKey, currency: "ARS" | "USD"): string | number | null {
  switch (key) {
    case "ticker":
      return position.ticker;
    case "marketPrice":
      return position.marketPrice;
    case "dayChangePct":
      return position.dayChangePct;
    case "value":
      return currency === "ARS" ? position.valueArs : position.valueUsd;
    case "unrealizedPnlPct":
      return position.unrealizedPnlPct;
  }
}

function compare(a: Position, b: Position, sort: SortState, currency: "ARS" | "USD"): number {
  const av = sortValue(a, sort.key, currency);
  const bv = sortValue(b, sort.key, currency);
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  const result = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : (av as number) - (bv as number);
  return sort.dir === "asc" ? result : -result;
}

function nativePrice(position: Position, value: number | null | undefined, hidden: boolean) {
  if (hidden) return AMOUNT_MASK;
  return position.costCurrency === "ARS" ? formatArs(value) : formatUsd(value);
}

// dayChangeArs ya viene consolidado en ARS (ver lib/types.ts); para USD se
// necesita el CCL del portfolio (no hay un dayChangeUsd por posición en la API).
function dayChangeInCurrency(position: Position, currency: "ARS" | "USD", ccl: number | null): number | null {
  if (position.dayChangeArs == null) return null;
  if (currency === "ARS") return position.dayChangeArs;
  return ccl ? position.dayChangeArs / ccl : null;
}

function ResultValue({ position, amount }: { position: Position; amount: string | null }) {
  const positive = (position.unrealizedPnlNative ?? 0) >= 0;
  const color = position.unrealizedPnlPct == null ? "var(--text-muted)" : positive ? "var(--status-good)" : "var(--status-critical)";
  return (
    <span className="flex flex-col items-end gap-0.5 tabular-nums" style={{ color }}>
      <span className="font-semibold">{formatPct(position.unrealizedPnlPct)}</span>
      <span className="text-xs font-normal">{amount == null ? "Sin cotizacion" : amount}</span>
    </span>
  );
}

function usePositionDetail(position: Position, portfolioTotal: number, ccl: number | null) {
  const { currency } = useCurrency();
  const { hidden } = useHideAmounts();
  const fmt = hidden ? () => AMOUNT_MASK : currency === "ARS" ? formatArs : formatUsd;
  const value = currency === "ARS" ? position.valueArs : position.valueUsd;
  const cost = currency === "ARS" ? position.costBasisArs : position.costBasisUsd;
  const pnl = currency === "ARS" ? position.unrealizedPnlArs : position.unrealizedPnlUsd;
  const weight = value != null && portfolioTotal > 0 ? (value / portfolioTotal) * 100 : null;
  const breakEvenMove = position.marketPrice && position.avgCost > 0 ? ((position.avgCost / position.marketPrice) - 1) * 100 : null;
  const positive = (position.unrealizedPnlNative ?? 0) >= 0;
  const dayChangeAmount = dayChangeInCurrency(position, currency, ccl);
  return { currency, fmt, hidden, value, cost, pnl, weight, breakEvenMove, positive, dayChangeAmount };
}

function PositionDetailHeader({ position, titleId }: { position: Position; titleId: string }) {
  return (
    <>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        <span className="h-2 w-2 rounded-full" style={{ background: BROKER_COLORS[position.broker] }} />
        {BROKER_LABELS[position.broker]} · {ASSET_TYPE_LABELS[position.asset_type]}
      </div>
      <h2 id={titleId} className="text-3xl font-semibold leading-none">
        {position.ticker}
      </h2>
    </>
  );
}

function PositionDetailBody({ position, portfolioTotal, ccl }: { position: Position; portfolioTotal: number; ccl: number | null }) {
  const { currency, fmt, hidden, value, cost, pnl, weight, breakEvenMove, positive, dayChangeAmount } = usePositionDetail(position, portfolioTotal, ccl);

  return (
    <>
      <section className="border-b pb-6" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Valor de la posicion</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <p className="text-3xl font-semibold tabular-nums">{fmt(value)}</p>
          <div className="text-right tabular-nums" style={{ color: positive ? "var(--status-good)" : "var(--status-critical)" }}>
            <p className="text-lg font-semibold">{formatPct(position.unrealizedPnlPct)}</p>
            <p className="text-xs">{fmt(pnl)}</p>
          </div>
        </div>
        {weight != null && (
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
              <span>Peso en la cartera visible</span>
              <span className="tabular-nums">{formatShare(weight)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--gridline)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(weight, 100)}%`, background: "var(--accent)" }} />
            </div>
          </div>
        )}
      </section>

      <section className="border-b py-5" style={{ borderColor: "var(--border)" }}>
        <h3 className="mb-1 text-sm font-semibold">Mercado</h3>
        <dl className="divide-y" style={{ borderColor: "var(--border)" }}>
          <Metric label="Precio actual" value={nativePrice(position, position.marketPrice, hidden)} emphasis />
          <Metric label="Variacion de hoy" value={formatPct(position.dayChangePct)} signal={position.dayChangePct} />
          <Metric label="Ganancia/perdida de hoy" value={dayChangeAmount == null ? "—" : fmt(dayChangeAmount)} emphasis signal={dayChangeAmount} />
          <Metric label="Cambio por unidad" value={nativePrice(position, position.dayChangeNative, hidden)} signal={position.dayChangeNative} />
          <Metric label="Estado del precio" value={position.priceStale ? "Desactualizado" : "Actualizado"} />
        </dl>
      </section>

      <section className="border-b py-5" style={{ borderColor: "var(--border)" }}>
        <h3 className="mb-1 text-sm font-semibold">Tenencia y costo</h3>
        <dl className="divide-y" style={{ borderColor: "var(--border)" }}>
          <Metric label="Cantidad" value={formatNumber(position.quantity, 4)} />
          <Metric label="Precio promedio de compra" value={nativePrice(position, position.avgCost, hidden)} />
          <Metric label={`Costo total (${currency})`} value={fmt(cost)} emphasis />
          <Metric
            label="Movimiento hasta break-even"
            value={breakEvenMove == null ? "—" : Math.abs(breakEvenMove) < 0.005 ? "En equilibrio" : formatPct(breakEvenMove)}
            signal={breakEvenMove == null ? null : -breakEvenMove}
          />
        </dl>
      </section>

      <section className="pt-5">
        <h3 className="mb-3 text-sm font-semibold">Identificacion</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div><p style={{ color: "var(--text-muted)" }}>Broker</p><p className="mt-0.5 font-medium">{BROKER_LABELS[position.broker]}</p></div>
          <div><p style={{ color: "var(--text-muted)" }}>Tipo</p><p className="mt-0.5 font-medium">{ASSET_TYPE_LABELS[position.asset_type]}</p></div>
          <div><p style={{ color: "var(--text-muted)" }}>Moneda nativa</p><p className="mt-0.5 font-medium">{CURRENCY_LABELS[position.costCurrency]}</p></div>
          <div><p style={{ color: "var(--text-muted)" }}>Resultado</p><p className="mt-0.5 font-medium">{positive ? "Ganancia latente" : "Perdida latente"}</p></div>
        </div>
      </section>
    </>
  );
}

type DetailView = "drawer" | "modal";

export function PositionsTable({ positions, ccl = null }: { positions: Position[]; ccl?: number | null }) {
  const { currency } = useCurrency();
  const { hidden } = useHideAmounts();
  const fmt = hidden ? () => AMOUNT_MASK : currency === "ARS" ? formatArs : formatUsd;
  const [sort, setSort] = useState<SortState>({ key: "unrealizedPnlPct", dir: "desc" });
  const [selected, setSelected] = useState<Position | null>(null);
  const [detailView, setDetailView] = useState<DetailView>("drawer");
  const sorted = useMemo(() => [...positions].sort((a, b) => compare(a, b, sort, currency)), [positions, sort, currency]);
  const totalValue = useMemo(
    () => positions.reduce((sum, position) => sum + (currency === "ARS" ? position.valueArs ?? 0 : position.valueUsd ?? 0), 0),
    [positions, currency]
  );

  function handleSort(key: SortKey) {
    setSort((current) => {
      if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
      return { key, dir: COLUMNS.find((column) => column.key === key)?.type === "string" ? "asc" : "desc" };
    });
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-lg border px-5 py-10 text-center" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <p className="font-medium">Todavia no hay posiciones abiertas.</p>
        <a href="/movimientos" className="mt-2 inline-flex text-sm underline underline-offset-4" style={{ color: "var(--text-secondary)" }}>
          Cargar la primera compra
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex justify-end gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
        <span className="self-center">Detalle:</span>
        {(["drawer", "modal"] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setDetailView(view)}
            className="rounded-full px-2.5 py-1 transition-colors cursor-pointer"
            style={{
              background: detailView === view ? "var(--text-primary)" : "var(--gridline)",
              color: detailView === view ? "var(--surface-1)" : "var(--text-secondary)",
            }}
          >
            {view === "drawer" ? "Panel lateral" : "Ventana"}
          </button>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-lg border md:block" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <table className="positions-table w-full border-collapse text-sm">
          <thead>
            <tr>
              {COLUMNS.map((column) => {
                const active = sort.key === column.key;
                return (
                  <th key={column.key} scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className={`group flex w-full items-center gap-1 px-4 py-3 text-xs font-medium ${column.align === "right" ? "justify-end text-right" : "text-left"}`}
                      style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}
                    >
                      {column.label}
                      <ChevronDown aria-hidden="true" size={13} className={`transition-transform ${active && sort.dir === "asc" ? "rotate-180" : ""} ${active ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((position) => {
              const positive = (position.unrealizedPnlNative ?? 0) >= 0;
              const pnlAmount = currency === "ARS" ? position.unrealizedPnlArs : position.unrealizedPnlUsd;
              const dayAmount = dayChangeInCurrency(position, currency, ccl);
              return (
                <tr
                  key={`${position.ticker}-${position.broker}`}
                  className="positions-table-row cursor-pointer"
                  tabIndex={0}
                  onClick={() => setSelected(position)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(position);
                    }
                  }}
                  aria-label={`Ver detalle de ${position.ticker} en ${BROKER_LABELS[position.broker]}`}
                  style={{ "--row-status": positive ? "var(--status-good)" : "var(--status-critical)" } as React.CSSProperties}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: BROKER_COLORS[position.broker] }} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-semibold" style={{ color: "var(--text-primary)" }}>
                          {position.ticker}
                          {position.priceStale && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--status-warning)" }} title="Precio desactualizado" />}
                        </span>
                        <span className="block truncate text-xs" style={{ color: "var(--text-muted)" }}>
                          {BROKER_LABELS[position.broker]} · {ASSET_TYPE_LABELS[position.asset_type]}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums">
                    <span className="font-medium">{nativePrice(position, position.marketPrice, hidden)}</span>
                    <span className="block text-xs" style={{ color: "var(--text-muted)" }}>PPC {nativePrice(position, position.avgCost, hidden)}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums" style={{ color: position.dayChangePct == null ? "var(--text-muted)" : position.dayChangePct >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                    <span className="font-medium">{formatPct(position.dayChangePct)}</span>
                    <span className="block text-xs font-normal">{dayAmount == null ? "" : fmt(dayAmount)}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums">
                    <span className="font-medium">{fmt(currency === "ARS" ? position.valueArs : position.valueUsd)}</span>
                    <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{formatNumber(position.quantity, 4)} unidades</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <ResultValue position={position} amount={pnlAmount == null ? null : fmt(pnlAmount)} />
                      <ArrowRight aria-hidden="true" size={15} style={{ color: "var(--text-muted)" }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 md:hidden">
        {sorted.map((position) => {
          const pnlAmount = currency === "ARS" ? position.unrealizedPnlArs : position.unrealizedPnlUsd;
          const dayAmount = dayChangeInCurrency(position, currency, ccl);
          return (
            <button
              key={`${position.ticker}-${position.broker}`}
              type="button"
              onClick={() => setSelected(position)}
              className="position-mobile-row grid grid-cols-[1fr_auto] items-center gap-4 rounded-lg border p-4 text-left"
              style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="h-2 w-2 rounded-full" style={{ background: BROKER_COLORS[position.broker] }} />
                  {position.ticker}
                </span>
                <span className="mt-1 block truncate text-xs" style={{ color: "var(--text-muted)" }}>{BROKER_LABELS[position.broker]}</span>
                <span className="mt-3 block font-medium tabular-nums">{fmt(currency === "ARS" ? position.valueArs : position.valueUsd)}</span>
                <span className="mt-0.5 block text-xs tabular-nums" style={{ color: position.dayChangePct == null ? "var(--text-muted)" : position.dayChangePct >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                  Hoy {formatPct(position.dayChangePct)}{dayAmount != null && ` · ${fmt(dayAmount)}`}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <ResultValue position={position} amount={pnlAmount == null ? null : fmt(pnlAmount)} />
                <ArrowRight aria-hidden="true" size={16} style={{ color: "var(--text-muted)" }} />
              </span>
            </button>
          );
        })}
      </div>

      {selected &&
        (() => {
          const Overlay = detailView === "drawer" ? Drawer : Modal;
          return (
            <Overlay onClose={() => setSelected(null)} header={(titleId) => <PositionDetailHeader position={selected} titleId={titleId} />}>
              <PositionDetailBody position={selected} portfolioTotal={totalValue} ccl={ccl} />
            </Overlay>
          );
        })()}
    </>
  );
}
