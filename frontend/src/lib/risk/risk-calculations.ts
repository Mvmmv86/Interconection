/**
 * Engine de cálculos de risco - funções puras
 * Baseado em padrões institucionais de hedge funds crypto
 *
 * Fórmulas: VaR histórico, CVaR, Sharpe, Drawdown, HHI, Correlação Pearson
 */

import { RiskMetrics, RiskThresholds, RiskAlert, RiskScore, RiskStatus } from './risk-types';
import { UnifiedPosition } from '@/types/positions';

// ═══════════════════════════════════════════
// Utilidades Estatísticas
// ═══════════════════════════════════════════

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  const squareDiffs = arr.map(v => (v - avg) ** 2);
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / (arr.length - 1));
}

function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedArr[lower];
  const weight = index - lower;
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

// ═══════════════════════════════════════════
// 1. VaR Histórico (95%)
// ═══════════════════════════════════════════

/**
 * Calcula Value at Risk usando simulação histórica
 * @param portfolioReturns - Array de retornos diários do portfólio
 * @param confidence - Nível de confiança (ex: 95)
 * @returns VaR em % (positivo = perda)
 */
export function calculateHistoricalVaR(portfolioReturns: number[], confidence: number = 95): number {
  if (portfolioReturns.length < 5) return 0;

  const sorted = [...portfolioReturns].sort((a, b) => a - b);
  const pctile = 100 - confidence; // 5% para 95% confidence
  const varValue = percentile(sorted, pctile);

  return Math.abs(varValue) * 100; // Retorna positivo em %
}

// ═══════════════════════════════════════════
// 2. CVaR / Expected Shortfall
// ═══════════════════════════════════════════

/**
 * Calcula Conditional VaR (média das perdas além do VaR)
 * Melhor medida de risco de cauda que o VaR
 */
export function calculateCVaR(portfolioReturns: number[], confidence: number = 95): number {
  if (portfolioReturns.length < 5) return 0;

  const sorted = [...portfolioReturns].sort((a, b) => a - b);
  const pctile = 100 - confidence;
  const varThreshold = percentile(sorted, pctile);

  // Média dos retornos abaixo do threshold do VaR
  const tailReturns = sorted.filter(r => r <= varThreshold);
  if (tailReturns.length === 0) return calculateHistoricalVaR(portfolioReturns, confidence);

  return Math.abs(mean(tailReturns)) * 100;
}

// ═══════════════════════════════════════════
// 3. Volatilidade Anualizada
// ═══════════════════════════════════════════

/**
 * Calcula volatilidade anualizada a partir de retornos diários
 * Crypto usa 365 dias (mercado 24/7)
 */
export function calculateVolatility(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;
  return stddev(dailyReturns) * Math.sqrt(365) * 100;
}

// ═══════════════════════════════════════════
// 4. Sharpe Ratio
// ═══════════════════════════════════════════

/**
 * Calcula Sharpe Ratio anualizado
 * @param dailyReturns - Retornos diários do portfólio
 * @param riskFreeRate - Taxa livre de risco anual (default: 5% US Treasury)
 */
export function calculateSharpeRatio(dailyReturns: number[], riskFreeRate: number = 0.05): number {
  if (dailyReturns.length < 5) return 0;

  const annualReturn = mean(dailyReturns) * 365;
  const annualVol = stddev(dailyReturns) * Math.sqrt(365);

  if (annualVol === 0) return 0;

  return (annualReturn - riskFreeRate) / annualVol;
}

// ═══════════════════════════════════════════
// 5. Max Drawdown
// ═══════════════════════════════════════════

/**
 * Calcula máximo drawdown a partir de série de preços do portfólio
 * @param portfolioPrices - Array de valores do portfólio ao longo do tempo
 */
export function calculateMaxDrawdown(portfolioPrices: number[]): {
  maxDrawdown: number;
  peakIndex: number;
  troughIndex: number;
} {
  if (portfolioPrices.length < 2) {
    return { maxDrawdown: 0, peakIndex: 0, troughIndex: 0 };
  }

  let peak = portfolioPrices[0];
  let peakIndex = 0;
  let maxDrawdown = 0;
  let maxDrawdownPeakIndex = 0;
  let maxDrawdownTroughIndex = 0;

  for (let i = 1; i < portfolioPrices.length; i++) {
    if (portfolioPrices[i] > peak) {
      peak = portfolioPrices[i];
      peakIndex = i;
    }

    const drawdown = (peak - portfolioPrices[i]) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPeakIndex = peakIndex;
      maxDrawdownTroughIndex = i;
    }
  }

  return {
    maxDrawdown: maxDrawdown * 100,
    peakIndex: maxDrawdownPeakIndex,
    troughIndex: maxDrawdownTroughIndex,
  };
}

// ═══════════════════════════════════════════
// 6. Concentration Risk (HHI)
// ═══════════════════════════════════════════

/**
 * Calcula risco de concentração usando Herfindahl-Hirschman Index
 * HHI < 1500 = diversificado, 1500-2500 = moderado, > 2500 = concentrado
 */
export function calculateConcentrationRisk(positions: Array<{ value: number; symbol: string }>): {
  topAssetPercent: number;
  topAssetSymbol: string;
  hhi: number;
  top3Percent: number;
} {
  if (positions.length === 0) {
    return { topAssetPercent: 0, topAssetSymbol: '--', hhi: 0, top3Percent: 0 };
  }

  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  if (totalValue === 0) {
    return { topAssetPercent: 0, topAssetSymbol: '--', hhi: 0, top3Percent: 0 };
  }

  // Agrupar por símbolo
  const grouped = new Map<string, number>();
  for (const p of positions) {
    const current = grouped.get(p.symbol) || 0;
    grouped.set(p.symbol, current + p.value);
  }

  // Ordenar por valor
  const sorted = Array.from(grouped.entries())
    .map(([symbol, value]) => ({ symbol, value, allocation: (value / totalValue) * 100 }))
    .sort((a, b) => b.value - a.value);

  // Top asset
  const topAsset = sorted[0] || { symbol: '--', allocation: 0 };

  // Top 3
  const top3 = sorted.slice(0, 3).reduce((sum, a) => sum + a.allocation, 0);

  // HHI = soma dos quadrados das alocações percentuais
  const hhi = sorted.reduce((sum, a) => sum + (a.allocation ** 2), 0);

  return {
    topAssetPercent: topAsset.allocation,
    topAssetSymbol: topAsset.symbol,
    hhi: Math.round(hhi),
    top3Percent: top3,
  };
}

// ═══════════════════════════════════════════
// 7. Leverage Ratio
// ═══════════════════════════════════════════

/**
 * Calcula leverage ratio baseado em posições futures/margin
 */
export function calculateLeverageRatio(positions: UnifiedPosition[]): {
  gross: number;
  net: number;
  futuresNotional: number;
  totalEquity: number;
} {
  let longExposure = 0;
  let shortExposure = 0;
  let totalEquity = 0;

  for (const pos of positions) {
    totalEquity += pos.value;

    if (pos.category === 'futures' || pos.category === 'margin') {
      const notional = pos.value * (pos.leverage || 1);
      if (pos.side === 'short') {
        shortExposure += notional;
      } else {
        longExposure += notional;
      }
    }
  }

  const futuresNotional = longExposure + shortExposure;

  // Se não há futures, leverage = 1x (sem alavancagem)
  if (futuresNotional === 0 || totalEquity === 0) {
    return { gross: 1, net: 1, futuresNotional: 0, totalEquity };
  }

  return {
    gross: (longExposure + shortExposure) / totalEquity,
    net: (longExposure - shortExposure) / totalEquity,
    futuresNotional,
    totalEquity,
  };
}

// ═══════════════════════════════════════════
// 8. Correlation Matrix (Pearson)
// ═══════════════════════════════════════════

/**
 * Calcula correlação de Pearson entre dois arrays
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  const xSlice = x.slice(0, n);
  const ySlice = y.slice(0, n);

  const meanX = mean(xSlice);
  const meanY = mean(ySlice);

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - meanX;
    const dy = ySlice[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return 0;

  return numerator / denom;
}

/**
 * Calcula matriz de correlação NxN para múltiplos ativos
 */
export function calculateCorrelationMatrix(
  assetReturns: Map<string, number[]>
): { assets: string[]; matrix: number[][] } {
  const assets = Array.from(assetReturns.keys());
  const n = assets.length;

  if (n === 0) return { assets: [], matrix: [] };

  const matrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(1.0);
      } else {
        const returnsI = assetReturns.get(assets[i]) || [];
        const returnsJ = assetReturns.get(assets[j]) || [];
        row.push(Math.round(pearsonCorrelation(returnsI, returnsJ) * 100) / 100);
      }
    }
    matrix.push(row);
  }

  return { assets, matrix };
}

// ═══════════════════════════════════════════
// 9. Portfolio Returns (ponderado por peso)
// ═══════════════════════════════════════════

/**
 * Calcula retornos diários ponderados do portfólio
 * weights: mapa de coinId → peso (alocação %)
 * allReturns: mapa de coinId → array de retornos diários
 */
export function calculatePortfolioReturns(
  weights: Map<string, number>,
  allReturns: Map<string, number[]>
): number[] {
  // Encontrar o mínimo de dias em comum
  let minDays = Infinity;
  const weightEntries = Array.from(weights.entries());
  weightEntries.forEach(function(entry) {
    const returns = allReturns.get(entry[0]);
    if (returns && returns.length > 0) {
      minDays = Math.min(minDays, returns.length);
    }
  });

  if (!isFinite(minDays) || minDays < 2) return [];

  const portfolioReturns: number[] = [];
  for (let day = 0; day < minDays; day++) {
    let dayReturn = 0;
    let totalWeight = 0;
    weightEntries.forEach(function(entry) {
      const coinId = entry[0], weight = entry[1];
      const returns = allReturns.get(coinId);
      if (returns && day < returns.length) {
        dayReturn += weight * returns[day];
        totalWeight += weight;
      }
    });
    // Normalizar caso nem todos os ativos tenham dados
    if (totalWeight > 0) {
      portfolioReturns.push(dayReturn / totalWeight);
    }
  }

  return portfolioReturns;
}

/**
 * Calcula série de preços do portfólio a partir dos retornos
 * Para cálculo de drawdown
 */
export function calculatePortfolioPrices(
  weights: Map<string, number>,
  allPrices: Map<string, [number, number][]>,
  totalValue: number
): number[] {
  // Encontrar mínimo de dias
  let minDays = Infinity;
  const wEntries = Array.from(weights.entries());
  wEntries.forEach(function(entry) {
    const prices = allPrices.get(entry[0]);
    if (prices && prices.length > 0) {
      minDays = Math.min(minDays, prices.length);
    }
  });

  if (!isFinite(minDays) || minDays < 2) return [];

  // Normalizar preços: valor do portfólio a cada dia
  const portfolioPrices: number[] = [];
  for (let day = 0; day < minDays; day++) {
    let dayReturn = 0;
    let totalWeight = 0;

    wEntries.forEach(function(entry) {
      const coinId = entry[0], weight = entry[1];
      const prices = allPrices.get(coinId);
      if (prices && day < prices.length && prices[0][1] > 0) {
        // Retorno relativo ao dia 0
        const relativePrice = prices[day][1] / prices[0][1];
        dayReturn += weight * relativePrice;
        totalWeight += weight;
      }
    });

    if (totalWeight > 0) {
      portfolioPrices.push(totalValue * (dayReturn / totalWeight));
    }
  }

  return portfolioPrices;
}

// ═══════════════════════════════════════════
// 10. Overall Risk Score + Alerts
// ═══════════════════════════════════════════

/**
 * Calcula score geral de risco e gera alertas
 */
export function calculateOverallRiskScore(
  metrics: RiskMetrics,
  thresholds: RiskThresholds
): RiskScore {
  const alerts: RiskAlert[] = [];
  let dangerCount = 0;
  let warningCount = 0;

  // VaR 95%
  if (metrics.var95 >= thresholds.var95.danger) {
    dangerCount++;
    alerts.push({
      id: 'var95-danger',
      metric: 'VaR 95%',
      severity: 'danger',
      message: `VaR diário de ${metrics.var95.toFixed(1)}% excede o limite crítico de ${thresholds.var95.danger}%`,
      value: metrics.var95,
      threshold: thresholds.var95.danger,
    });
  } else if (metrics.var95 >= thresholds.var95.warning) {
    warningCount++;
    alerts.push({
      id: 'var95-warning',
      metric: 'VaR 95%',
      severity: 'warning',
      message: `VaR diário de ${metrics.var95.toFixed(1)}% acima do nível de atenção de ${thresholds.var95.warning}%`,
      value: metrics.var95,
      threshold: thresholds.var95.warning,
    });
  }

  // CVaR 95%
  if (metrics.cvar95 >= thresholds.cvar95.danger) {
    dangerCount++;
    alerts.push({
      id: 'cvar95-danger',
      metric: 'CVaR 95%',
      severity: 'danger',
      message: `Expected Shortfall de ${metrics.cvar95.toFixed(1)}% excede o limite crítico de ${thresholds.cvar95.danger}%`,
      value: metrics.cvar95,
      threshold: thresholds.cvar95.danger,
    });
  } else if (metrics.cvar95 >= thresholds.cvar95.warning) {
    warningCount++;
    alerts.push({
      id: 'cvar95-warning',
      metric: 'CVaR 95%',
      severity: 'warning',
      message: `Expected Shortfall de ${metrics.cvar95.toFixed(1)}% acima do nível de atenção`,
      value: metrics.cvar95,
      threshold: thresholds.cvar95.warning,
    });
  }

  // Max Drawdown
  if (metrics.maxDrawdown >= thresholds.maxDrawdown.danger) {
    dangerCount++;
    alerts.push({
      id: 'drawdown-danger',
      metric: 'Max Drawdown',
      severity: 'danger',
      message: `Drawdown de ${metrics.maxDrawdown.toFixed(1)}% excede o limite crítico de ${thresholds.maxDrawdown.danger}%`,
      value: metrics.maxDrawdown,
      threshold: thresholds.maxDrawdown.danger,
    });
  } else if (metrics.maxDrawdown >= thresholds.maxDrawdown.warning) {
    warningCount++;
    alerts.push({
      id: 'drawdown-warning',
      metric: 'Max Drawdown',
      severity: 'warning',
      message: `Drawdown de ${metrics.maxDrawdown.toFixed(1)}% acima do nível de atenção de ${thresholds.maxDrawdown.warning}%`,
      value: metrics.maxDrawdown,
      threshold: thresholds.maxDrawdown.warning,
    });
  }

  // Leverage Ratio
  if (metrics.leverageRatio.gross >= thresholds.leverageRatio.danger) {
    dangerCount++;
    alerts.push({
      id: 'leverage-danger',
      metric: 'Leverage',
      severity: 'danger',
      message: `Leverage bruto de ${metrics.leverageRatio.gross.toFixed(1)}x excede o limite de ${thresholds.leverageRatio.danger}x`,
      value: metrics.leverageRatio.gross,
      threshold: thresholds.leverageRatio.danger,
    });
  } else if (metrics.leverageRatio.gross >= thresholds.leverageRatio.warning) {
    warningCount++;
    alerts.push({
      id: 'leverage-warning',
      metric: 'Leverage',
      severity: 'warning',
      message: `Leverage bruto de ${metrics.leverageRatio.gross.toFixed(1)}x acima do nível de atenção`,
      value: metrics.leverageRatio.gross,
      threshold: thresholds.leverageRatio.warning,
    });
  }

  // Concentration Risk
  if (metrics.concentrationRisk.topAssetPercent >= thresholds.concentration.danger) {
    dangerCount++;
    alerts.push({
      id: 'concentration-danger',
      metric: 'Concentração',
      severity: 'danger',
      message: `${metrics.concentrationRisk.topAssetSymbol} representa ${metrics.concentrationRisk.topAssetPercent.toFixed(1)}% do portfólio (limite: ${thresholds.concentration.danger}%)`,
      value: metrics.concentrationRisk.topAssetPercent,
      threshold: thresholds.concentration.danger,
    });
  } else if (metrics.concentrationRisk.topAssetPercent >= thresholds.concentration.warning) {
    warningCount++;
    alerts.push({
      id: 'concentration-warning',
      metric: 'Concentração',
      severity: 'warning',
      message: `${metrics.concentrationRisk.topAssetSymbol} representa ${metrics.concentrationRisk.topAssetPercent.toFixed(1)}% do portfólio`,
      value: metrics.concentrationRisk.topAssetPercent,
      threshold: thresholds.concentration.warning,
    });
  }

  // Sharpe Ratio (invertido: abaixo é ruim)
  if (metrics.sharpeRatio <= thresholds.sharpeRatio.danger) {
    dangerCount++;
    alerts.push({
      id: 'sharpe-danger',
      metric: 'Sharpe Ratio',
      severity: 'danger',
      message: `Sharpe Ratio de ${metrics.sharpeRatio.toFixed(2)} abaixo do limite crítico de ${thresholds.sharpeRatio.danger}`,
      value: metrics.sharpeRatio,
      threshold: thresholds.sharpeRatio.danger,
    });
  } else if (metrics.sharpeRatio <= thresholds.sharpeRatio.warning) {
    warningCount++;
    alerts.push({
      id: 'sharpe-warning',
      metric: 'Sharpe Ratio',
      severity: 'warning',
      message: `Sharpe Ratio de ${metrics.sharpeRatio.toFixed(2)} abaixo do nível recomendado de ${thresholds.sharpeRatio.warning}`,
      value: metrics.sharpeRatio,
      threshold: thresholds.sharpeRatio.warning,
    });
  }

  // Determinar status geral
  let status: RiskStatus = 'healthy';
  if (dangerCount > 0) {
    status = 'danger';
  } else if (warningCount > 0) {
    status = 'warning';
  }

  // Score: 100 = perfeito, 0 = crítico
  // Cada danger remove 20 pontos, cada warning remove 10
  const score = Math.max(0, Math.min(100, 100 - (dangerCount * 20) - (warningCount * 10)));

  return { score, status, alerts };
}
