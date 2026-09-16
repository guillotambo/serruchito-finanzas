import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { WatchlistItem } from "@serruchito/core";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const result = await db.query(`DELETE FROM watchlist WHERE id = $1`, [id]);
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "No está en la watchlist." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { note } = body;

  const db = await getDb();
  const result = await db.query<WatchlistItem>(
    `UPDATE watchlist SET note = $1 WHERE id = $2 RETURNING id, ticker, asset_type, sort_order, note`,
    [note ?? null, id]
  );
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "No está en la watchlist." }, { status: 404 });
  }
  return NextResponse.json(result.rows[0]);
}
