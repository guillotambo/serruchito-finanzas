import { formatPct } from "@serruchito/core";
import type { BestWorstAsset } from "@serruchito/core";
import { Arrow } from "@/components/Arrow";

function AssetSummary({ label, asset, positive }: { label: string; asset: BestWorstAsset | null; positive: boolean }) {
  const color = positive ? "var(--status-good)" : "var(--status-critical)";
  return (
    <div className="min-w-0">
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {asset ? (
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {asset.ticker}
          </span>
          <span className="tabular-nums font-medium inline-flex items-center gap-0.5" style={{ color }}>
            <Arrow positive={positive} />
            {formatPct(asset.pnlPct)}
          </span>
        </div>
      ) : (
        <span className="mt-1 block text-sm" style={{ color }}>
          Sin datos
        </span>
      )}
    </div>
  );
}

// Retorno acumulado desde la compra (no diario -> eso ya está en
// "Movimientos del día"), por eso el label no aclara período.
export function BestWorstAsset({ best, worst }: { best: BestWorstAsset | null; worst: BestWorstAsset | null }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <AssetSummary label="Mejor activo" asset={best} positive />
      <AssetSummary label="Peor activo" asset={worst} positive={false} />
    </div>
  );
}
