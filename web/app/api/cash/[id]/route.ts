import { NextRequest, NextResponse } from "next/server";
import { CASH_COLUMNS, getDb } from "@/lib/db";
import type { CashHolding } from "@serruchito/core";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const result = await db.query(`DELETE FROM cash_holdings WHERE id = $1`, [id]);
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Saldo no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { label, broker, amount, currency, notes } = body;

  const db = await getDb();
  const result = await db.query<CashHolding>(
    `UPDATE cash_holdings
     SET label = $1, broker = $2, amount = $3, currency = $4, notes = $5
     WHERE id = $6
     RETURNING ${CASH_COLUMNS}`,
    [label, broker ?? null, amount, currency, notes ?? null, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Saldo no encontrado." }, { status: 404 });
  }
  return NextResponse.json(result.rows[0]);
}
