import { NextResponse } from "next/server";
import { fetchBenchmarkPrice } from "@/lib/quotes";

// Precio en vivo de SPY (proxy del S&P 500), para el punto "en vivo" del
// gráfico de Rendimiento (ver app/rendimiento/page.tsx). Endpoint propio en
// vez de sumarlo a /api/portfolio: ese endpoint lo consumen Dashboard,
// Portfolio y Posiciones, que no necesitan el benchmark -> mezclarlo ahí
// les agregaría una llamada a Yahoo en cada carga sin usarla.
export async function GET() {
  const spyUsd = await fetchBenchmarkPrice("SPY");
  return NextResponse.json({ spyUsd });
}
