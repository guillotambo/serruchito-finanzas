import { Arrow } from "@/components/Arrow";

type StatTileProps = {
  label: string;
  value: string;
  sublabel?: string;
  delta?: { text: string; positive: boolean } | null;
  // "auto": el monto puede ser negativo -> el color (good/critical) ya
  // comunica el signo, así que se omite el "-" para no duplicar la señal.
  // "neutral" (default): monto que no representa una ganancia/pérdida
  // (ej. patrimonio total) -> sin color por signo, se conserva el "-" si
  // llegara a aparecer.
  tone?: "auto" | "neutral";
};

// Separa "-", "$" y el resto para poder achicar el símbolo de moneda y
// (en tono "auto") reemplazar el "-" por color en vez de imprimirlo.
function AmountValue({ value, tone }: { value: string; tone: "auto" | "neutral" }) {
  const match = value.match(/^(-)?(\$)(.*)$/);
  if (!match) return <>{value}</>;
  const [, sign, symbol, rest] = match;
  const color = tone === "auto" ? (sign ? "var(--status-critical)" : "var(--status-good)") : undefined;
  return (
    <span style={color ? { color } : undefined}>
      {tone === "neutral" && sign ? "-" : ""}
      <span style={{ fontSize: "0.6em" }}>{symbol}</span>
      {rest}
    </span>
  );
}

export function StatTile({ label, value, sublabel, delta, tone = "neutral" }: StatTileProps) {
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-1"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
        <AmountValue value={value} tone={tone} />
      </span>
      <div className="flex items-center gap-2 text-sm tabular-nums">
        {delta && (
          <span
            className="inline-flex items-center gap-0.5"
            style={{ color: delta.positive ? "var(--status-good)" : "var(--status-critical)" }}
          >
            <Arrow positive={delta.positive} />
            {delta.text}
          </span>
        )}
        {sublabel && <span style={{ color: "var(--text-muted)" }}>{sublabel}</span>}
      </div>
    </div>
  );
}
