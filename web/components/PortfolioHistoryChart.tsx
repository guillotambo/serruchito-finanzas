"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AMOUNT_MASK, formatArs as formatArsRaw } from "@serruchito/core";
import type { Broker, PortfolioSnapshot } from "@serruchito/core";
import { useHideAmounts } from "@/lib/privacy-context";

export type Range = "7d" | "30d" | "90d" | "ytd" | "all";
type ViewMode = "value" | "indexed";

const RANGES: { id: Range; label: string }[] = [
  { id: "7d", label: "1S" },
  { id: "30d", label: "1M" },
  { id: "90d", label: "3M" },
  { id: "ytd", label: "YTD" },
  { id: "all", label: "Todo" },
];

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "value", label: "Patrimonio y aportes" },
  { id: "indexed", label: "Vs. dólar y S&P 500" },
];

function filterByRange<T extends { date: string }>(points: T[], range: Range): T[] {
  if (range === "all") return points;
  const now = new Date();
  let from: Date;
  if (range === "ytd") {
    from = new Date(now.getFullYear(), 0, 1);
  } else {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    from = new Date(now);
    from.setDate(from.getDate() - days);
  }
  const fromIso = from.toISOString().slice(0, 10);
  return points.filter((p) => p.date >= fromIso);
}

function formatDateLabel(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

// Indexa una serie a 100 en su primer valor no nulo dentro del rango
// visible, para comparar magnitudes de escalas distintas (ARS vs. USD vs.
// puntos de índice) en el mismo gráfico -> "indexado a una base común", ver
// dataviz/references/choosing-a-form.md ("Two measures of different scale").
function indexTo100(values: (number | null)[]): (number | null)[] {
  const base = values.find((v) => v != null && v > 0);
  if (base == null) return values.map(() => null);
  return values.map((v) => (v != null ? (v / base) * 100 : null));
}

function formatIndex(v: number): string {
  return v.toFixed(1);
}

// Dot custom que resalta el punto "en vivo" (hoy, valor actual del
// portfolio) con un círculo hueco más grande -> el resto de la serie son
// fotos guardadas al cierre y no llevan dot (curva limpia).
function makeLiveDot(liveDate: string | undefined, color: string) {
  return function LiveDot(props: { cx?: number; cy?: number; payload?: { date: string } }) {
    const { cx, cy, payload } = props;
    if (!liveDate || payload?.date !== liveDate || cx == null || cy == null) return <g />;
    return <circle cx={cx} cy={cy} r={5} fill="var(--surface-1)" stroke={color} strokeWidth={2} />;
  };
}

// Trend over time -> line/area, colores categóricos cuando hay más de una
// serie a distinguir (leyenda obligatoria a partir de 2 series). Filtros de
// rango en una fila arriba, presets antes que un rango custom. Ver
// dataviz/references/choosing-a-form.md e interaction.md.
export function PortfolioHistoryChart({
  snapshots,
  broker,
  defaultRange = "30d",
  liveDate,
}: {
  snapshots: PortfolioSnapshot[];
  broker: "all" | Broker;
  // La página Rendimiento monta este chart una vez por pestaña de período
  // (con `key` distinto), así cada pestaña arranca en el rango que le
  // corresponde en vez de siempre "30d".
  defaultRange?: Range;
  // Fecha (YYYY-MM-DD) del punto "en vivo" dentro de `snapshots`, si la
  // página lo agregó combinando el último snapshot guardado con el valor
  // actual del portfolio. Marca ese punto distinto y agrega un caption
  // aclarando qué es guardado vs. en vivo.
  liveDate?: string;
}) {
  const { hidden } = useHideAmounts();
  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;
  const [range, setRange] = useState<Range>(defaultRange);
  const [viewMode, setViewMode] = useState<ViewMode>("value");

  // Los aportes (costo) y los benchmarks son agregados de todo el
  // portafolio: no hay un desglose por broker guardado en el snapshot para
  // ellos (solo total_value_ars lo tiene, vía by_broker). Si hay un broker
  // filtrado, se cae a la vista simple de una sola línea.
  const canCompare = broker === "all";
  const effectiveMode: ViewMode = canCompare ? viewMode : "value";

  const filtered = useMemo(() => filterByRange(snapshots, range), [snapshots, range]);

  const valueSeries = useMemo(
    () =>
      filtered.map((s) => ({
        date: s.date,
        value: broker === "all" ? s.total_value_ars : (s.by_broker[broker] ?? 0),
        cost: broker === "all" ? s.total_cost_ars : null,
      })),
    [filtered, broker]
  );

  const indexedSeries = useMemo(() => {
    const patrimonio = indexTo100(filtered.map((s) => s.total_value_ars));
    const dolar = indexTo100(filtered.map((s) => s.ccl));
    const sp500 = indexTo100(filtered.map((s) => s.spy_usd));
    return filtered.map((s, i) => ({ date: s.date, patrimonio: patrimonio[i], dolar: dolar[i], sp500: sp500[i] }));
  }, [filtered]);

  if (snapshots.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Todavía no hay historial ni valor en vivo disponible. Se guarda una fotografía del patrimonio
        por día a partir de hoy — volvé en unos días para ver la evolución.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className="text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer"
              style={{
                background: range === r.id ? "var(--text-primary)" : "var(--gridline)",
                color: range === r.id ? "var(--surface-1)" : "var(--text-secondary)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        {canCompare && (
          <div className="flex flex-wrap gap-1.5">
            {VIEW_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id)}
                className="text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                style={{
                  background: effectiveMode === m.id ? "var(--text-primary)" : "var(--gridline)",
                  color: effectiveMode === m.id ? "var(--surface-1)" : "var(--text-secondary)",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {!canCompare && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Con un broker filtrado se muestra solo el valor de esa cuenta — los aportes y la comparación
          contra benchmarks son agregados de todo el portafolio.
        </p>
      )}

      {filtered.length < 2 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {snapshots.length === 1
            ? snapshots[0].date === liveDate
              ? `Todavía no guardaste ninguna foto — este es el valor de ahora (${formatArs(snapshots[0].total_value_ars)}). Guardá una foto para arrancar el historial.`
              : `Primer día de historial guardado (${formatArs(snapshots[0].total_value_ars)}). Con un solo punto todavía no hay curva para mostrar — mañana empieza a tomar forma.`
            : "No hay suficientes días en este rango todavía. Probá un rango más amplio."}
        </p>
      ) : effectiveMode === "value" ? (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={valueSeries} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="portfolioHistoryFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                formatter={(value, name) => [formatArs(Number(value)), name === "value" ? "Patrimonio" : "Capital aportado"]}
                contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                name="value"
                stroke="var(--series-1)"
                strokeWidth={2}
                fill="url(#portfolioHistoryFill)"
                dot={makeLiveDot(liveDate, "var(--series-1)")}
              />
              {broker === "all" && (
                <Line
                  type="monotone"
                  dataKey="cost"
                  name="cost"
                  stroke="var(--text-muted)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
          {broker === "all" && (
            <Legend
              items={[
                { color: "var(--series-1)", label: "Patrimonio" },
                { color: "var(--text-muted)", label: "Capital aportado (costo)", dashed: true },
              ]}
            />
          )}
          {liveDate && <LiveCaption />}
        </>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={indexedSeries} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
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
                tickFormatter={(v) => formatIndex(v)}
                tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
                labelFormatter={(label) => formatDateLabel(String(label))}
                formatter={(value, name) => [
                  value == null ? "—" : formatIndex(Number(value)),
                  name === "patrimonio" ? "Patrimonio" : name === "dolar" ? "Dólar CCL" : "S&P 500",
                ]}
                contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8 }}
              />
              <Line
                type="monotone"
                dataKey="patrimonio"
                name="patrimonio"
                stroke="var(--series-1)"
                strokeWidth={2}
                dot={makeLiveDot(liveDate, "var(--series-1)")}
                connectNulls
              />
              <Line type="monotone" dataKey="dolar" name="dolar" stroke="var(--series-3)" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="sp500" name="sp500" stroke="var(--series-4)" strokeWidth={2} dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
          <Legend
            items={[
              { color: "var(--series-1)", label: "Patrimonio" },
              { color: "var(--series-3)", label: "Dólar CCL" },
              { color: "var(--series-4)", label: "S&P 500" },
            ]}
          />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Todas las series arrancan en 100 al comienzo del rango elegido, para comparar el rendimiento
            aunque estén en unidades distintas (ARS, USD, puntos de índice).
          </p>
          {liveDate && <LiveCaption />}
        </>
      )}
    </div>
  );
}

function LiveCaption() {
  return (
    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
      El punto marcado (○) es el valor <strong>en vivo</strong>, calculado con los precios de ahora; el
      resto de la curva son fotos guardadas al cierre de cada día.
    </p>
  );
}

function Legend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-0.5"
            style={{ background: item.dashed ? "none" : item.color, borderTop: item.dashed ? `2px dashed ${item.color}` : "none" }}
          />
          <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
