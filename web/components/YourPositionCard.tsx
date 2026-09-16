"use client";

import Link from "next/link";
import { AMOUNT_MASK, BROKER_LABELS, consolidatePosition, formatArs as formatArsRaw, formatNumber, formatPct, formatUsd as formatUsdRaw } from "@serruchito/core";
import type { AssetType } from "@serruchito/core";
import { StatTile } from "@/components/StatTile";
import { usePortfolio } from "@/lib/hooks";
import { useCurrency } from "@/lib/currency-context";
import { useHideAmounts } from "@/lib/privacy-context";

// Bloque "Tu posición" del detalle de un instrumento: solo aparece si el
// ticker (mismo asset_type) está en cartera. Reutiliza consolidatePosition()
// de packages/core, el mismo criterio de PPC ponderado que usa la Cartera.
export function YourPositionCard({ ticker, assetType }: { ticker: string; assetType: AssetType }) {
  const { data } = usePortfolio();
  const { currency } = useCurrency();
  const { hidden } = useHideAmounts();

  if (!data) return null;
  const position = consolidatePosition(data.positions, ticker, assetType);
  if (!position) return null;

  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;
  const formatUsd = hidden ? () => AMOUNT_MASK : formatUsdRaw;
  const inUsd = currency === "USD";
  const fmt = inUsd ? formatUsd : formatArs;
  const value = inUsd ? position.valueUsd : position.valueArs;
  const pnl = inUsd ? position.unrealizedPnlUsd : position.unrealizedPnlArs;

  return (
    <section className="rounded-lg border p-5" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Tu posición</h2>
        <Link href="/cartera" className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Ver en Cartera →
        </Link>
      </div>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        {formatNumber(position.quantity)} unidades · PPC {position.costCurrency === "USD" ? formatUsd(position.avgCost) : formatArs(position.avgCost)} ·{" "}
        {position.brokers.map((b) => BROKER_LABELS[b] ?? b).join(", ")}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <StatTile label="Cantidad" value={formatNumber(position.quantity)} />
        <StatTile label={`Valor actual (${currency})`} value={value != null ? fmt(value) : "—"} />
        <StatTile
          label="P&L no realizado"
          value={pnl != null ? fmt(pnl) : "—"}
          tone="auto"
          delta={position.unrealizedPnlPct != null ? { text: formatPct(position.unrealizedPnlPct), positive: position.unrealizedPnlPct >= 0 } : null}
        />
      </div>
    </section>
  );
}
