import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Transaction } from "@serruchito/core";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const result = await db.query(`DELETE FROM transactions WHERE id = $1`, [id]);
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Transacción no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { date, broker, ticker, asset_type, side, quantity, price, currency, fees, notes } = body;

  const db = await getDb();
  const result = await db.query<Transaction>(
    `UPDATE transactions
     SET date = $1, broker = $2, ticker = $3, asset_type = $4, side = $5,
         quantity = $6, price = $7, currency = $8, fees = $9, notes = $10
     WHERE id = $11
     RETURNING *`,
    [date, broker, String(ticker).toUpperCase(), asset_type, side, quantity, price, currency, fees ?? 0, notes ?? null, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Transacción no encontrada." }, { status: 404 });
  }
  return NextResponse.json(result.rows[0]);
}
