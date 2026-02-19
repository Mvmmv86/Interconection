'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RiskMetrics,
  RiskThresholds,
  RiskScore,
  DEFAULT_RISK_THRESHOLDS,
  SYMBOL_TO_COINGECKO,
  RISK_THRESHOLDS_STORAGE_KEY,
} from '@/lib/risk/risk-types';
import {
  calculateHistoricalVaR,
  calculateCVaR,
  calculateVolatility,
  calculateSharpeRatio,
  calculateMaxDrawdown,
  calculateConcentrationRisk,
  calculateLeverageRatio,
  calculateCorrelationMatrix,
  calculatePortfolioReturns,
  calculatePortfolioPrices,
  calculateOverallRiskScore,
} from '@/lib/risk/risk-calculations';
import { UnifiedPosition, PositionsSummary } from '@/types/positions';

interface PriceHistoryResponse {
  data: Record<string, {
    prices: [number, number][];
    returns: number[];
  }>;
  symbols: Record<string, string>;
  fetched: number;
  requested: number;
}

// ═══════════════════════════════════════════
// Carregar/Salvar thresholds do localStorage
// ═══════════════════════════════════════════

function loadThresholds(): RiskThresholds {
  if (typeof window === 'undefined') return DEFAULT_RISK_THRESHOLDS;
  try {
    const stored = localStorage.getItem(RISK_THRESHOLDS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge com defaults para garantir que novas métricas existam
      return { ...DEFAULT_RISK_THRESHOLDS, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_RISK_THRESHOLDS;
}

function saveThresholds(thresholds: RiskThresholds) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RISK_THRESHOLDS_STORAGE_KEY, JSON.stringify(thresholds));
  } catch {
    // Ignore storage errors
  }
}

// ═══════════════════════════════════════════
// Hook Principal
// ═══════════════════════════════════════════

export function usePortfolioRisk(positions: UnifiedPosition[], summary: PositionsSummary) {
  // Thresholds com persistência em localStorage
  const [thresholds, setThresholds] = useState<RiskThresholds>(DEFAULT_RISK_THRESHOLDS);

  // Carregar thresholds do localStorage no mount
  useEffect(() => {
    setThresholds(loadThresholds());
  }, []);

  const updateThresholds = useCallback((newThresholds: RiskThresholds) => {
    setThresholds(newThresholds);
    saveThresholds(newThresholds);
  }, []);

  const resetThresholds = useCallback(() => {
    setThresholds(DEFAULT_RISK_THRESHOLDS);
    saveThresholds(DEFAULT_RISK_THRESHOLDS);
  }, []);

  // ═══════════════════════════════════════════
  // 1. Extrair ativos únicos com valor significativo (> 1% do portfólio)
  // ═══════════════════════════════════════════
  const assetInfo = useMemo(() => {
    if (positions.length === 0 || summary.totalValue === 0) {
      return { symbols: [], coinIds: [], weights: new Map<string, number>() };
    }

    // Agrupar por símbolo
    const grouped = new Map<string, number>();
    for (const pos of positions) {
      const sym = pos.symbol.toUpperCase();
      grouped.set(sym, (grouped.get(sym) || 0) + pos.value);
    }

    // Filtrar ativos com > 1% de alocação e que temos mapeamento CoinGecko
    const meaningful: Array<{ symbol: string; coinId: string; weight: number }> = [];
    Array.from(grouped.entries()).forEach((entry) => {
      const symbol = entry[0];
      const value = entry[1];
      const allocation = value / summary.totalValue;
      const coinId = SYMBOL_TO_COINGECKO[symbol];
      if (allocation >= 0.01 && coinId) {
        meaningful.push({ symbol, coinId, weight: allocation });
      }
    });

    // Ordenar por peso e pegar top 10
    meaningful.sort((a, b) => b.weight - a.weight);
    const top = meaningful.slice(0, 10);

    const weights = new Map<string, number>();
    top.forEach((item) => {
      weights.set(item.coinId, item.weight);
    });

    return {
      symbols: top.map(t => t.symbol),
      coinIds: top.map(t => t.coinId),
      weights,
    };
  }, [positions, summary.totalValue]);

  // ═══════════════════════════════════════════
  // 2. Buscar histórico de preços via API
  // ═══════════════════════════════════════════
  const {
    data: priceHistory,
    isLoading: isLoadingPrices,
  } = useQuery<PriceHistoryResponse>({
    queryKey: ['price-history', assetInfo.coinIds.join(',')],
    queryFn: async () => {
      if (assetInfo.coinIds.length === 0) {
        return { data: {}, symbols: {}, fetched: 0, requested: 0 };
      }
      const params = new URLSearchParams({
        coins: assetInfo.coinIds.join(','),
        days: '30',
      });
      const res = await fetch(`/api/prices/history?${params}`);
      if (!res.ok) throw new Error('Failed to fetch price history');
      return res.json();
    },
    enabled: assetInfo.coinIds.length > 0,
    staleTime: 60 * 60 * 1000, // 1 hora
    refetchInterval: 60 * 60 * 1000, // Refetch a cada hora
  });

  // ═══════════════════════════════════════════
  // 3. Calcular todas as métricas de risco
  // ═══════════════════════════════════════════
  const metrics = useMemo<RiskMetrics | null>(() => {
    if (!priceHistory?.data || Object.keys(priceHistory.data).length === 0) {
      // Calcular apenas métricas que não precisam de histórico
      if (positions.length === 0) return null;

      const concentration = calculateConcentrationRisk(
        positions.map(p => ({ value: p.value, symbol: p.symbol }))
      );
      const leverage = calculateLeverageRatio(positions);

      return {
        var95: 0,
        cvar95: 0,
        maxDrawdown: 0,
        volatility30d: 0,
        sharpeRatio: 0,
        leverageRatio: leverage,
        concentrationRisk: concentration,
        correlationMatrix: { assets: [], matrix: [] },
      };
    }

    // Montar mapas de retornos e preços
    const allReturns = new Map<string, number[]>();
    const allPrices = new Map<string, [number, number][]>();

    for (const [coinId, data] of Object.entries(priceHistory.data)) {
      if (data.returns.length > 0) {
        allReturns.set(coinId, data.returns);
      }
      if (data.prices.length > 0) {
        allPrices.set(coinId, data.prices);
      }
    }

    // Retornos ponderados do portfólio
    const portfolioReturns = calculatePortfolioReturns(assetInfo.weights, allReturns);
    const portfolioPrices = calculatePortfolioPrices(assetInfo.weights, allPrices, summary.totalValue);

    // VaR e CVaR
    const var95 = calculateHistoricalVaR(portfolioReturns, 95);
    const cvar95 = calculateCVaR(portfolioReturns, 95);

    // Volatilidade e Sharpe
    const volatility30d = calculateVolatility(portfolioReturns);
    const sharpeRatio = calculateSharpeRatio(portfolioReturns);

    // Max Drawdown
    const { maxDrawdown } = calculateMaxDrawdown(portfolioPrices);

    // Concentração
    const concentration = calculateConcentrationRisk(
      positions.map(p => ({ value: p.value, symbol: p.symbol }))
    );

    // Leverage
    const leverage = calculateLeverageRatio(positions);

    // Correlação: mapear coinIds para symbols para display
    const symbolReturns = new Map<string, number[]>();
    // Inverter o mapeamento para mostrar símbolo no heatmap
    const coinIdToSymbol = new Map<string, string>();
    for (const [symbol, coinId] of Object.entries(SYMBOL_TO_COINGECKO)) {
      coinIdToSymbol.set(coinId, symbol);
    }

    Array.from(allReturns.entries()).forEach(function(entry) {
      const coinId = entry[0], returns = entry[1];
      const symbol = coinIdToSymbol.get(coinId) || coinId;
      symbolReturns.set(symbol, returns);
    });

    const correlationMatrix = calculateCorrelationMatrix(symbolReturns);

    return {
      var95,
      cvar95,
      maxDrawdown,
      volatility30d,
      sharpeRatio,
      leverageRatio: leverage,
      concentrationRisk: concentration,
      correlationMatrix,
    };
  }, [priceHistory, positions, assetInfo.weights, summary.totalValue]);

  // ═══════════════════════════════════════════
  // 4. Gerar score e alertas
  // ═══════════════════════════════════════════
  const riskScore = useMemo<RiskScore>(() => {
    if (!metrics) {
      return { score: 100, status: 'healthy', alerts: [] };
    }
    return calculateOverallRiskScore(metrics, thresholds);
  }, [metrics, thresholds]);

  return {
    metrics,
    riskScore,
    thresholds,
    updateThresholds,
    resetThresholds,
    isLoading: isLoadingPrices,
    hasData: positions.length > 0,
    hasPriceHistory: !!priceHistory && Object.keys(priceHistory.data || {}).length > 0,
  };
}
