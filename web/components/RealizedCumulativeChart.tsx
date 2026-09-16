"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AMOUNT_MASK, formatArs as formatArsRaw } from "@serruchito/core";
import type { RealizedPoint } from "@serruchito/core";
import { useHideAmounts } from "@/lib/privacy-context";

function formatDateLabel(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

// Evolución de la ganancia tomada: cada venta o dividendo es un punto, así
// que la curva "escalona" en vez de suavizarse — es intencional, refleja
// eventos discretos, no una magnitud continua como el patrimonio.
export function RealizedCumulativeChart({ points }: { points: RealizedPoint[] }) {
  const { hidden } = useHideAmounts();
  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;

  if (points.length < 2) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {points.length === 0
          ? "Todavía no hay ventas ni dividendos en este período."
          : "Con un solo movimiento en este período todavía no hay curva para mostrar."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={points} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--gridline)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--axis)" }}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            tickFormatter={(v) => formatArs(v)}
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={90}
          />
          <Tooltip
            cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
            labelFormatter={(label) => formatDateLabel(String(label))}
            formatter={(value, name) => [formatArs(Number(value)), name === "totalArs" ? "Total tomado" : "Realizado (sin dividendos)"]}
            contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <Line type="stepAfter" dataKey="totalArs" name="totalArs" stroke="var(--series-1)" strokeWidth={2} dot={false} />
          <Line
            type="stepAfter"
            dataKey="realizedArs"
            name="realizedArs"
            stroke="var(--text-muted)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <li className="flex items-center gap-2">
          <span className="inline-block w-3 h-0.5" style={{ background: "var(--series-1)" }} />
          <span style={{ color: "var(--text-secondary)" }}>Total tomado (P&L realizado + dividendos)</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block w-3 h-0.5" style={{ borderTop: "2px dashed var(--text-muted)" }} />
          <span style={{ color: "var(--text-secondary)" }}>Solo P&L realizado</span>
        </li>
      </ul>
    </div>
  );
}
