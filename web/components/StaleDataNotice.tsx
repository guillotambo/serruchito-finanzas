// Aviso no bloqueante: se sigue mostrando la última data buena (cache de
// SWR) mientras se avisa que la consulta más reciente falló, en vez de tapar
// toda la pantalla con ErrorState (eso solo cuando no hay ningún dato previo
// que mostrar, ver usos de usePortfolio en cada página).
export function StaleDataNotice({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div
      className="rounded-lg border p-3 flex items-center justify-between gap-4 text-sm"
      style={{ borderColor: "var(--status-warning)", background: "var(--surface-1)" }}
    >
      <p style={{ color: "var(--text-secondary)" }}>
        Mostrando el último dato guardado, no pudimos actualizar{message ? `: ${message}` : "."}
      </p>
      <button
        onClick={onRetry}
        className="font-medium px-3 py-1 rounded-md border shrink-0"
        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
      >
        Reintentar
      </button>
    </div>
  );
}
