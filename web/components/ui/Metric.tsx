/**
 * Fila etiqueta/valor de los paneles de detalle. Va dentro de un
 * `<dl className="divide-y">`.
 *
 * `signal` distingue tres estados a propósito:
 *   - sin pasar (undefined) -> dato neutro, tinta primaria
 *   - null                  -> el dato no se pudo calcular, tinta muted ("—")
 *   - number                -> se colorea por signo
 * La diferencia importa: un P&L de 0 no es lo mismo que un P&L desconocido.
 */
export function Metric({
  label,
  value,
  emphasis = false,
  signal,
  hint,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  signal?: number | null;
  /** Aclaración corta debajo de la etiqueta, para lo que no se explica solo. */
  hint?: string;
}) {
  const color =
    signal === undefined
      ? "var(--text-primary)"
      : signal == null
        ? "var(--text-muted)"
        : signal >= 0
          ? "var(--status-good)"
          : "var(--status-critical)";

  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-sm" style={{ color: "var(--text-muted)" }}>
        {label}
        {hint && (
          <span className="mt-0.5 block text-xs" style={{ color: "var(--text-muted)", opacity: 0.75 }}>
            {hint}
          </span>
        )}
      </dt>
      <dd
        className={`${emphasis ? "text-base font-semibold" : "text-sm font-medium"} text-right tabular-nums`}
        style={{ color }}
      >
        {value}
      </dd>
    </div>
  );
}

/** Bloque titulado dentro de un panel de detalle. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b py-5 last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <dl className="divide-y" style={{ borderColor: "var(--border)" }}>
        {children}
      </dl>
    </section>
  );
}
