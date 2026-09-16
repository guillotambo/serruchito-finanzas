import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Dividend } from "@serruchito/core";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const result = await db.query(`DELETE FROM dividends WHERE id = $1`, [id]);
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Dividendo no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// Reemplazo completo, igual que el PUT de transactions: un campo ausente en
// el body pisa la columna con NULL, así que el cliente manda el registro
// entero, no un patch.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { date, broker, ticker, amount, currency, notes } = body;

  const db = await getDb();
  const result = await db.query<Dividend>(
    `UPDATE dividends
     SET date = $1, broker = $2, ticker = $3, amount = $4, currency = $5, notes = $6
     WHERE id = $7
     RETURNING *`,
    [date, broker, String(ticker).toUpperCase(), amount, currency, notes ?? null, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Dividendo no encontrado." }, { status: 404 });
  }
  return NextResponse.json(result.rows[0]);
}
