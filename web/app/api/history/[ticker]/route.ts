import { NextRequest, NextResponse } from "next/server";
import { getHistory } from "@/lib/history";
import type { AssetType, Currency, HistoryRange } from "@serruchito/core";

const ASSET_TYPES: AssetType[] = ["cedear", "accion_arg", "stock_us", "etf", "bono", "otro"];
const CURRENCIES: Currency[] = ["ARS", "USD"];
const RANGES: HistoryRange[] = ["1w", "1m", "3m", "6m", "1y", "5y", "max"];
const MAX_POINTS = 500; // tope duro además del default del endpoint: nunca mandar la serie cruda al cliente

// Serie histórica de un instrumento (para el sparkline y el gráfico de
// detalle en Mercado). `?currency=` es el toggle ARS nativo / subyacente USD.
export async function GET(req: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const assetType = req.nextUrl.searchParams.get("asset_type") as AssetType | null;
  const currency = (req.nextUrl.searchParams.get("currency") ?? "ARS") as Currency;
  const range = (req.nextUrl.searchParams.get("range") ?? "1y") as HistoryRange;
  const pointsParam = req.nextUrl.searchParams.get("points");
  const points = pointsParam ? Math.min(MAX_POINTS, Math.max(1, Number(pointsParam))) : undefined;
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";

  if (!assetType || !ASSET_TYPES.includes(assetType)) {
    return NextResponse.json({ error: "asset_type inválido o faltante." }, { status: 400 });
  }
  if (!CURRENCIES.includes(currency)) {
    return NextResponse.json({ error: "currency debe ser ARS o USD." }, { status: 400 });
  }
  if (!RANGES.includes(range)) {
    return NextResponse.json({ error: "range inválido." }, { status: 400 });
  }
  if (pointsParam != null && Number.isNaN(Number(pointsParam))) {
    return NextResponse.json({ error: "points debe ser numérico." }, { status: 400 });
  }

  const series = await getHistory(ticker.toUpperCase(), assetType, currency, range, forceRefresh, points);
  return NextResponse.json(series);
}
