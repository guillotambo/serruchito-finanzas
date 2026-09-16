// Seed inicial del catálogo de instrumentos: CEDEARs y ETFs más comunes
// operados por inversores argentinos, con su ratio de conversión conocido
// (cantidad de CEDEARs = 1 acción subyacente). Los ratios cambian de tanto
// en tanto (ver https://www.rankia.com.ar/blog/cedear/6752496) — si alguno
// queda desactualizado, se puede corregir a mano desde la UI de instrumentos.
export type SeedInstrument = {
  ticker: string;
  name: string;
  asset_type: "cedear" | "accion_arg" | "stock_us" | "etf" | "bono" | "otro";
  cedear_ratio: number | null;
  underlying_ticker: string | null;
  market: string | null;
};

export const SEED_INSTRUMENTS: SeedInstrument[] = [
  // CEDEARs de acciones individuales (ratio: CEDEARs por 1 acción subyacente)
  { ticker: "AAPL", name: "Apple Inc.", asset_type: "cedear", cedear_ratio: 20, underlying_ticker: "AAPL", market: "NASDAQ" },
  { ticker: "MSFT", name: "Microsoft Corp.", asset_type: "cedear", cedear_ratio: 25, underlying_ticker: "MSFT", market: "NASDAQ" },
  { ticker: "AMZN", name: "Amazon.com Inc.", asset_type: "cedear", cedear_ratio: 144, underlying_ticker: "AMZN", market: "NASDAQ" },
  { ticker: "GOOGL", name: "Alphabet Inc. Class A", asset_type: "cedear", cedear_ratio: 20, underlying_ticker: "GOOGL", market: "NASDAQ" },
  { ticker: "TSLA", name: "Tesla Inc.", asset_type: "cedear", cedear_ratio: 15, underlying_ticker: "TSLA", market: "NASDAQ" },
  { ticker: "META", name: "Meta Platforms Inc.", asset_type: "cedear", cedear_ratio: 24, underlying_ticker: "META", market: "NASDAQ" },
  { ticker: "NVDA", name: "NVIDIA Corp.", asset_type: "cedear", cedear_ratio: 24, underlying_ticker: "NVDA", market: "NASDAQ" },
  { ticker: "KO", name: "Coca-Cola Co.", asset_type: "cedear", cedear_ratio: 8, underlying_ticker: "KO", market: "NYSE" },
  { ticker: "DIS", name: "Walt Disney Co.", asset_type: "cedear", cedear_ratio: 4, underlying_ticker: "DIS", market: "NYSE" },
  { ticker: "NFLX", name: "Netflix Inc.", asset_type: "cedear", cedear_ratio: 30, underlying_ticker: "NFLX", market: "NASDAQ" },
  { ticker: "AMD", name: "Advanced Micro Devices, Inc.", asset_type: "cedear", cedear_ratio: 10, underlying_ticker: "AMD", market: "NASDAQ" },

  { ticker: "ARM", name: "Arm Holdings plc", asset_type: "cedear", cedear_ratio: 27, underlying_ticker: "ARM", market: "NASDAQ" },
  { ticker: "MU", name: "Micron Technology Inc.", asset_type: "cedear", cedear_ratio: 5, underlying_ticker: "MU", market: "NASDAQ" },
  { ticker: "OKLO", name: "Oklo Inc.", asset_type: "cedear", cedear_ratio: 28, underlying_ticker: "OKLO", market: "NYSE" },
  { ticker: "SPCX", name: "Space Exploration Technologies Corp. (SpaceX)", asset_type: "cedear", cedear_ratio: 50, underlying_ticker: "SPCX", market: "NASDAQ" },

  // CEDEARs de ETFs
  { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", asset_type: "cedear", cedear_ratio: 60, underlying_ticker: "SPY", market: "NYSEARCA" },
  { ticker: "QQQ", name: "Invesco QQQ Trust", asset_type: "cedear", cedear_ratio: 40, underlying_ticker: "QQQ", market: "NASDAQ" },
  { ticker: "DIA", name: "SPDR Dow Jones Industrial Average ETF", asset_type: "cedear", cedear_ratio: 20, underlying_ticker: "DIA", market: "NYSEARCA" },
  { ticker: "ARKK", name: "ARK Innovation ETF", asset_type: "cedear", cedear_ratio: 4, underlying_ticker: "ARKK", market: "NYSEARCA" },

  // Acciones argentinas líderes (BCBA). Las que cotizan también como ADR en
  // EE.UU. llevan underlying_ticker + ratio: permite calcular un precio ARS
  // (ADR en USD x CCL / ratio) sin depender de una fuente de datos local,
  // usando las mismas fuentes públicas que ya funcionan de forma confiable
  // (Yahoo Finance + dolarapi). Ratios verificados contra sus prospectos/ADR:
  // GGAL 10 acciones = 1 ADS, PAM 25 acciones = 1 ADS, YPF 1 acción = 1 ADS.
  { ticker: "GGAL", name: "Grupo Financiero Galicia", asset_type: "accion_arg", cedear_ratio: 10, underlying_ticker: "GGAL", market: "BCBA" },
  { ticker: "YPFD", name: "YPF S.A.", asset_type: "accion_arg", cedear_ratio: 1, underlying_ticker: "YPF", market: "BCBA" },
  { ticker: "PAMP", name: "Pampa Energía", asset_type: "accion_arg", cedear_ratio: 25, underlying_ticker: "PAM", market: "BCBA" },
  // ALUA no tiene ADR en EE.UU.: sin fuente pública sin credenciales, requiere
  // data912 (si está disponible) o carga manual del precio.
  { ticker: "ALUA", name: "Aluar", asset_type: "accion_arg", cedear_ratio: null, underlying_ticker: null, market: "BCBA" },

  // Stocks/ETFs en USD para posiciones directas en IBKR
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", asset_type: "etf", cedear_ratio: null, underlying_ticker: null, market: "NYSEARCA" },
  { ticker: "VTI", name: "Vanguard Total Stock Market ETF", asset_type: "etf", cedear_ratio: null, underlying_ticker: null, market: "NYSEARCA" },
];
