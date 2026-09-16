"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AMOUNT_MASK, formatArs as formatArsRaw } from "@serruchito/core";
import type { WeeklyPnl } from "@serruchito/core";
import { useHideAmounts } from "@/lib/privacy-context";

function formatWeekLabel(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

// Ganancia/pérdida por semana -> barras divergentes (positivo/negativo desde
// cero), color por signo con los mismos tokens de estado que el resto de la
// app (--status-good/--status-critical), nunca un color categórico nuevo.
export function WeeklyPnlChart({ weeks }: { weeks: WeeklyPnl[] }) {
  const { hidden } = useHideAmounts();
  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;
  if (weeks.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Sin datos para este período todavía: hacen falta al menos dos semanas con historial guardado.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={weeks} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--gridline)" />
        <XAxis
          dataKey="weekEnd"
          tickFormatter={formatWeekLabel}
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--axis)" }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={(v) => formatArs(v)}
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={90}
        />
        <Tooltip
          cursor={{ fill: "color-mix(in srgb, var(--axis) 15%, transparent)" }}
          labelFormatter={(label) => `Semana del ${formatWeekLabel(String(label))}`}
          formatter={(value) => [formatArs(Number(value)), "Ganancia"]}
          contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8 }}
        />
        <Bar dataKey="pnlArs" radius={[3, 3, 3, 3]}>
          {weeks.map((w) => (
            <Cell key={w.weekEnd} fill={w.pnlArs >= 0 ? "var(--status-good)" : "var(--status-critical)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
