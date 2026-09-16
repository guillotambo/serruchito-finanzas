"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSidebar } from "@/lib/sidebar-context";
import {
  IconDashboard,
  IconMarket,
  IconMovements,
  IconPerformance,
  IconPortfolio,
  IconSettings,
} from "@/components/shell/icons";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

// 6 ítems, sin segundo grupo: antes había un divisor entre "vista de
// cartera" y "carga/lectura" (Actividad/Transacciones/Dividendos fusionadas
// en Movimientos, ver /movimientos), pero con solo 6 rutas totales ya no
// hace falta separarlas visualmente.
const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: IconDashboard },
  { href: "/cartera", label: "Cartera", icon: IconPortfolio },
  { href: "/rendimiento", label: "Rendimiento", icon: IconPerformance },
  { href: "/mercado", label: "Mercado", icon: IconMarket },
  { href: "/movimientos", label: "Movimientos", icon: IconMovements },
  { href: "/ajustes", label: "Ajustes", icon: IconSettings },
];

function NavRow({ item, collapsed, active, onNavigate }: { item: NavItem; collapsed: boolean; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      // Nombre accesible explícito siempre (no depender del fallback de
      // `title`): cuando está colapsado el texto visible desaparece pero el
      // link sigue necesitando un nombre para lectores de pantalla.
      aria-label={item.label}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className="relative flex items-center gap-3 h-11 rounded-md px-3 text-sm font-medium transition-colors"
      style={{
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        background: active ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
      }}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full"
          style={{ background: "var(--accent)" }}
        />
      )}
      <Icon aria-hidden="true" className="w-[18px] h-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <div className="flex items-center gap-2.5 h-16 px-3">
        <img
          src="/serruchito.svg"
          alt=""
          aria-hidden="true"
          width={24}
          height={24}
          className="shrink-0"
        />
        {!collapsed && (
          <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            Serruchito
          </span>
        )}
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-3 py-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    </>
  );
}

export function Sidebar() {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();

  // Con el drawer abierto, el contenido de fondo no debe poder scrollear
  // (si no, en mobile el usuario pierde de referencia qué está "detrás").
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen, setMobileOpen]);

  return (
    <>
      {/* Desktop: columna fija, ancho anima al colapsar. */}
      <aside
        className="hidden md:flex flex-col shrink-0 h-screen sticky top-0 transition-[width] duration-200 border-r"
        style={{ width: collapsed ? 72 : 240, borderColor: "var(--border)", background: "var(--surface-1)" }}
      >
        <SidebarContent collapsed={collapsed} onNavigate={() => {}} />
      </aside>

      {/* Mobile: drawer sobre overlay, se abre desde el botón hamburguesa del Header. */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="relative z-50 flex flex-col w-64 h-full border-r"
            style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
          >
            <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
