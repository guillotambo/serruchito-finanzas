type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
};

// Estado "sin datos" / "datos insuficientes" reutilizable. Las páginas
// nuevas (Portfolio, Posiciones, Rendimiento) lo usan para las métricas que
// todavía no tienen suficiente historial, en vez de hardcodear texto suelto
// como hacía cada componente por separado.
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-8 px-4">
      {icon && (
        <div className="flex items-center justify-center w-9 h-9 rounded-full mb-1" style={{ background: "var(--gridline)", color: "var(--text-muted)" }}>
          {icon}
        </div>
      )}
      <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
        {title}
      </p>
      {description && (
        <p className="text-sm max-w-sm" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
