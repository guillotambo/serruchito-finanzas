import { NextRequest, NextResponse } from "next/server";
import { getDb, isLocalDb } from "@/lib/db";
import { captureSnapshot } from "@/lib/snapshots";
import type { PortfolioSnapshot } from "@serruchito/core";

// Serie histórica para el gráfico de evolución del patrimonio. No hay
// reconstrucción del pasado: solo existen los días en que corrió el POST
// (cron diario, ver vercel.ts, o el disparo manual desde Rendimiento).
export async function GET() {
  const db = await getDb();
  // En modo local (lib/db.ts) no hay cron de Vercel: la foto del día se saca
  // la primera vez que se abre el gráfico ese día, si hay algo cargado.
  if (isLocalDb()) {
    const today = new Date().toISOString().slice(0, 10);
    const pending = await db.query(
      `SELECT 1 FROM transactions
       WHERE NOT EXISTS (SELECT 1 FROM portfolio_snapshots WHERE date = $1::date)
       LIMIT 1`,
      [today]
    );
    if (pending.rows.length > 0) {
      await captureSnapshot().catch((err) => console.error("No se pudo guardar la foto del día:", err));
    }
  }
  // `date::text`, no `date`: el driver `pg` parsea la columna DATE como un
  // JS Date y, al serializar a JSON, la convierte a UTC -> corre el día
  // según el timezone del servidor. Casteando a texto se devuelve el
  // "YYYY-MM-DD" tal cual está guardado, sin conversión de por medio.
  const result = await db.query<{
    date: string;
    total_value_ars: number;
    total_value_usd: number;
    total_cost_ars: number | null;
    ccl: number | null;
    spy_usd: number | null;
    by_broker: Record<string, number>;
  }>(
    `SELECT date::text AS date, total_value_ars, total_value_usd, total_cost_ars, ccl, spy_usd, by_broker
     FROM portfolio_snapshots ORDER BY date ASC`
  );
  const snapshots: PortfolioSnapshot[] = result.rows.map((row) => ({
    date: row.date,
    total_value_ars: row.total_value_ars,
    total_value_usd: row.total_value_usd,
    total_cost_ars: row.total_cost_ars,
    ccl: row.ccl,
    spy_usd: row.spy_usd,
    by_broker: row.by_broker,
  }));
  return NextResponse.json(snapshots);
}

// Dispara captureSnapshot(): el cron diario de Vercel manda el header con
// CRON_SECRET; el botón "Guardar foto ahora" de Rendimiento manda
// `{ manual: true }` en el body (same-origin, sin secret -> la app es de un
// solo usuario y el resto de los writes tampoco tienen auth). El upsert por
// fecha evita duplicar si ya hay foto de hoy.
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const body = await req.json().catch(() => null);
  const isManual = body?.manual === true;

  if (cronSecret && !isManual) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const result = await captureSnapshot();
  return NextResponse.json(result);
}
