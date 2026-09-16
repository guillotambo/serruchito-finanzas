import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Transaction } from "@serruchito/core";

export async function GET() {
  const db = await getDb();
  const result = await db.query<Transaction>(`SELECT * FROM transactions ORDER BY date DESC, id DESC`);
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, broker, ticker, asset_type, side, quantity, price, currency, fees, notes } = body;

  if (!date || !broker || !ticker || !asset_type || !side || !quantity || price == null || !currency) {
    return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
  }
  if (quantity <= 0 || price < 0) {
    return NextResponse.json({ error: "Cantidad y precio deben ser positivos." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.query<Transaction>(
    `INSERT INTO transactions (date, broker, ticker, asset_type, side, quantity, price, currency, fees, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [date, broker, String(ticker).toUpperCase(), asset_type, side, quantity, price, currency, fees ?? 0, notes ?? null]
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}
