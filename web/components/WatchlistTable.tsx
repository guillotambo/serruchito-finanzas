"use client";

import { useState } from "react";
import Link from "next/link";
import { useSWRConfig } from "swr";
import { AMOUNT_MASK, ASSET_TYPE_LABELS, formatArs as formatArsRaw, formatPct, formatUsd as formatUsdRaw } from "@serruchito/core";
import { Arrow } from "@/components/Arrow";
import { Sparkline } from "@/components/Sparkline";
import { useHideAmounts } from "@/lib/privacy-context";
import type { WatchlistRow } from "@/lib/watchlist";

// Lista de seguimiento: ticker, sparkline, precio y variación del día. El
// precio de mercado NO se enmascara con el modo privacidad (es público, no
// patrimonio del usuario) -> a diferencia de PositionsTable, acá `hidden`
// solo tapa nada, no hay nada que tapar en esta tabla.
export function WatchlistTable({ rows }: { rows: WatchlistRow[] }) {
  const { mutate } = useSWRConfig();
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<WatchlistRow[] | null>(null);
  const items = localOrder ?? rows;

  async function handleDelete(id: number, ticker: string) {
    if (!confirm(`¿Sacar ${ticker} de la watchlist?`)) return;
    await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    await mutate("/api/watchlist");
  }

  async function persistOrder(next: WatchlistRow[]) {
    setLocalOrder(next);
    await fetch("/api/watchlist/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((r) => r.id) }),
    });
    await mutate("/api/watchlist");
    setLocalOrder(null);
  }

  function handleDrop(targetId: number) {
    if (draggingId == null || draggingId === targetId) return;
    const current = [...items];
    const fromIdx = current.findIndex((r) => r.id === draggingId);
    const toIdx = current.findIndex((r) => r.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);
    void persistOrder(current);
    setDraggingId(null);
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Todavía no agregaste ningún ticker. Buscá uno arriba para empezar a seguirlo.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
            <th className="px-3 py-2 font-medium">Ticker</th>
            <th className="px-3 py-2 font-medium hidden sm:table-cell">Últimos días</th>
            <th className="px-3 py-2 font-medium text-right">Precio</th>
            <th className="px-3 py-2 font-medium text-right">Hoy</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <WatchlistRowView
              key={row.id}
              row={row}
              dragging={draggingId === row.id}
              onDragStart={() => setDraggingId(row.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(row.id)}
              onDelete={() => handleDelete(row.id, row.ticker)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WatchlistRowView({
  row,
  dragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDelete,
}: {
  row: WatchlistRow;
  dragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDelete: () => void;
}) {
  const { hidden } = useHideAmounts();
  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;
  const formatUsd = hidden ? () => AMOUNT_MASK : formatUsdRaw;
  const fmt = row.currency === "USD" ? formatUsd : formatArs;
  const positive = (row.dayChangePct ?? 0) >= 0;

  return (
    <tr
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ borderBottom: "1px solid var(--border)", opacity: dragging ? 0.5 : 1, cursor: "grab" }}
    >
      <td className="px-3 py-2">
        <Link href={`/mercado/${encodeURIComponent(row.ticker)}?asset_type=${row.asset_type}`} className="flex flex-col">
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            {row.ticker}
          </span>
          <span className="text-xs truncate max-w-[160px]" style={{ color: "var(--text-muted)" }}>
            {row.name ?? ASSET_TYPE_LABELS[row.asset_type]}
          </span>
        </Link>
      </td>
      <td className="px-3 py-2 hidden sm:table-cell">
        <Sparkline values={row.sparkline} positive={positive} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {row.price != null ? fmt(row.price) : "—"}
        {row.priceStale && (
          <span className="ml-1 text-xs" style={{ color: "var(--text-muted)" }} title="Precio de la última actualización disponible">
            *
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {row.dayChangePct != null ? (
          <span className="tabular-nums font-medium inline-flex items-center gap-0.5" style={{ color: positive ? "var(--status-good)" : "var(--status-critical)" }}>
            <Arrow positive={positive} />
            {formatPct(row.dayChangePct)}
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <button onClick={onDelete} className="text-xs underline" style={{ color: "var(--text-muted)" }}>
          Sacar
        </button>
      </td>
    </tr>
  );
}
