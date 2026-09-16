"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatArs, formatUsd, HISTORY_RANGES } from "@serruchito/core";
import type { AssetType, Currency, HistoryRange } from "@serruchito/core";
import { useHistory } from "@/lib/hooks";

function formatDateLabel(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

// Gráfico histórico de un instrumento, con toggle ARS nativo / subyacente
// USD (cuando hay underlying_ticker cargado). Calcado de PortfolioHistoryChart,
// pero sobre una sola serie -> ver web/lib/history.ts para de dónde sale cada
// una (data912 para ARS, Yahoo para USD).
export function InstrumentPriceChart({
  ticker,
  assetType,
  nativeCurrency,
  hasUsdSource,
}: {
  ticker: string;
  assetType: AssetType;
  nativeCurrency: Currency;
  // Si no hay underlying_ticker cargado para este instrumento, no hay fuente
  // para la serie USD -> se oculta el toggle en vez de mostrarlo y fallar.
  hasUsdSource: boolean;
}) {
  const [range, setRange] = useState<HistoryRange>("1y");
  const [currency, setCurrency] = useState<Currency>(nativeCurrency);
  const { data, isLoading } = useHistory(ticker, assetType, currency, range);
  const fmt = currency === "USD" ? formatUsd : formatArs;

  const points = data?.points ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {HISTORY_RANGES.map((r) => (
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
        {hasUsdSource && nativeCurrency === "ARS" && (
          <div className="flex flex-wrap gap-1.5">
            {(["ARS", "USD"] as Currency[]).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className="text-xs px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                style={{
                  background: currency === c ? "var(--text-primary)" : "var(--gridline)",
                  color: currency === c ? "var(--surface-1)" : "var(--text-secondary)",
                }}
              >
                {c === "ARS" ? "ARS nativo" : "Subyacente USD"}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && !data ? (
        <div className="skeleton h-64 w-full" />
      ) : points.length < 2 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {data?.firstDate
            ? `Historial disponible desde ${data.firstDate}. Probá un rango más amplio.`
            : "Todavía no hay historial cargado para este instrumento — vuelve a intentar en unos minutos."}
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={points} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="instrumentPriceFill" x1="0" y1="0" x2="0" y2="1">
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
                tickFormatter={(v) => fmt(v)}
                tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={90}
                domain={["auto", "auto"]}
              />
              <Tooltip
                cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
                labelFormatter={(label) => formatDateLabel(String(label))}
                formatter={(value) => [fmt(Number(value)), "Precio"]}
                contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8 }}
              />
              <Area type="monotone" dataKey="close" stroke="var(--series-1)" strokeWidth={2} fill="url(#instrumentPriceFill)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          {currency === "ARS" && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Precio de mercado sin ajustar por cambios de ratio ni splits.
              {hasUsdSource && " Para ver la tendencia larga del activo, probá el subyacente en USD."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
