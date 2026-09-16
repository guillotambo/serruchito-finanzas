export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando portafolio">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-6 w-32" />
          <div className="skeleton h-4 w-56" />
        </div>
        <div className="skeleton h-9 w-32" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-20 rounded-full" />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 flex flex-col gap-2" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-7 w-28" />
          </div>
        ))}
      </div>

      <div className="skeleton h-72 w-full" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="skeleton h-48 w-full" />
        <div className="skeleton h-48 w-full" />
      </div>

      <div className="skeleton h-64 w-full" />
    </div>
  );
}
