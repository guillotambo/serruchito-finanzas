import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Reordena la watchlist: `order` es el array completo de ids en el orden
// deseado. Se reescribe sort_order entero (0..n-1) en una sola sentencia -> la
// lista es de decenas de filas, no hace falta un reindexado incremental.
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const order = body?.order;

  if (!Array.isArray(order) || order.some((id) => typeof id !== "number")) {
    return NextResponse.json({ error: "order debe ser un array de ids." }, { status: 400 });
  }

  const db = await getDb();
  await db.query(
    `UPDATE watchlist AS w SET sort_order = o.idx
     FROM unnest($1::int[]) WITH ORDINALITY AS o(id, idx)
     WHERE w.id = o.id`,
    [order]
  );
  return NextResponse.json({ ok: true });
}
