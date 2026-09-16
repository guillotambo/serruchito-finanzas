"use client";

import { useMemo, useState } from "react";
import { AMOUNT_MASK, ASSET_TYPE_COLORS, ASSET_TYPE_LABELS, BROKER_COLORS, BROKER_LABELS, CURRENCY_COLORS, CURRENCY_LABELS, formatArs as formatArsRaw, formatShare } from "@serruchito/core";
import type { Position } from "@serruchito/core";
import { useHideAmounts } from "@/lib/privacy-context";

type Dimension = "position" | "broker" | "asset_type" | "currency";

const DIMENSIONS: { id: Dimension; label: string }[] = [
  { id: "position", label: "Posición" },
  { id: "broker", label: "Broker" },
  { id: "asset_type", label: "Tipo de activo" },
  { id: "currency", label: "Moneda" },
];

type Entry = { key: string; label: string; value: number; color: string };

// Colores por posición: a diferencia de broker/tipo/moneda (identidad fija,
// nunca reasignada), acá no hay un set fijo de "N tickers reservados" -> se
// asignan por orden de magnitud. El color de una posición puede correrse de
// un día a otro si cambia su ranking. A pedido explícito se muestran todas
// las posiciones sin plegar el resto en "Otros"; --series-6..12 (globals.css)
// extienden la paleta de --series-1..5 para cubrir más categorías, y más
// allá de eso se cicla la paleta completa.
const POSITION_RANK_COLORS = Array.from({ length: 12 }, (_, i) => `var(--series-${i + 1})`);
const OTHERS_COLOR = "var(--axis)";

function buildPositionEntries(positions: Position[]): Entry[] {
  // Una posición es el instrumento, no el broker (eso ya lo cubre el tab
  // "Broker") -> se unifica por ticker aunque esté repartida en varios
  // brokers, para no fragmentar la torta en porciones artificialmente chicas.
  const totals = new Map<string, number>();
  for (const p of positions) totals.set(p.ticker, (totals.get(p.ticker) ?? 0) + (p.valueArs ?? 0));

  return [...totals.entries()]
    .map(([ticker, value]) => ({ key: ticker, label: ticker, value }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((e, i) => ({ ...e, color: POSITION_RANK_COLORS[i % POSITION_RANK_COLORS.length] }));
}

function buildCategoryEntries(dimension: "broker" | "asset_type" | "currency", positions: Position[]): Entry[] {
  const labelMap = dimension === "broker" ? BROKER_LABELS : dimension === "asset_type" ? ASSET_TYPE_LABELS : CURRENCY_LABELS;
  const colorMap = dimension === "broker" ? BROKER_COLORS : dimension === "asset_type" ? ASSET_TYPE_COLORS : CURRENCY_COLORS;

  const totals = new Map<string, number>();
  for (const p of positions) {
    const k = dimension === "broker" ? p.broker : dimension === "asset_type" ? p.asset_type : p.costCurrency;
    totals.set(k, (totals.get(k) ?? 0) + (p.valueArs ?? 0));
  }

  return [...totals.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, label: labelMap[key] ?? key, value, color: colorMap[key] ?? OTHERS_COLOR }));
}

function buildEntries(dimension: Dimension, positions: Position[]): Entry[] {
  return dimension === "position" ? buildPositionEntries(positions) : buildCategoryEntries(dimension, positions);
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function slicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  // Clamp: A (arc) con start === end (100% de una sola entry) no dibuja nada.
  const clampedEnd = endAngle >= startAngle + 359.99 ? startAngle + 359.99 : endAngle;
  const start = polarPoint(cx, cy, r, startAngle);
  const end = polarPoint(cx, cy, r, clampedEnd);
  const largeArc = clampedEnd - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function withAngles(entries: Entry[], total: number) {
  let acc = 0;
  return entries.map((e) => {
    const pct = total > 0 ? e.value / total : 0;
    const startAngle = acc * 360;
    acc += pct;
    const endAngle = acc * 360;
    return { ...e, pct, startAngle, endAngle, midAngle: (startAngle + endAngle) / 2 };
  });
}

// Part-to-whole -> torta (a pedido explícito, en vez de la barra apilada
// horizontal que se usaba antes). El % de cada porción se imprime directo
// sobre el arco en tabular-nums para no perder precisión de lectura solo por
// haber cambiado de forma visual (comparar ángulos es menos preciso que
// comparar longitudes, ver dataviz/references/choosing-a-form.md; por eso el
// número siempre está presente y no depende solo del hover). Al pasar el
// mouse, la porción se separa levemente del centro y una tarjeta debajo
// muestra el detalle completo (monto + %). El desplazamiento de hover
// (6px, ver `.allocation-pie-slice:hover` en globals.css) usa --dx/--dy
// (vector unitario hacia el ángulo medio de cada porción) seteados acá.
export function AllocationBar({ positions }: { positions: Position[] }) {
  const { hidden } = useHideAmounts();
  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;
  const [dimension, setDimension] = useState<Dimension>("position");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const entries = useMemo(() => buildEntries(dimension, positions), [dimension, positions]);
  const total = entries.reduce((sum, e) => sum + e.value, 0);
  const slices = useMemo(() => withAngles(entries, total), [entries, total]);
  const hovered = slices.find((s) => s.key === hoveredKey) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {DIMENSIONS.map((d) => (
          <button
            key={d.id}
            onClick={() => setDimension(d.id)}
            className="text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer"
            style={{
              background: dimension === d.id ? "var(--text-primary)" : "var(--gridline)",
              color: dimension === d.id ? "var(--surface-1)" : "var(--text-secondary)",
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {total <= 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Todavía no hay valuación para calcular la distribución.
        </p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="allocation-pie relative shrink-0" style={{ width: 280, height: 280 }}>
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
              {slices.map((s) => {
                const dir = polarPoint(0, 0, 1, s.midAngle);
                return (
                  <g
                    key={s.key}
                    className="allocation-pie-slice"
                    style={{ "--dx": `${dir.x}`, "--dy": `${dir.y}` } as React.CSSProperties}
                    onMouseEnter={() => setHoveredKey(s.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                  >
                    <path
                      className="allocation-pie-slice-path"
                      d={slicePath(50, 50, 48, s.startAngle, s.endAngle)}
                      fill={s.color}
                      stroke="var(--surface-1)"
                      strokeWidth={1}
                    >
                      <title>{`${s.label}: ${formatArs(s.value)} (${formatShare(s.pct * 100)})`}</title>
                    </path>
                    {s.pct > 0.06 && (
                      <text
                        x={polarPoint(50, 50, 32, s.midAngle).x}
                        y={polarPoint(50, 50, 32, s.midAngle).y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="tabular-nums"
                        style={{ fontSize: 6, fill: "var(--accent-on)", pointerEvents: "none" }}
                      >
                        {formatShare(s.pct * 100)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="flex flex-col gap-2 min-w-0 w-full">
            <div
              className="rounded-md px-3 py-2 text-sm"
              style={{ background: "var(--gridline)", minHeight: 52, opacity: hovered ? 1 : 0.5, transition: "opacity 150ms" }}
            >
              {hovered ? (
                <>
                  <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {hovered.label}
                  </div>
                  <div className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {formatArs(hovered.value)} · {formatShare(hovered.pct * 100)}
                  </div>
                </>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>Pasá el mouse por una porción para ver el detalle.</span>
              )}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3 lg:grid-cols-4">
              {slices.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5 min-w-0">
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="truncate" style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                  <span className="tabular-nums shrink-0" style={{ color: "var(--text-secondary)" }}>
                    {formatShare(s.pct * 100)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
