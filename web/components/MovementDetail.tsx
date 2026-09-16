"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ACTIVITY_KIND_LABELS,
  AMOUNT_MASK,
  BROKER_COLORS,
  BROKER_LABELS,
  formatActivityDay,
  formatArs,
  formatNumber,
  formatPct,
  formatUsd,
} from "@serruchito/core";
import type { Currency, MovementDetail } from "@serruchito/core";
import { Metric, Section } from "@/components/ui/Metric";
import { Drawer } from "@/components/ui/Overlay";
import { useCurrency } from "@/lib/currency-context";
import { useHideAmounts } from "@/lib/privacy-context";

/**
 * Detalle de un movimiento del feed. Los números los arma buildMovementDetail
 * en @serruchito/core (misma lógica que mobile); acá solo se decide cómo se
 * lee.
 *
 * Los montos se muestran en la moneda nativa de la operación, no en la del
 * selector global: una compra de $10 en pesos se cargó en pesos y verla
 * convertida a dólares al CCL de hoy confunde más de lo que ayuda. La
 * conversión aparece como dato secundario en "La operación".
 */

const KIND_STATUS: Record<string, string | null> = {
  buy: "var(--status-good)",
  sell: "var(--status-critical)",
  dividend: null,
  cash: null,
};

function formatterFor(currency: Currency, hidden: boolean) {
  if (hidden) return () => AMOUNT_MASK;
  return currency === "ARS" ? formatArs : formatUsd;
}

export function MovementDetailPanel({
  detail,
  todayIso,
  position,
  onNavigate,
  onClose,
  onEdit,
  onDelete,
  onFilterByTicker,
}: {
  detail: MovementDetail;
  todayIso: string;
  /** Posición dentro del feed filtrado, para navegar sin cerrar. */
  position: { index: number; total: number };
  onNavigate: (delta: -1 | 1) => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFilterByTicker: (ticker: string) => void;
}) {
  const { event } = detail;
  const { hidden } = useHideAmounts();
  const fmt = formatterFor(event.currency, hidden);
  const status = KIND_STATUS[event.kind];

  const hasPrev = position.index > 0;
  const hasNext = position.index < position.total - 1;

  return (
    <Drawer
      onClose={onClose}
      maxWidth="480px"
      header={(titleId) => (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            {event.broker && <span className="h-2 w-2 rounded-full" style={{ background: BROKER_COLORS[event.broker] }} />}
            <span style={{ color: status ?? "var(--text-muted)" }}>{ACTIVITY_KIND_LABELS[event.kind]}</span>
            <span>·</span>
            <span>{event.broker ? BROKER_LABELS[event.broker] : "Sin broker"}</span>
            <span>·</span>
            <span>{formatActivityDay(event.date, todayIso)}</span>
          </div>
          <h2 id={titleId} className="text-3xl font-semibold leading-none">
            {event.title}
          </h2>
          <p className="mt-2 text-lg font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
            {event.kind === "buy" && !hidden ? "−" : event.kind === "sell" || event.kind === "dividend" ? (hidden ? "" : "+") : ""}
            {fmt(event.amount)}
          </p>
        </>
      )}
      headerActions={
        position.total > 1 && (
          <>
            <button
              type="button"
              className="icon-button"
              onClick={() => onNavigate(-1)}
              disabled={!hasPrev}
              aria-label="Movimiento anterior"
              style={{ opacity: hasPrev ? 1 : 0.35 }}
            >
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => onNavigate(1)}
              disabled={!hasNext}
              aria-label="Movimiento siguiente"
              style={{ opacity: hasNext ? 1 : 0.35 }}
            >
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          </>
        )
      }
    >
      <ResultHero detail={detail} fmt={fmt} />

      <Section title="La operación">
        {detail.breakdown.quantity != null && (
          <Metric label="Cantidad" value={formatNumber(detail.breakdown.quantity, 4)} />
        )}
        {detail.breakdown.price != null && <Metric label="Precio unitario" value={fmt(detail.breakdown.price)} />}
        {detail.breakdown.gross != null && <Metric label="Bruto" value={fmt(detail.breakdown.gross)} />}
        {detail.breakdown.fees != null && detail.breakdown.fees > 0 && (
          <Metric label="Comisiones" value={fmt(detail.breakdown.fees)} />
        )}
        <Metric label={event.kind === "buy" ? "Total pagado" : "Total"} value={fmt(detail.breakdown.net)} emphasis />
        <Metric
          label={`Equivalente en ${event.currency === "ARS" ? "dólares" : "pesos"}`}
          hint="al CCL de hoy"
          value={
            hidden
              ? AMOUNT_MASK
              : event.currency === "ARS"
                ? formatUsd(detail.breakdown.netUsd)
                : formatArs(detail.breakdown.netArs)
          }
          signal={undefined}
        />
      </Section>

      {detail.context && (
        <Section title="Impacto en la posición">
          <Metric
            label="Cantidad"
            value={`${formatNumber(detail.context.quantityBefore, 4)} → ${formatNumber(detail.context.quantityAfter, 4)}`}
          />
          <Metric
            label="Precio promedio de compra"
            hint={event.kind === "sell" ? "una venta no cambia el PPC" : undefined}
            value={`${detail.context.avgCostBefore == null ? "—" : fmt(detail.context.avgCostBefore)} → ${
              detail.context.avgCostAfter == null ? "—" : fmt(detail.context.avgCostAfter)
            }`}
          />
        </Section>
      )}

      {detail.tickerSummary && (
        <Section title={`Todo lo movido con ${detail.tickerSummary.ticker}`}>
          <Metric label="Tenencia actual" value={formatNumber(detail.tickerSummary.quantityHeld, 4)} />
          <Metric
            label="PPC actual"
            value={detail.tickerSummary.avgCost == null ? "—" : fmt(detail.tickerSummary.avgCost)}
          />
          <Metric label="Invertido" value={fmt(detail.tickerSummary.invested)} />
          <Metric label="Vendido" value={fmt(detail.tickerSummary.sold)} />
          <Metric label="Dividendos cobrados" value={fmt(detail.tickerSummary.dividends)} />
        </Section>
      )}

      {event.notes && (
        <section className="border-b py-5" style={{ borderColor: "var(--border)" }}>
          <h3 className="mb-1 text-sm font-semibold">Nota</h3>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {event.notes}
          </p>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-5">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full px-4 h-9 text-sm font-medium transition-colors hover:opacity-90"
          style={{ background: "var(--accent)", color: "var(--accent-on)" }}
        >
          Editar
        </button>
        <button type="button" onClick={onDelete} className="text-sm underline cursor-pointer" style={{ color: "var(--text-muted)" }}>
          Borrar
        </button>
        {detail.tickerSummary && (
          <button
            type="button"
            onClick={() => onFilterByTicker(detail.tickerSummary!.ticker)}
            className="ml-auto text-sm underline cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
          >
            Ver todos los movimientos de {detail.tickerSummary.ticker}
          </button>
        )}
      </div>
    </Drawer>
  );
}

/**
 * La sección que motiva el panel: cuánta ganancia o pérdida salió de esta
 * operación. Qué número es honesto mostrar depende del tipo de movimiento —
 * ver el header de movement-detail.ts.
 */
function ResultHero({ detail, fmt }: { detail: MovementDetail; fmt: (value: number | null) => string }) {
  const { currency } = useCurrency();
  const { hidden } = useHideAmounts();

  if (detail.realized) {
    const { pnlNative, pnlPct, soldQuantity, sellPrice, avgCost, proceeds, costOfSold, pnlArs, pnlUsd } = detail.realized;
    const positive = pnlNative >= 0;
    const converted = currency === "ARS" ? pnlArs : pnlUsd;
    return (
      <Hero
        label={positive ? "Ganancia realizada" : "Pérdida realizada"}
        amount={fmt(pnlNative)}
        pct={formatPct(pnlPct)}
        positive={positive}
        lines={[
          `Vendiste ${formatNumber(soldQuantity, 4)} a ${fmt(sellPrice)} = ${fmt(proceeds)}`,
          `Costo promedio ${fmt(avgCost)} × ${formatNumber(soldQuantity, 4)} = ${fmt(costOfSold)}`,
        ]}
        footnote={
          detail.event.currency === (currency === "ARS" ? "ARS" : "USD") || hidden
            ? undefined
            : `Equivale a ${currency === "ARS" ? formatArs(converted) : formatUsd(converted)} al CCL de hoy.`
        }
      />
    );
  }

  if (detail.unrealized) {
    const { status, pricePaid, marketPrice, changeTotal, changePct, priceStale } = detail.unrealized;

    if (status === "closed") {
      return (
        <Hero
          label="Posición cerrada"
          amount="—"
          pct=""
          positive
          neutral
          lines={[`Pagaste ${fmt(pricePaid)} por unidad.`]}
          footnote="Ya no queda nada de esta posición en cartera: el resultado se tomó en las ventas, que lo muestran en su propio detalle."
        />
      );
    }

    if (marketPrice == null) {
      return (
        <Hero
          label="Sin cotización"
          amount="—"
          pct=""
          positive
          neutral
          lines={[`Pagaste ${fmt(pricePaid)} por unidad.`]}
          footnote="No hay precio de mercado para este instrumento, así que no se puede estimar cuánto vale hoy."
        />
      );
    }

    const positive = (changeTotal ?? 0) >= 0;
    return (
      <Hero
        label={positive ? "Ganancia no realizada" : "Pérdida no realizada"}
        amount={fmt(changeTotal)}
        pct={formatPct(changePct)}
        positive={positive}
        lines={[
          `Pagaste ${fmt(pricePaid)} por unidad, hoy vale ${fmt(marketPrice)}${priceStale ? " (precio desactualizado)" : ""}.`,
          status === "partially_sold" ? "Ojo: parte de esta posición ya se vendió." : "",
        ].filter(Boolean)}
        footnote="Es la variación del precio desde que compraste, no una ganancia tomada. Al vender, el resultado se calcula contra el PPC de la posición."
      />
    );
  }

  if (detail.dividend) {
    return (
      <Hero
        label="Dividendo cobrado"
        amount={fmt(detail.dividend.amount)}
        pct={detail.dividend.yieldOnCostPct == null ? "" : formatPct(detail.dividend.yieldOnCostPct)}
        positive
        lines={[
          detail.dividend.yieldOnCostPct == null
            ? "No queda tenencia de este ticker, así que no hay costo sobre el cual medir el rendimiento."
            : "Medido sobre el costo de la tenencia actual.",
          `Llevás cobrado ${fmt(detail.dividend.totalCollected)} de este ticker.`,
        ]}
      />
    );
  }

  return null;
}

function Hero({
  label,
  amount,
  pct,
  positive,
  neutral = false,
  lines,
  footnote,
}: {
  label: string;
  amount: string;
  pct: string;
  positive: boolean;
  neutral?: boolean;
  lines: string[];
  footnote?: string;
}) {
  const color = neutral ? "var(--text-muted)" : positive ? "var(--status-good)" : "var(--status-critical)";
  return (
    <section className="border-b pb-6" style={{ borderColor: "var(--border)" }}>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <p className="text-3xl font-semibold tabular-nums" style={{ color }}>
          {amount}
        </p>
        {pct && (
          <p className="text-lg font-semibold tabular-nums" style={{ color }}>
            {pct}
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {footnote && (
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          {footnote}
        </p>
      )}
    </section>
  );
}
