import type { Currency, Dividend, PortfolioSnapshot, Position, Transaction } from "./types";

/**
 * Métricas de riesgo/retorno para las páginas Portfolio y Rendimiento.
 * Funciones puras (mismo criterio que lib/portfolio.ts): reciben datos ya
 * cargados y devuelven `null` cuando no hay suficiente historia para que el
 * número signifique algo, en vez de forzar un cálculo sobre 1-2 puntos.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_YEAR = 365;

function toArs(amount: number, currency: Currency, ccl: number | null): number | null {
  if (currency === "ARS") return amount;
  return ccl ? amount * ccl : null;
}

export type Concentration = {
  topSharePct: number; // % del valor total que representan los top N activos
  topTickers: string[];
  n: number;
};

// Concentración: qué porcentaje del valor total explican los N activos más
// grandes (default top 3). Usa valueArs porque es la moneda de referencia
// del resto del dashboard.
export function computeConcentration(positions: Position[], topN = 3): Concentration | null {
  const withValue = positions.filter((p) => p.valueArs != null && p.valueArs > 0);
  if (withValue.length === 0) return null;

  const total = withValue.reduce((sum, p) => sum + p.valueArs!, 0);
  if (total <= 0) return null;

  const sorted = [...withValue].sort((a, b) => b.valueArs! - a.valueArs!);
  const top = sorted.slice(0, topN);
  const topShare = top.reduce((sum, p) => sum + p.valueArs!, 0);

  return {
    topSharePct: (topShare / total) * 100,
    topTickers: top.map((p) => p.ticker),
    n: top.length,
  };
}

export type BestWorstAsset = { ticker: string; pnlPct: number };

// Mejor/peor activo por retorno acumulado (unrealizedPnlPct), no por
// variación diaria: el % diario ya se muestra en "Movimientos del día" y en
// la tabla de posiciones, así que esta card aporta una lectura distinta
// (cómo le fue a cada activo desde que lo compraste, sin importar cuándo).
// Un mismo ticker repartido en más de un broker se unifica ponderando el %
// por costo histórico (mismo criterio que unificar por ticker en
// AllocationBar/MoversList).
export function computeBestWorstAsset(positions: Position[]): { best: BestWorstAsset | null; worst: BestWorstAsset | null } {
  const withPnl = positions.filter((p) => p.unrealizedPnlPct != null && p.costBasisNative > 0);
  if (withPnl.length === 0) return { best: null, worst: null };

  const byTicker = new Map<string, { weightedPct: number; weight: number }>();
  for (const p of withPnl) {
    const prev = byTicker.get(p.ticker);
    byTicker.set(p.ticker, {
      weightedPct: (prev?.weightedPct ?? 0) + p.unrealizedPnlPct! * p.costBasisNative,
      weight: (prev?.weight ?? 0) + p.costBasisNative,
    });
  }

  const consolidated = [...byTicker.entries()]
    .map(([ticker, v]) => ({ ticker, pnlPct: v.weightedPct / v.weight }))
    .sort((a, b) => b.pnlPct - a.pnlPct);

  return { best: consolidated[0] ?? null, worst: consolidated[consolidated.length - 1] ?? null };
}

export type Hhi = {
  hhi: number; // 0 (totalmente diversificado) a 10000 (una sola posición)
  interpretation: "diversificado" | "moderado" | "concentrado";
};

// Índice Herfindahl-Hirschman: suma de las participaciones (en %) al
// cuadrado. A diferencia de "% de los top N", captura la concentración real
// de toda la cartera (una cartera de 20 posiciones parejas da un HHI bajo,
// una de 20 posiciones con una al 90% da un HHI alto aunque "top 3" no lo
// muestre si esa posición sola ya es el 90%). Bandas de interpretación
// tomadas de la convención de HHI para concentración de mercado (DOJ/FTC):
// <1500 diversificado, 1500-2500 moderado, >2500 concentrado.
export function computeHHI(positions: Position[]): Hhi | null {
  const withValue = positions.filter((p) => p.valueArs != null && p.valueArs > 0);
  if (withValue.length === 0) return null;

  const total = withValue.reduce((sum, p) => sum + p.valueArs!, 0);
  if (total <= 0) return null;

  const hhi = withValue.reduce((sum, p) => {
    const sharePct = (p.valueArs! / total) * 100;
    return sum + sharePct * sharePct;
  }, 0);

  const interpretation = hhi < 1500 ? "diversificado" : hhi < 2500 ? "moderado" : "concentrado";
  return { hhi, interpretation };
}

export type ConcentrationEntry = { key: string; sharePct: number };

// Concentración por broker o por moneda: en una cartera multi-broker/
// multi-moneda, cuánto pesa cada uno importa tanto o más que la concentración
// por ticker (ver computeConcentration/computeHHI).
export function computeConcentrationByDimension(positions: Position[], dimension: "broker" | "currency"): ConcentrationEntry[] {
  const withValue = positions.filter((p) => p.valueArs != null && p.valueArs > 0);
  const total = withValue.reduce((sum, p) => sum + p.valueArs!, 0);
  if (total <= 0) return [];

  const totals = new Map<string, number>();
  for (const p of withValue) {
    const key = dimension === "broker" ? p.broker : p.costCurrency;
    totals.set(key, (totals.get(key) ?? 0) + p.valueArs!);
  }

  return [...totals.entries()]
    .map(([key, value]) => ({ key, sharePct: (value / total) * 100 }))
    .sort((a, b) => b.sharePct - a.sharePct);
}

type Cashflow = { date: string; amountArs: number };

// TIR anualizada (XIRR): resuelve la tasa r tal que la suma de los cashflows
// descontados a r sea 0, con cada flujo pesado por su distancia en años a la
// primera fecha. Newton-Raphson con guarda de convergencia; si no converge o
// los datos no alcanzan (menos de 2 flujos, o todos del mismo signo -> no
// hay tasa que resuelva la ecuación) devuelve null en vez de un número
// inventado.
function xirr(cashflows: Cashflow[]): number | null {
  if (cashflows.length < 2) return null;

  const hasInflow = cashflows.some((cf) => cf.amountArs > 0);
  const hasOutflow = cashflows.some((cf) => cf.amountArs < 0);
  if (!hasInflow || !hasOutflow) return null;

  const t0 = new Date(cashflows[0].date).getTime();
  const years = cashflows.map((cf) => (new Date(cf.date).getTime() - t0) / MS_PER_DAY / DAYS_PER_YEAR);

  const npv = (r: number) => cashflows.reduce((sum, cf, i) => sum + cf.amountArs / Math.pow(1 + r, years[i]), 0);
  const dnpv = (r: number) => cashflows.reduce((sum, cf, i) => sum - (years[i] * cf.amountArs) / Math.pow(1 + r, years[i] + 1), 0);

  let rate = 0.1;
  let converged = false;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate);
    const df = dnpv(rate);
    if (!Number.isFinite(f) || !Number.isFinite(df) || Math.abs(df) < 1e-10) break;

    let nextRate = rate - f / df;
    if (!Number.isFinite(nextRate)) break;
    // La tasa no puede ser <= -100% (división por (1+r) inválida).
    if (nextRate <= -0.999999) nextRate = -0.999999;

    if (Math.abs(nextRate - rate) < 1e-7) {
      rate = nextRate;
      converged = true;
      break;
    }
    rate = nextRate;
  }

  if (!converged || !Number.isFinite(rate) || rate <= -1) return null;
  return rate * 100;
}

// TIR anualizada del portafolio: cashflows = cada compra (salida), cada
// venta y dividendo (entrada), más el valor de mercado actual como una
// entrada "de cierre" a la fecha de hoy (como si se liquidara todo). Todos
// los montos se convierten a ARS con el CCL vigente (misma simplificación
// que el resto de la app: no hay CCL histórico por transacción, ver
// lib/portfolio.ts `convert`).
export function computeXirr(params: {
  transactions: Transaction[];
  dividends: Dividend[];
  currentValueArs: number;
  ccl: number | null;
  asOfDate?: string;
}): number | null {
  const { transactions, dividends, currentValueArs, ccl } = params;
  const asOfDate = params.asOfDate ?? new Date().toISOString().slice(0, 10);

  const flows: Cashflow[] = [];
  for (const tx of transactions) {
    const gross = tx.quantity * tx.price;
    const amountNative = tx.side === "buy" ? -(gross + tx.fees) : gross - tx.fees;
    const amountArs = toArs(amountNative, tx.currency, ccl);
    if (amountArs != null) flows.push({ date: tx.date, amountArs });
  }
  for (const div of dividends) {
    const amountArs = toArs(div.amount, div.currency, ccl);
    if (amountArs != null) flows.push({ date: div.date, amountArs });
  }
  if (flows.length === 0) return null;

  flows.sort((a, b) => a.date.localeCompare(b.date));
  flows.push({ date: asOfDate, amountArs: currentValueArs });

  return xirr(flows);
}

export type FeesSummary = {
  totalArs: number;
  totalUsd: number | null;
  pctOfCostBasis: number | null; // comisiones / costo bruto invertido (compras), null si no hubo compras
};

// Comisiones pagadas: suma de `fees` de todas las transacciones (compras y
// ventas), convertidas con el mismo CCL puntual que el resto de la app (ver
// lib/portfolio.ts `convert` — no hay CCL histórico por transacción).
// `pctOfCostBasis` compara contra el bruto comprado (quantity * price de las
// compras, sin las comisiones), para responder "cuánto de lo que invertí se
// fue en comisiones".
export function computeFeesSummary(transactions: Transaction[], ccl: number | null): FeesSummary | null {
  if (transactions.length === 0) return null;

  let totalArs = 0;
  let totalUsd = 0;
  let hasUsd = true;
  let grossBoughtArs = 0;

  for (const tx of transactions) {
    const feeArs = toArs(tx.fees, tx.currency, ccl);
    if (feeArs != null) totalArs += feeArs;

    if (tx.currency === "USD") totalUsd += tx.fees;
    else if (ccl) totalUsd += tx.fees / ccl;
    else hasUsd = false;

    if (tx.side === "buy") {
      const grossArs = toArs(tx.quantity * tx.price, tx.currency, ccl);
      if (grossArs != null) grossBoughtArs += grossArs;
    }
  }

  return {
    totalArs,
    totalUsd: hasUsd ? totalUsd : null,
    pctOfCostBasis: grossBoughtArs > 0 ? (totalArs / grossBoughtArs) * 100 : null,
  };
}

// Agrupa snapshots por mes calendario (año-mes) y se queda con el último de
// cada mes -> serie de "cierres" mensuales para calcular retornos mes a mes.
function monthlyClosingValues(snapshots: PortfolioSnapshot[]): number[] {
  const byMonth = new Map<string, PortfolioSnapshot>();
  for (const s of snapshots) {
    const month = s.date.slice(0, 7); // "YYYY-MM"
    const prev = byMonth.get(month);
    if (!prev || s.date > prev.date) byMonth.set(month, s);
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, s]) => s.total_value_ars);
}

// Volatilidad anualizada a partir de retornos mensuales (desvío estándar
// mensual x √12). Se eligen retornos mensuales, no diarios, porque el
// historial de snapshots recién arranca con el cron diario y todavía no da
// para una serie diaria representativa; mensual es más estable con pocos
// puntos. Requiere al menos 3 meses (2 retornos) para no calcular un
// desvío sobre un solo dato.
export function computeVolatility(snapshots: PortfolioSnapshot[]): number | null {
  const values = monthlyClosingValues(snapshots);
  if (values.length < 3) return null;

  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    if (prev > 0) returns.push((values[i] - prev) / prev);
  }
  if (returns.length < 2) return null;

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  const monthlyStdev = Math.sqrt(variance);

  return monthlyStdev * Math.sqrt(12) * 100;
}

// Caída máxima (max drawdown): la mayor caída porcentual desde un pico
// hasta un valle posterior, sobre la serie de valor total diaria.
export function computeMaxDrawdown(snapshots: PortfolioSnapshot[]): number | null {
  if (snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

  let peak = sorted[0].total_value_ars;
  let maxDrawdownPct = 0;
  for (const s of sorted) {
    if (s.total_value_ars > peak) peak = s.total_value_ars;
    if (peak > 0) {
      const drawdown = ((s.total_value_ars - peak) / peak) * 100;
      if (drawdown < maxDrawdownPct) maxDrawdownPct = drawdown;
    }
  }
  return maxDrawdownPct;
}

export type PeriodReturn = {
  changeArs: number;
  changePct: number | null;
  latestValueArs: number;
  latestDate: string;
  baselineDate: string;
};

// Snapshot más reciente que sea <= (fecha del último - windowDays), o el
// primer snapshot disponible si windowDays es null ("historial completo").
// Compartido por computePeriodReturn y computeBenchmarkComparison para que
// ambos elijan el mismo "antes" ante la misma ventana.
function findBaseline(sorted: PortfolioSnapshot[], latest: PortfolioSnapshot, windowDays: number | null): PortfolioSnapshot | undefined {
  if (windowDays == null) return sorted[0];

  const latestTime = new Date(latest.date).getTime();
  const cutoff = new Date(latestTime - windowDays * MS_PER_DAY).toISOString().slice(0, 10);
  // El snapshot más reciente que caiga en o antes del corte -> el "antes"
  // más cercano a la ventana pedida, no necesariamente exacto al día.
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (sorted[i].date <= cutoff) return sorted[i];
  }
  return undefined;
}

// Retorno de un período: compara el último snapshot contra el snapshot más
// reciente que sea <= (fecha del último - windowDays). `windowDays: null`
// = "historial completo" (compara contra el primer snapshot disponible).
// Devuelve null si no hay un baseline distinto del último punto (menos de 2
// snapshots, o todos caen dentro de la ventana sin un "antes" real).
export function computePeriodReturn(snapshots: PortfolioSnapshot[], windowDays: number | null): PeriodReturn | null {
  if (snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];

  const baseline = findBaseline(sorted, latest, windowDays);
  if (!baseline || baseline.date === latest.date) return null;

  const changeArs = latest.total_value_ars - baseline.total_value_ars;
  const changePct = baseline.total_value_ars > 0 ? (changeArs / baseline.total_value_ars) * 100 : null;

  return { changeArs, changePct, latestValueArs: latest.total_value_ars, latestDate: latest.date, baselineDate: baseline.date };
}

export type BenchmarkComparison = {
  portfolioReturnPct: number;
  benchmarkReturnPct: number;
  diffPp: number; // portfolioReturnPct - benchmarkReturnPct, en puntos porcentuales
  latestDate: string;
  baselineDate: string;
};

// Compara el retorno del portafolio contra el S&P 500 (spy_usd) en el mismo
// período. Ambas puntas en USD (total_value_usd vs. spy_usd), no en ARS:
// comparar en ARS mezclaría la devaluación del peso con la performance real
// de los activos, y el objetivo de este número es "¿le gano al mercado?",
// no "¿le gano al dólar?" (eso ya lo muestra la vista indexada del historial).
// Nota: usa el valor crudo del portafolio (no TWR), así que un depósito o
// retiro grande dentro del período distorsiona la comparación -> ver
// computeTwr para un retorno que aísla el efecto de los aportes.
export function computeBenchmarkComparison(snapshots: PortfolioSnapshot[], windowDays: number | null): BenchmarkComparison | null {
  if (snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];

  const baseline = findBaseline(sorted, latest, windowDays);
  if (!baseline || baseline.date === latest.date) return null;
  if (latest.total_value_usd <= 0 || baseline.total_value_usd <= 0) return null;
  if (latest.spy_usd == null || baseline.spy_usd == null || baseline.spy_usd <= 0) return null;

  const portfolioReturnPct = ((latest.total_value_usd - baseline.total_value_usd) / baseline.total_value_usd) * 100;
  const benchmarkReturnPct = ((latest.spy_usd - baseline.spy_usd) / baseline.spy_usd) * 100;

  return {
    portfolioReturnPct,
    benchmarkReturnPct,
    diffPp: portfolioReturnPct - benchmarkReturnPct,
    latestDate: latest.date,
    baselineDate: baseline.date,
  };
}

export type WeeklyPnl = { weekStart: string; weekEnd: string; pnlArs: number };

// Lunes de la semana ISO de una fecha "YYYY-MM-DD" (sin librerías de fecha,
// mismo criterio que el resto de lib/metrics.ts: date-only, sin timezone).
function isoWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = domingo
  const diff = (day + 6) % 7; // días desde el lunes
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

// Ganancia por semana: para cada semana calendario con datos, cuánto varió
// el valor total desde el cierre de la semana anterior hasta el cierre de
// esta semana. La primera semana con datos no tiene "semana anterior" así
// que no genera una barra (no hay con qué compararla).
export function computeWeeklyPnl(snapshots: PortfolioSnapshot[]): WeeklyPnl[] {
  if (snapshots.length < 2) return [];
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

  const lastByWeek = new Map<string, PortfolioSnapshot>();
  for (const s of sorted) {
    const week = isoWeekStart(s.date);
    const prev = lastByWeek.get(week);
    if (!prev || s.date > prev.date) lastByWeek.set(week, s);
  }

  const weeks = [...lastByWeek.entries()].sort(([a], [b]) => a.localeCompare(b));
  const result: WeeklyPnl[] = [];
  for (let i = 1; i < weeks.length; i++) {
    const [weekStart, snap] = weeks[i];
    const [, prevSnap] = weeks[i - 1];
    result.push({ weekStart, weekEnd: snap.date, pnlArs: snap.total_value_ars - prevSnap.total_value_ars });
  }
  return result;
}

// TWR (Time-Weighted Return) anualizado: encadena el retorno de cada
// sub-período entre snapshots consecutivos, neutralizando el efecto de los
// aportes/retiros de cada tramo (a diferencia de XIRR, que sí depende de
// cuándo metiste o sacaste plata). Aproximación: los snapshots no guardan el
// cashflow exacto del día, así que se infiere del cambio en total_cost_ars
// entre snapshots (ΔcostBasis) -> si en un tramo compraste, ese aporte se
// resta del valor final antes de calcular el retorno del tramo, igual que
// hace un cálculo real de TWR con los flujos de caja del período. Usa
// snapshots mensuales (mismo criterio que computeVolatility) porque la
// historia diaria todavía no da para una serie diaria representativa.
export function computeTwr(snapshots: PortfolioSnapshot[]): number | null {
  const byMonth = new Map<string, PortfolioSnapshot>();
  for (const s of snapshots) {
    const month = s.date.slice(0, 7);
    const prev = byMonth.get(month);
    if (!prev || s.date > prev.date) byMonth.set(month, s);
  }
  const monthly = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, s]) => s);
  if (monthly.length < 3) return null;

  let cumulative = 1;
  let periods = 0;
  for (let i = 1; i < monthly.length; i++) {
    const prev = monthly[i - 1];
    const curr = monthly[i];
    if (prev.total_value_ars <= 0 || prev.total_cost_ars == null || curr.total_cost_ars == null) continue;

    const costFlow = curr.total_cost_ars - prev.total_cost_ars; // >0: aportes netos en el tramo
    const subPeriodReturn = (curr.total_value_ars - costFlow - prev.total_value_ars) / prev.total_value_ars;
    if (!Number.isFinite(subPeriodReturn)) continue;

    cumulative *= 1 + subPeriodReturn;
    periods += 1;
  }
  if (periods < 2 || !Number.isFinite(cumulative) || cumulative <= 0) return null;

  const monthlyGeometricReturn = Math.pow(cumulative, 1 / periods) - 1;
  return (Math.pow(1 + monthlyGeometricReturn, 12) - 1) * 100;
}

export type DividendMetrics = {
  income12mArs: number;
  income12mUsd: number | null;
  yieldOnCostPct: number | null; // income12m / costo base total
  currentYieldPct: number | null; // income12m / valor de mercado actual
  byMonth: { month: string; amountArs: number }[]; // calendario histórico completo, no solo 12m
};

// Yield e ingreso por dividendos. income12m mira los últimos 12 meses desde
// `asOfDate` (ventana móvil, no año calendario) para que el número no salte
// el 1° de enero. byMonth es el historial completo (no solo 12m) para el
// calendario visual: cuánto cobraste cada mes desde que hay datos.
export function computeDividendMetrics(params: {
  dividends: Dividend[];
  totalCostArs: number;
  totalValueArs: number;
  ccl: number | null;
  asOfDate?: string;
}): DividendMetrics | null {
  const { dividends, totalCostArs, totalValueArs, ccl } = params;
  if (dividends.length === 0) return null;

  const asOfDate = params.asOfDate ?? new Date().toISOString().slice(0, 10);
  const cutoff = new Date(new Date(`${asOfDate}T00:00:00Z`).getTime() - 365 * MS_PER_DAY).toISOString().slice(0, 10);

  let income12mArs = 0;
  let income12mUsd = 0;
  let hasUsd = true;
  const byMonthMap = new Map<string, number>();

  for (const div of dividends) {
    const amountArs = toArs(div.amount, div.currency, ccl);
    const month = div.date.slice(0, 7);
    if (amountArs != null) byMonthMap.set(month, (byMonthMap.get(month) ?? 0) + amountArs);

    if (div.date > cutoff && div.date <= asOfDate) {
      if (amountArs != null) income12mArs += amountArs;
      if (div.currency === "USD") income12mUsd += div.amount;
      else if (ccl) income12mUsd += div.amount / ccl;
      else hasUsd = false;
    }
  }

  const byMonth = [...byMonthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amountArs]) => ({ month, amountArs }));

  return {
    income12mArs,
    income12mUsd: hasUsd ? income12mUsd : null,
    yieldOnCostPct: totalCostArs > 0 ? (income12mArs / totalCostArs) * 100 : null,
    currentYieldPct: totalValueArs > 0 ? (income12mArs / totalValueArs) * 100 : null,
    byMonth,
  };
}
