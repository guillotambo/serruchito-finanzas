type ErrorStateProps = {
  message?: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      className="rounded-lg border p-4 flex items-center justify-between gap-4"
      style={{ borderColor: "var(--status-critical)", background: "var(--surface-1)" }}
    >
      <p className="text-sm" style={{ color: "var(--text-primary)" }}>
        No pudimos cargar estos datos{message ? `: ${message}` : "."}
      </p>
      <button
        onClick={onRetry}
        className="text-sm font-medium px-3 py-1.5 rounded-md border shrink-0"
        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
      >
        Reintentar
      </button>
    </div>
  );
}
