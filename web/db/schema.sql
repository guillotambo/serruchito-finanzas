-- Esquema de la base de datos (Postgres / Supabase) para el dashboard de
-- inversiones. Modelo: libro de transacciones. El usuario carga movimientos,
-- el sistema calcula posiciones y trae precios de mercado de fuentes públicas.

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,                 -- ISO date (YYYY-MM-DD)
  broker TEXT NOT NULL CHECK (broker IN ('cocos', 'balanz', 'ibkr', 'iol')),
  ticker TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('cedear', 'accion_arg', 'stock_us', 'etf', 'bono', 'otro')),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity REAL NOT NULL CHECK (quantity > 0),
  price REAL NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('ARS', 'USD')),
  fees REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_ticker ON transactions (ticker);
CREATE INDEX IF NOT EXISTS idx_transactions_broker ON transactions (broker);

-- CREATE TABLE IF NOT EXISTS no toca una tabla ya creada: el CHECK de broker
-- hay que ensancharlo a mano cada vez que se suma un broker nuevo (ver
-- registro histórico: 'iol' se agregó después de la carga inicial).
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_broker_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_broker_check CHECK (broker IN ('cocos', 'balanz', 'ibkr', 'iol'));

CREATE TABLE IF NOT EXISTS dividends (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  broker TEXT NOT NULL CHECK (broker IN ('cocos', 'balanz', 'ibkr', 'iol')),
  ticker TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('ARS', 'USD')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dividends_ticker ON dividends (ticker);

ALTER TABLE dividends DROP CONSTRAINT IF EXISTS dividends_broker_check;
ALTER TABLE dividends ADD CONSTRAINT dividends_broker_check CHECK (broker IN ('cocos', 'balanz', 'ibkr', 'iol'));

-- Catálogo de instrumentos: permite mapear un CEDEAR a su subyacente y ratio,
-- y clasificar el tipo de activo. Editable desde la UI (override manual).
CREATE TABLE IF NOT EXISTS instruments (
  ticker TEXT PRIMARY KEY,
  name TEXT,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('cedear', 'accion_arg', 'stock_us', 'etf', 'bono', 'otro')),
  cedear_ratio REAL,           -- cantidad de CEDEARs equivalentes a 1 subyacente (ej. SPY = 60)
  underlying_ticker TEXT,      -- ticker del activo subyacente en el mercado de origen
  market TEXT                  -- 'BCBA' | 'NASDAQ' | 'NYSE' | etc.
);

-- Cache de precios para no golpear las APIs públicas en cada request
-- (rate limits) y poder mostrar el último dato conocido si una fuente cae.
-- Clave compuesta (ticker, asset_type): el mismo ticker puede representar
-- instrumentos distintos según el broker (ej. MSFT como CEDEAR en ARS vía
-- Cocos vs. MSFT como acción directa en USD vía IBKR), con precios que NO
-- son intercambiables.
CREATE TABLE IF NOT EXISTS price_cache (
  ticker TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('cedear', 'accion_arg', 'stock_us', 'etf', 'bono', 'otro')),
  price REAL NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('ARS', 'USD')),
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  -- Cierre del día hábil anterior (misma moneda que `price`), para calcular
  -- variación intradía sin guardar historia. Nullable: no todas las fuentes
  -- lo informan (ver lib/quotes.ts).
  previous_close REAL,
  PRIMARY KEY (ticker, asset_type)
);
ALTER TABLE price_cache ADD COLUMN IF NOT EXISTS previous_close REAL;

-- Saldos manuales que no vienen de una API de cotización (efectivo, plata en
-- el banco/billetera). A diferencia de transactions, no representan una
-- operación sobre un instrumento: son un monto fijo que el usuario carga y
-- ajusta a mano cuando cambia. `broker` es opcional: un saldo puede estar
-- asociado a un broker (efectivo sin invertir en Cocos) o ser independiente
-- (plata en el banco).
CREATE TABLE IF NOT EXISTS cash_holdings (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,          -- ej. "Efectivo Cocos", "Banco Galicia"
  broker TEXT CHECK (broker IN ('cocos', 'balanz', 'ibkr', 'iol')),
  amount REAL NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('ARS', 'USD')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cash_holdings DROP CONSTRAINT IF EXISTS cash_holdings_broker_check;
ALTER TABLE cash_holdings ADD CONSTRAINT cash_holdings_broker_check CHECK (broker IN ('cocos', 'balanz', 'ibkr', 'iol'));

-- Cache del dólar CCL (una sola fila, key fija).
CREATE TABLE IF NOT EXISTS fx_cache (
  key TEXT PRIMARY KEY,
  value REAL NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

-- Fotografía diaria del patrimonio, para poder graficar su evolución en el
-- tiempo. No reconstruye el pasado: la historia arranca el día que se activa
-- el cron (ver app/api/snapshots/route.ts). Una fila por día (upsert).
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  date DATE PRIMARY KEY,
  total_value_ars REAL NOT NULL,
  total_value_usd REAL NOT NULL,
  -- Costo total (PPC) de las tenencias del día, valuado en ARS. Junto con
  -- total_value_ars permite separar "aportaste plata nueva" (el costo salta)
  -- de "el mercado se movió" (el costo queda igual, el valor no) en la curva
  -- de evolución. Nullable: las filas creadas antes de este campo no lo tienen.
  total_cost_ars REAL,
  ccl REAL,
  -- Precio de un instrumento de referencia (SPY, proxy del S&P 500) el día
  -- del snapshot, para graficar el rendimiento del portafolio contra un
  -- benchmark. Nullable: si Yahoo Finance no responde ese día, no hay dato.
  spy_usd REAL,
  by_broker JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE portfolio_snapshots ADD COLUMN IF NOT EXISTS total_cost_ars REAL;
ALTER TABLE portfolio_snapshots ADD COLUMN IF NOT EXISTS spy_usd REAL;

-- Lista de seguimiento ("Mercado"): instrumentos que el usuario mira aunque no
-- los tenga en cartera. Mismo par (ticker, asset_type) que price_cache: MSFT
-- CEDEAR y MSFT acción US son dos filas distintas, con precios y series que NO
-- son intercambiables. Seguir el mismo ticker en dos asset_type es intencional.
CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('cedear', 'accion_arg', 'stock_us', 'etf', 'bono', 'otro')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticker, asset_type)
);
CREATE INDEX IF NOT EXISTS idx_watchlist_order ON watchlist (sort_order);

-- Serie histórica de cierres diarios: alimenta el sparkline de la lista y el
-- gráfico del detalle de un instrumento. `currency` es parte de la PK, no un
-- atributo: para un CEDEAR guardamos DOS series bajo el mismo
-- (ticker, asset_type) -> la ARS nativa (data912 /historical/{cedears,stocks})
-- y la del subyacente en USD (Yahoo, vía instruments.underlying_ticker). Ese
-- par es exactamente el toggle "ARS nativo / subyacente USD" del detalle.
CREATE TABLE IF NOT EXISTS price_history (
  ticker TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('cedear', 'accion_arg', 'stock_us', 'etf', 'bono', 'otro')),
  currency TEXT NOT NULL CHECK (currency IN ('ARS', 'USD')),
  date DATE NOT NULL,
  open REAL,
  high REAL,
  low REAL,
  close REAL NOT NULL,
  volume REAL,
  source TEXT NOT NULL,        -- 'data912.com' | 'finance.yahoo.com'
  -- Ticker realmente consultado en la fuente. Para la serie USD de YPFD es
  -- 'YPF' (el ADR), no 'YPFD': sin esto no hay forma de auditar de dónde
  -- salió la barra ni de detectar un underlying_ticker mal cargado.
  source_ticker TEXT NOT NULL,
  PRIMARY KEY (ticker, asset_type, currency, date)
);
CREATE INDEX IF NOT EXISTS idx_price_history_series
  ON price_history (ticker, asset_type, currency, date DESC);

-- Watermark + TTL por serie: con last_date el refresh inserta solo barras
-- nuevas (estado estacionario: 1 fila por serie por día) en vez de reescribir
-- toda la historia en cada refresh. last_error != null -> se sirve lo
-- cacheado en price_history marcado stale (misma degradación que getQuotes).
CREATE TABLE IF NOT EXISTS price_history_meta (
  ticker TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('cedear', 'accion_arg', 'stock_us', 'etf', 'bono', 'otro')),
  currency TEXT NOT NULL CHECK (currency IN ('ARS', 'USD')),
  source TEXT NOT NULL,
  source_ticker TEXT NOT NULL,
  first_date DATE,
  last_date DATE,
  fetched_at TEXT NOT NULL,    -- ISO, mismo formato que price_cache.fetched_at
  last_error TEXT,
  PRIMARY KEY (ticker, asset_type, currency)
);
