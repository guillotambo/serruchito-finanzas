import { NextRequest, NextResponse } from "next/server";
import { CASH_COLUMNS, getDb } from "@/lib/db";
import type { CashHolding } from "@serruchito/core";

export async function GET() {
  const db = await getDb();
  const result = await db.query<CashHolding>(`SELECT ${CASH_COLUMNS} FROM cash_holdings ORDER BY id DESC`);
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { label, broker, amount, currency, notes } = body;

  if (!label || amount == null || !currency) {
    return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
  }
  if (amount < 0) {
    return NextResponse.json({ error: "El monto debe ser positivo." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.query<CashHolding>(
    `INSERT INTO cash_holdings (label, broker, amount, currency, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${CASH_COLUMNS}`,
    [label, broker ?? null, amount, currency, notes ?? null]
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}
