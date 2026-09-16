import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Dividend } from "@serruchito/core";

export async function GET() {
  const db = await getDb();
  const result = await db.query<Dividend>(`SELECT * FROM dividends ORDER BY date DESC, id DESC`);
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, broker, ticker, amount, currency, notes } = body;

  if (!date || !broker || !ticker || amount == null || !currency) {
    return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
  }
  if (amount < 0) {
    return NextResponse.json({ error: "El monto debe ser positivo." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.query<Dividend>(
    `INSERT INTO dividends (date, broker, ticker, amount, currency, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [date, broker, String(ticker).toUpperCase(), amount, currency, notes ?? null]
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}
