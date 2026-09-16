import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getLiveSymbols } from "@/lib/quotes";
import { nativeCurrency, parseTransactionsCsv } from "@serruchito/core";
import type { AssetType, ImportError, ImportResponse, ResolvedImportRow } from "@serruchito/core";

/**
 * Importa movimientos desde una planilla CSV (ver packages/core/src/csv-import.ts
 * y public/plantilla-movimientos.csv). Body: `{ csv: string, dryRun?: boolean }`.
 * Con dryRun devuelve la vista previa (filas resueltas + errores) sin grabar;
 * sin dryRun graba solo si no hay ningún error, para no dejar una importación
 * a medias que después cueste identificar.
 *
 * Si la fila no trae "tipo", se deduce igual que el formulario: catálogo de
 * instrumentos -> movimientos previos del mismo ticker -> paneles live de
 * data912 (CEDEAR / acción argentina). En IBKR no se operan CEDEARs, así que
 * ahí el default es acción US.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (typeof body?.csv !== "string" || body.csv.trim() === "") {
    return NextResponse.json({ error: "No llegó el contenido de la planilla." }, { status: 400 });
  }
  const dryRun = body.dryRun === true;

  const parsed = parseTransactionsCsv(body.csv);
  const errors: ImportError[] = [...parsed.errors];
  const rows: ResolvedImportRow[] = [];

  const db = await getDb();
  const [catalog, previous] = await Promise.all([
    db.query<{ ticker: string; asset_type: AssetType }>(`SELECT ticker, asset_type FROM instruments`),
    db.query<{ ticker: string; asset_type: AssetType }>(`SELECT DISTINCT ON (ticker) ticker, asset_type FROM transactions ORDER BY ticker, id DESC`),
  ]);
  const catalogTypes = new Map(catalog.rows.map((r) => [r.ticker, r.asset_type]));
  const previousTypes = new Map(previous.rows.map((r) => [r.ticker, r.asset_type]));
  let livePanels: Map<string, AssetType> | null = null;

  for (const row of parsed.rows) {
    let assetType = row.asset_type;
    if (!assetType) {
      const known = previousTypes.get(row.ticker) ?? catalogTypes.get(row.ticker);
      if (row.broker === "ibkr") {
        assetType = known === "stock_us" || known === "etf" ? known : "stock_us";
      } else if (known) {
        assetType = known;
      } else {
        if (!livePanels) {
          livePanels = new Map();
          const symbols = await getLiveSymbols().catch(() => []);
          for (const s of symbols) {
            if (!livePanels.has(s.symbol)) livePanels.set(s.symbol, s.panel === "arg_cedears" ? "cedear" : "accion_arg");
          }
        }
        assetType = livePanels.get(row.ticker) ?? null;
      }
    }
    if (!assetType) {
      errors.push({ line: row.line, message: `no se pudo deducir el tipo de ${row.ticker}: completá la columna "tipo"` });
      continue;
    }
    rows.push({ ...row, asset_type: assetType, currency: row.currency ?? nativeCurrency(assetType) });
  }

  errors.sort((a, b) => a.line - b.line);

  if (dryRun || errors.length > 0 || rows.length === 0) {
    return NextResponse.json({ rows, errors, inserted: 0 } satisfies ImportResponse);
  }

  const params: unknown[] = [];
  const values = rows.map((r) => {
    const base = params.length;
    params.push(r.date, r.broker, r.ticker, r.asset_type, r.side, r.quantity, r.price, r.currency, r.fees, r.notes);
    return `(${Array.from({ length: 10 }, (_, i) => `$${base + i + 1}`).join(", ")})`;
  });
  const result = await db.query(
    `INSERT INTO transactions (date, broker, ticker, asset_type, side, quantity, price, currency, fees, notes)
     VALUES ${values.join(",\n")}`,
    params
  );

  return NextResponse.json({ rows, errors, inserted: result.rowCount ?? rows.length } satisfies ImportResponse, { status: 201 });
}
