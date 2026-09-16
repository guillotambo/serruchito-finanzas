export type Broker = "cocos" | "balanz" | "ibkr" | "iol";
export type AssetType = "cedear" | "accion_arg" | "stock_us" | "etf" | "bono" | "otro";
export type Side = "buy" | "sell";
export type Currency = "ARS" | "USD";

export type Transaction = {
  id: number;
  date: string;
  broker: Broker;
  ticker: string;
  asset_type: AssetType;
  side: Side;
  quantity: number;
  price: number;
  currency: Currency;
  fees: number;
  notes: string | null;
};

export type Dividend = {
  id: number;
  date: string;
  broker: Broker;
  ticker: string;
  amount: number;
  currency: Currency;
  notes: string | null;
};

// Saldo manual (efectivo, banco) que no se actualiza por cotización de
// mercado -> ver db/schema.sql (cash_holdings).
export type CashHolding = {
  id: number;
  label: string;
  broker: Broker | null;
  amount: number;
  currency: Currency;
  notes: string | null;
  // Fecha de alta del saldo (ISO YYYY-MM-DD, hora de Buenos Aires; ver
  // CASH_COLUMNS en web/lib/db.ts). A diferencia de transactions.date no es la
  // fecha de una operación: el saldo se edita en el lugar, así que esto es
  // cuándo se cargó, no cuándo cambió el monto.
  created_date: string;
};

export type WatchlistItem = {
  id: number;
  ticker: string;
  asset_type: AssetType;
  sort_order: number;
  note: string | null;
};

// Resultado del buscador de tickers (GET /api/instruments/search): ver
// web/app/api/instruments/search/route.ts para la cascada de 3 fuentes
// (instruments -> paneles live de data912 -> Yahoo) que lo arma.
export type InstrumentSearchResult = {
  ticker: string;
  name: string | null;
  asset_type: AssetType;
  market: string | null;
  origin: "instruments" | "data912_cedear" | "data912_stock" | "yahoo";
  price: number | null;
  currency: Currency | null;
  underlying_ticker: string | null;
  inWatchlist: boolean;
};

export type Instrument = {
  ticker: string;
  name: string | null;
  asset_type: AssetType;
  cedear_ratio: number | null;
  underlying_ticker: string | null;
  market: string | null;
};

export type Quote = {
  ticker: string;
  price: number;
  currency: Currency;
  source: string;
  fetched_at: string;
  stale?: boolean;
  // Cierre del día hábil anterior, en la misma moneda que `price`. Permite
  // calcular la variación intradía sin necesidad de guardar historia. Puede
  // no estar disponible según la fuente (ver lib/quotes.ts).
  previousClose?: number | null;
};

// Estado calculado de una posición (ticker + broker), en su moneda nativa
// y convertido a ARS/USD usando el CCL.
export type Position = {
  ticker: string;
  broker: Broker;
  asset_type: AssetType;
  quantity: number;
  avgCost: number; // precio promedio de compra (PPC), en la moneda nativa de la posición
  costCurrency: Currency;
  marketPrice: number | null; // precio actual, en costCurrency
  priceStale: boolean;
  valueNative: number | null; // quantity * marketPrice
  costBasisNative: number; // quantity * avgCost
  unrealizedPnlNative: number | null;
  unrealizedPnlPct: number | null;
  valueArs: number | null;
  valueUsd: number | null;
  costBasisArs: number | null;
  costBasisUsd: number | null;
  unrealizedPnlArs: number | null;
  unrealizedPnlUsd: number | null;
  // Variación intradía (precio actual vs. cierre del día hábil anterior).
  // null si la fuente no informó `previousClose` para este instrumento.
  dayChangeNative: number | null; // (marketPrice - previousClose), en costCurrency
  dayChangePct: number | null;
  dayChangeArs: number | null; // quantity * dayChangeNative, convertido a ARS
};

export type PortfolioSummary = {
  positions: Position[];
  totalValueArs: number;
  totalValueUsd: number;
  totalCostArs: number;
  totalCostUsd: number;
  totalUnrealizedPnlArs: number;
  totalUnrealizedPnlUsd: number;
  totalRealizedPnlArs: number;
  totalRealizedPnlUsd: number;
  totalDividendsArs: number;
  totalDividendsUsd: number;
  // Suma de dayChangeArs de las posiciones que sí tienen previousClose.
  totalDayChangeArs: number;
  // % respecto del valor total ARS de ayer (totalValueArs - totalDayChangeArs).
  totalDayChangePct: number | null;
  ccl: number | null;
  ccpFetchedAt: string | null;
  // Detalle de cada venta cerrada (para el ledger de Posiciones), no solo
  // el agregado -> ver totalRealizedPnlArs/Usd para el total.
  realizedTrades: RealizedTrade[];
};

export type PortfolioSnapshot = {
  date: string; // ISO date (YYYY-MM-DD)
  total_value_ars: number;
  total_value_usd: number;
  total_cost_ars: number | null; // costo (PPC) de las tenencias del día, en ARS
  ccl: number | null;
  spy_usd: number | null; // precio de SPY (proxy S&P 500) ese día, para benchmark
  by_broker: Record<string, number>; // valueArs por broker, al momento del snapshot
};

export type RealizedTrade = {
  // Id de la transacción de venta que cerró el trade: es el enlace con el
  // feed de movimientos (ver buildMovementDetail) y una key estable para las
  // tablas, que si no tienen que combinar ticker+fecha y se pisan cuando hay
  // dos ventas del mismo ticker el mismo día.
  txId: number;
  ticker: string;
  broker: Broker;
  date: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  currency: Currency;
  pnlNative: number;
  pnlPct: number | null; // pnlNative / costo de lo vendido, null si el costo era 0
  pnlArs: number | null;
  pnlUsd: number | null;
};

// Ganancia tomada: ver packages/core/src/realized.ts.
export type RealizedPeriod = "month" | "year" | "all";

// Ventas cerradas de un mismo ticker (a través de brokers), colapsadas en
// un solo renglón -> "en AAPL llevo tomado $X en 3 ventas".
export type RealizedByTicker = {
  ticker: string;
  tradeCount: number;
  quantity: number;
  costArs: number | null;
  pnlArs: number | null;
  pnlUsd: number | null;
  pnlPct: number | null; // pnlArs / costArs, null si costArs es 0/null
};

// Punto de la curva de ganancia tomada acumulada (ventas + dividendos como
// eventos en el tiempo, en orden ascendente).
export type RealizedPoint = {
  date: string;
  realizedArs: number; // acumulado de P&L realizado hasta esta fecha inclusive
  dividendsArs: number; // acumulado de dividendos cobrados hasta esta fecha inclusive
  totalArs: number; // realizedArs + dividendsArs
};

export type RealizedSummary = {
  period: RealizedPeriod;
  trades: RealizedTrade[]; // filtrados por período, más reciente primero
  realizedPnlArs: number;
  realizedPnlUsd: number;
  dividendsArs: number;
  dividendsUsd: number;
  totalCashedArs: number; // realizedPnlArs + dividendsArs
  totalCashedUsd: number;
  winners: number; // ventas con pnlNative > 0
  losers: number; // ventas con pnlNative < 0
  byTicker: RealizedByTicker[]; // orden desc por pnlArs
  cumulative: RealizedPoint[]; // orden asc por fecha
};
