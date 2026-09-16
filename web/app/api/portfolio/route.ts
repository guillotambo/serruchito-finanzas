import { NextRequest, NextResponse } from "next/server";
import { getPortfolioSummary } from "@/lib/getPortfolioSummary";

export async function GET(req: NextRequest) {
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
  try {
    const summary = await getPortfolioSummary(forceRefresh);
    return NextResponse.json(summary);
  } catch (err) {
    // Sin esto, una falla acá (DB caída, timeout) devuelve un 500 con body
    // vacío -> el cliente no tiene mensaje para mostrar ni para decidir si
    // vale la pena reintentar. Con el mensaje real, al menos se sabe qué pasó.
    console.error("GET /api/portfolio falló:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
