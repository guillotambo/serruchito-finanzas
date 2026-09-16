import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@serruchito/core"],
  // PGlite (base local sin DATABASE_URL, ver lib/db.ts) carga su WASM y
  // extensiones desde node_modules en runtime: no se puede bundlear.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Rutas viejas de antes de consolidar la navegación a 5 pantallas (ver
  // AGENTS.md del plan): /portfolio + /posiciones se fusionaron en /cartera,
  // /actividad + /transacciones + /dividendos en /movimientos. No permanent
  // (307): puede volver a cambiar la forma de la nav más adelante.
  async redirects() {
    return [
      { source: "/portfolio", destination: "/cartera", permanent: false },
      { source: "/posiciones", destination: "/cartera?vista=cerradas", permanent: false },
      { source: "/actividad", destination: "/movimientos", permanent: false },
      { source: "/transacciones", destination: "/movimientos", permanent: false },
      { source: "/dividendos", destination: "/movimientos", permanent: false },
    ];
  },
};

export default nextConfig;
