import { formatPct } from "@serruchito/core";
import type { Position } from "@serruchito/core";
import { Arrow } from "@/components/Arrow";

type Mover = { ticker: string; dayChangePct: number };

// Identidad + polaridad (quién sube/baja hoy y cuánto) -> dos listas cortas
// ordenadas por magnitud, con el signo llevado únicamente por color de
// estado (good/critical), nunca por un tercer hue. Ver
// dataviz/references/choosing-a-form.md.
export function MoversList({ positions }: { positions: Position[] }) {
  const withChange = positions.filter(
    (p): p is Position & { dayChangePct: number } => p.dayChangePct != null
  );

  if (withChange.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Todavía no hay variación del día disponible para tus posiciones.
      </p>
    );
  }

  // Un mismo ticker puede estar en más de un broker (ej. YPFD en Cocos y
  // Balanz) -> se consolida en una sola fila, ponderando el % del día por
  // el valor de cada posición (una posición grande pesa más que una chica).
  const byTicker = new Map<string, { weightedPct: number; weight: number }>();
  for (const p of withChange) {
    const weight = p.valueArs && p.valueArs > 0 ? p.valueArs : 1;
    const prev = byTicker.get(p.ticker);
    byTicker.set(p.ticker, {
      weightedPct: (prev?.weightedPct ?? 0) + p.dayChangePct * weight,
      weight: (prev?.weight ?? 0) + weight,
    });
  }
  const consolidated: Mover[] = [...byTicker.entries()].map(([ticker, v]) => ({
    ticker,
    dayChangePct: v.weightedPct / v.weight,
  }));

  const sorted = consolidated.sort((a, b) => b.dayChangePct - a.dayChangePct);
  const gainers = sorted.filter((p) => p.dayChangePct > 0).slice(0, 5);
  const losers = sorted
    .filter((p) => p.dayChangePct < 0)
    .slice(-5)
    .reverse();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      <MoverGroup title="Suben hoy" items={gainers} positive />
      <div className="hidden w-px self-stretch sm:block" style={{ background: "var(--border)" }} />
      <MoverGroup title="Bajan hoy" items={losers} positive={false} />
    </div>
  );
}

function MoverGroup({ title, items, positive }: { title: string; items: Mover[]; positive: boolean }) {
  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-xs font-medium mb-2.5" style={{ color: "var(--text-muted)" }}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sin movimientos {positive ? "positivos" : "negativos"} hoy.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5" style={{ "--row-status": positive ? "var(--status-good)" : "var(--status-critical)" } as React.CSSProperties}>
          {items.map((p) => (
            <span
              key={p.ticker}
              className="market-mover-chip inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
            >
              <span style={{ color: "var(--text-primary)" }}>{p.ticker}</span>
              <span
                className="tabular-nums font-medium inline-flex items-center gap-0.5"
                style={{ color: positive ? "var(--status-good)" : "var(--status-critical)" }}
              >
                <Arrow positive={positive} />
                {formatPct(p.dayChangePct)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
