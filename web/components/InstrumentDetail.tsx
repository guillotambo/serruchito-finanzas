"use client";

import Link from "next/link";
import { AMOUNT_MASK, ASSET_TYPE_LABELS, formatArs as formatArsRaw, formatPct, formatUsd as formatUsdRaw, nativeCurrency } from "@serruchito/core";
import type { AssetType } from "@serruchito/core";
import { Arrow } from "@/components/Arrow";
import { InstrumentPriceChart } from "@/components/InstrumentPriceChart";
import { YourPositionCard } from "@/components/YourPositionCard";
import { useInstruments, useWatchlist } from "@/lib/hooks";
import { useHideAmounts } from "@/lib/privacy-context";

export function InstrumentDetail({ ticker, assetType }: { ticker: string; assetType: AssetType }) {
  const { data: watchlist } = useWatchlist();
  const { data: instruments } = useInstruments();
  const { hidden } = useHideAmounts();

  const row = watchlist?.rows.find((r) => r.ticker === ticker && r.asset_type === assetType) ?? null;
  const instrument = instruments?.find((i) => i.ticker === ticker && i.asset_type === assetType) ?? null;

  const currency = row?.currency ?? nativeCurrency(assetType);
  const formatArs = hidden ? () => AMOUNT_MASK : formatArsRaw;
  const formatUsd = hidden ? () => AMOUNT_MASK : formatUsdRaw;
  const fmt = currency === "USD" ? formatUsd : formatArs;
  const positive = (row?.dayChangePct ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/mercado" className="text-sm" style={{ color: "var(--text-secondary)" }}>
          ← Mercado
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{ticker}</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {(instrument?.name ?? row?.name) ?? ASSET_TYPE_LABELS[assetType]} · {ASSET_TYPE_LABELS[assetType]}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">{row?.price != null ? fmt(row.price) : "—"}</p>
            {row?.dayChangePct != null && (
              <p className="tabular-nums font-medium inline-flex items-center gap-0.5 justify-end" style={{ color: positive ? "var(--status-good)" : "var(--status-critical)" }}>
                <Arrow positive={positive} />
                {formatPct(row.dayChangePct)}
              </p>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-lg border p-5" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <InstrumentPriceChart
          ticker={ticker}
          assetType={assetType}
          nativeCurrency={nativeCurrency(assetType)}
          hasUsdSource={!!instrument?.underlying_ticker}
        />
      </section>

      <YourPositionCard ticker={ticker} assetType={assetType} />
    </div>
  );
}
