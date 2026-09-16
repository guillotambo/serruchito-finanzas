"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AMOUNT_MASK, formatArs as formatArsRaw } from "@serruchito/core";
import { useHideAmounts } from "@/lib/privacy-context";

type MonthlyDividend = { month: string; amountArs: number };

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  return `${m}/${year.slice(2)}`;
}

// Calendario histórico de dividendos cobrados: una barra por mes con datos,
// mismo patrón visual que WeeklyPnlChart (barras + tokens de color de la
// app), pero sin divergencia de signo porque un dividendo cobrado siempre es
// positivo -> un solo color categórico (--series-1), no --status-good.
export function DividendCalendarChart({ months }: { months: MonthlyDividend[] }) {
  const { hidden } = useHideAmounts();
  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;
  if (months.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Todavía no hay dividendos cargados para armar un calendario.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={months} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--gridline)" />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonthLabel}
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
          labelFormatter={(label) => formatMonthLabel(String(label))}
          formatter={(value) => [formatArs(Number(value)), "Dividendos cobrados"]}
          contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8 }}
        />
        <Bar dataKey="amountArs" fill="var(--series-1)" radius={[3, 3, 3, 3]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
