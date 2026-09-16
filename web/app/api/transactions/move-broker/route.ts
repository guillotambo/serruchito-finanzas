import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { BROKER_LABELS, BROKERS } from "@serruchito/core";
import type { Broker } from "@serruchito/core";

// Reasigna en bloque todas las transacciones de un broker a otro (ej. "moví
// todo de Cocos a IOL"). Es un UPDATE del campo `broker`, no una operación
// nueva: como calculatePositions (packages/core/src/portfolio.ts) recalcula
// PPC/cantidad desde cero a partir de las transacciones, esto preserva fechas,
// PPC y P&L exactos, y fusiona con lo que ya hubiera en destino (PPC
// ponderado). Deja rastro en `notes` porque reescribe de dónde "vino" cada
// operación histórica -> ver docs/plan de la transferencia.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { from, to } = body;

  if (!BROKERS.includes(from as Broker) || !BROKERS.includes(to as Broker)) {
    return NextResponse.json({ error: "Broker de origen o destino inválido." }, { status: 400 });
  }
  if (from === to) {
    return NextResponse.json({ error: "El broker de origen y destino no pueden ser el mismo." }, { status: 400 });
  }

  const db = await getDb();
  // Fecha en horario de Buenos Aires, mismo criterio que CASH_COLUMNS
  // (web/lib/db.ts) para created_date: se calcula en SQL contra `now()` del
  // propio servidor de Postgres, no con la hora del proceso Next.js.
  const { rows: nowRows } = await db.query<{ today: string }>(
    `SELECT to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS today`
  );
  const today = nowRows[0].today;
  const note = `Transferido de ${BROKER_LABELS[from] ?? from} a ${BROKER_LABELS[to] ?? to} el ${today}`;

  const result = await db.query<{ ticker: string }>(
    `UPDATE transactions
     SET broker = $1,
         notes = CASE
           WHEN notes IS NULL OR notes = '' THEN $3
           ELSE notes || ' · ' || $3
         END
     WHERE broker = $2
     RETURNING ticker`,
    [to, from, note]
  );

  const tickers = [...new Set(result.rows.map((r) => r.ticker))].sort();
  return NextResponse.json({ moved: result.rowCount ?? 0, tickers });
}
