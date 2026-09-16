import { Pool, type QueryResultRow } from "pg";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { SEED_INSTRUMENTS } from "@/db/seed-instruments";

/**
 * Dos modos de base, misma interfaz (`Db`):
 *
 * - Con DATABASE_URL: Postgres (Supabase). Usar siempre la connection string
 *   del "Transaction pooler" de Supabase (puerto 6543, vía PgBouncer), no la
 *   conexión directa (5432): en un hosting serverless (Vercel) cada invocación
 *   puede abrir su propia conexión, y sin pooler se agota el límite de
 *   conexiones de Postgres muy rápido.
 * - Sin DATABASE_URL: PGlite (Postgres embebido en el proceso), persistido en
 *   `data/pgdata` (o DATA_DIR). Pensado para correr la app local sin crear
 *   ninguna cuenta; el SQL es el mismo.
 *
 * Singleton vía globalThis: en dev, Next.js recarga módulos entre requests
 * y no queremos abrir un pool nuevo ni re-sembrar el catálogo cada vez.
 */
export interface Db {
  query<T = QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
  exec(sql: string): Promise<void>;
}

declare global {

  var __portfolioDb: Db | undefined;

  var __portfolioDbReady: Promise<void> | undefined;
}

function createPgDb(connectionString: string): Db {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  return {
    query: async <T>(text: string, params?: unknown[]) => {
      const result = await pool.query(text, params);
      return { rows: result.rows as T[], rowCount: result.rowCount };
    },
    exec: async (sql) => {
      await pool.query(sql);
    },
  };
}

function createLocalDb(): Db {
  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data", "pgdata");
  fs.mkdirSync(dataDir, { recursive: true });
  const pglite = new PGlite(dataDir);
  return {
    query: async <T>(text: string, params?: unknown[]) => {
      const result = await pglite.query<T>(text, params);
      // PGlite solo informa affectedRows en escrituras; `pg` también cuenta
      // las filas de un SELECT en rowCount (hay rutas que lo usan así).
      return { rows: result.rows, rowCount: Math.max(result.affectedRows ?? 0, result.rows.length) };
    },
    exec: async (sql) => {
      await pglite.exec(sql);
    },
  };
}

/** true cuando la app corre con la base embebida (sin DATABASE_URL). */
export function isLocalDb(): boolean {
  return !process.env.DATABASE_URL;
}

function createDb(): Db {
  const connectionString = process.env.DATABASE_URL;
  return connectionString ? createPgDb(connectionString) : createLocalDb();
}

async function initSchema(db: Db): Promise<void> {
  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  await db.exec(schema);

  for (const row of SEED_INSTRUMENTS) {
    await db.query(
      `INSERT INTO instruments (ticker, name, asset_type, cedear_ratio, underlying_ticker, market)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (ticker) DO NOTHING`,
      [row.ticker, row.name, row.asset_type, row.cedear_ratio, row.underlying_ticker, row.market]
    );
  }
}

/**
 * Columnas a devolver al leer `cash_holdings`. No se usa `SELECT *` porque el
 * cliente necesita la fecha de alta como fecha ISO (`created_date`) y no como
 * el timestamptz crudo: sliceando el timestamp en UTC, un saldo cargado
 * después de las 21:00 en Argentina caería en el día siguiente y aparecería
 * fuera de lugar en el feed de Actividad.
 */
export const CASH_COLUMNS = `id, label, broker, amount, currency, notes,
  to_char(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS created_date`;

export async function getDb(): Promise<Db> {
  if (!global.__portfolioDb) {
    global.__portfolioDb = createDb();
  }
  if (!global.__portfolioDbReady) {
    global.__portfolioDbReady = initSchema(global.__portfolioDb);
  }
  await global.__portfolioDbReady;
  return global.__portfolioDb;
}
