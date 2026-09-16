import { sparklinePath } from "@serruchito/core";

// Mini-gráfico de línea sin ejes ni tooltip, para la fila de la watchlist.
// El color sigue el signo de la variación del período mostrado (mismo
// lenguaje que MoversList: verde/rojo, nunca un tercer hue).
export function Sparkline({ values, positive, width = 96, height = 32 }: { values: number[]; positive: boolean; width?: number; height?: number }) {
  if (values.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" />;
  }
  const d = sparklinePath(values, width, height);
  const color = positive ? "var(--status-good)" : "var(--status-critical)";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" role="presentation">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
