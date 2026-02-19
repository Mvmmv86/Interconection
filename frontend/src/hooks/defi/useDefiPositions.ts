'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import {
  fetchDeFiPositions,
  normalizePositions,
  filterPositionsByCategory,
  filterPositionsByChain,
  groupPositionsByProtocol,
  NormalizedDeFiPosition,
  DeFiPositionsSummary,
  DeFiCategory,
  findMatchingPools,
  DeFiLlamaPool,
  getApyBreakdown,
} from '@/lib/defi';

export interface UseDeFiPositionsOptions {
  chains?: string[];
  enabled?: boolean;
  enrichWithApy?: boolean; // Whether to fetch APY data from DeFiLlama
}

export interface UseDeFiPositionsReturn {
  // All positions
  positions: NormalizedDeFiPosition[];

  // By category
  lendingPositions: NormalizedDeFiPosition[];
  lpPositions: NormalizedDeFiPosition[];
  stakingPositions: NormalizedDeFiPosition[];
  yieldPositions: NormalizedDeFiPosition[];
  derivativesPositions: NormalizedDeFiPosition[];
  claimablePositions: NormalizedDeFiPosition[];
  otherPositions: NormalizedDeFiPosition[];

  // Summary
  summary: DeFiPositionsSummary;

  // By protocol
  positionsByProtocol: Record<string, NormalizedDeFiPosition[]>;

  // Loading states
  isLoading: boolean;
  isLoadingApy: boolean;
  isError: boolean;
  error: Error | null;

  // Actions
  refetch: () => void;

  // Filters
  filterByCategory: (category: DeFiCategory | 'all') => NormalizedDeFiPosition[];
  filterByChain: (chainId: string | 'all') => NormalizedDeFiPosition[];
}

/**
 * Enrich position with APY data from DeFiLlama
 */
function enrichPositionWithApy(
  position: NormalizedDeFiPosition,
  pool: DeFiLlamaPool
): NormalizedDeFiPosition {
  const apyBreakdown = getApyBreakdown(pool);

  const enriched: NormalizedDeFiPosition = {
    ...position,
    apy: {
      total: apyBreakdown.total,
      base: apyBreakdown.base,
      reward: apyBreakdown.reward,
      hasRewards: apyBreakdown.hasRewards,
      mean30d: pool.apyMean30d || undefined,
    },
    poolMeta: {
      defiLlamaId: pool.pool,
      url: pool.url || undefined,
      stablecoin: pool.stablecoin,
      ilRisk: pool.ilRisk || undefined,
      exposure: pool.exposure || undefined,
    },
  };

  // Add LP specific data
  if (position.category === 'lp') {
    enriched.lp = {
      il7d: pool.il7d || undefined,
      volume24h: pool.volumeUsd1d || undefined,
      volume7d: pool.volumeUsd7d || undefined,
      tvlUsd: pool.tvlUsd,
      underlyingTokens: pool.underlyingTokens || undefined,
    };
  }

  // Add lending specific data
  if (position.category === 'lending') {
    enriched.lending = {
      ltv: pool.ltv || undefined,
      totalSupplyUsd: pool.totalSupplyUsd,
      totalBorrowUsd: pool.totalBorrowUsd,
      borrowApy: pool.apyBaseBorrow || undefined,
      borrowApyReward: pool.apyRewardBorrow || undefined,
    };
  }

  return enriched;
}

/**
 * Calculate summary with APY metrics
 */
function calculateEnrichedSummary(positions: NormalizedDeFiPosition[]): DeFiPositionsSummary {
  const summary: DeFiPositionsSummary = {
    totalValueUsd: 0,
    lendingSupplyUsd: 0,
    lendingBorrowUsd: 0,
    lpValueUsd: 0,
    stakingValueUsd: 0,
    yieldValueUsd: 0,
    claimableUsd: 0,
    otherValueUsd: 0,
    weightedAvgApy: 0,
    totalAnnualYield: 0,
    totalPositions: positions.length,
    positionsWithApy: 0,
    protocolsUsed: [],
    chainsUsed: [],
  };

  const protocolsSet = new Set<string>();
  const chainsSet = new Set<string>();

  let totalValueWithApy = 0;
  let weightedApySum = 0;

  for (const position of positions) {
    const value = position.valueUsd;

    // Add to total
    summary.totalValueUsd += value;

    // Add to category totals
    switch (position.category) {
      case 'lending':
        if (position.positionType === 'loan') {
          summary.lendingBorrowUsd += value;
        } else {
          summary.lendingSupplyUsd += value;
        }
        break;
      case 'lp':
        summary.lpValueUsd += value;
        break;
      case 'staking':
        summary.stakingValueUsd += value;
        break;
      case 'yield':
        summary.yieldValueUsd += value;
        break;
      case 'claimable':
        summary.claimableUsd += value;
        break;
      case 'other':
        summary.otherValueUsd += value;
        break;
    }

    // Calculate APY metrics
    if (position.apy && position.apy.total > 0) {
      summary.positionsWithApy++;
      totalValueWithApy += value;
      weightedApySum += value * position.apy.total;
      summary.totalAnnualYield += (value * position.apy.total) / 100;
    }

    // Track protocols and chains
    protocolsSet.add(position.protocol);
    chainsSet.add(position.chain);
  }

  // Calculate weighted average APY
  if (totalValueWithApy > 0) {
    summary.weightedAvgApy = weightedApySum / totalValueWithApy;
  }

  summary.protocolsUsed = Array.from(protocolsSet);
  summary.chainsUsed = Array.from(chainsSet);

  return summary;
}

/**
 * Hook to fetch all DeFi positions for connected wallet using Zerion API
 * Enriches positions with APY data from DeFiLlama
 */
export function useDeFiPositions(
  options?: UseDeFiPositionsOptions
): UseDeFiPositionsReturn {
  const { address, isConnected } = useAccount();
  const enrichWithApy = options?.enrichWithApy ?? true;

  // Fetch base positions from Zerion
  const {
    data: zerionData,
    isLoading: isLoadingZerion,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['defi-positions', address, options?.chains],
    queryFn: async () => {
      if (!address) return null;

      const response = await fetchDeFiPositions(address, {
        chains: options?.chains,
      });

      return normalizePositions(response);
    },
    enabled: (options?.enabled ?? true) && isConnected && !!address,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: 2,
  });

  // Fetch APY data from DeFiLlama and enrich positions
  const {
    data: enrichedData,
    isLoading: isLoadingApy,
  } = useQuery({
    queryKey: ['defi-positions-apy', zerionData?.map(p => p.id)],
    queryFn: async () => {
      if (!zerionData || zerionData.length === 0) {
        return { positions: [], apyMatches: new Map() };
      }

      // Prepare positions for matching
      const positionsForMatching = zerionData.map(p => ({
        protocol: p.protocol,
        chain: p.chain,
        chainId: p.chainId,
        symbol: p.asset.symbol,
        positionId: p.id,
      }));

      // Find matching DeFiLlama pools
      let apyMatches: Map<string, DeFiLlamaPool>;
      try {
        apyMatches = await findMatchingPools(positionsForMatching);
      } catch (err) {
        console.warn('Failed to fetch DeFiLlama APY data:', err);
        apyMatches = new Map();
      }

      // Enrich positions with APY data
      const enrichedPositions = zerionData.map(position => {
        const matchingPool = apyMatches.get(position.id);
        if (matchingPool) {
          return enrichPositionWithApy(position, matchingPool);
        }
        return position;
      });

      return {
        positions: enrichedPositions,
        apyMatches,
      };
    },
    enabled: enrichWithApy && !!zerionData && zerionData.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes (APY data updates less frequently)
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  // Use enriched positions if available, otherwise use base positions
  const positions = enrichedData?.positions || zerionData || [];

  // Calculate summary
  const summary = positions.length > 0
    ? calculateEnrichedSummary(positions)
    : {
        totalValueUsd: 0,
        lendingSupplyUsd: 0,
        lendingBorrowUsd: 0,
        lpValueUsd: 0,
        stakingValueUsd: 0,
        yieldValueUsd: 0,
        claimableUsd: 0,
        otherValueUsd: 0,
        weightedAvgApy: 0,
        totalAnnualYield: 0,
        totalPositions: 0,
        positionsWithApy: 0,
        protocolsUsed: [],
        chainsUsed: [],
      };

  const positionsByProtocol = groupPositionsByProtocol(positions);

  // Pre-filter by category
  const lendingPositions = filterPositionsByCategory(positions, 'lending');
  const lpPositions = filterPositionsByCategory(positions, 'lp');
  const stakingPositions = filterPositionsByCategory(positions, 'staking');
  const yieldPositions = filterPositionsByCategory(positions, 'yield');
  const derivativesPositions = filterPositionsByCategory(positions, 'derivatives');
  const claimablePositions = filterPositionsByCategory(positions, 'claimable');
  const otherPositions = filterPositionsByCategory(positions, 'other');

  // Filter functions
  const filterByCategory = (category: DeFiCategory | 'all') =>
    filterPositionsByCategory(positions, category);

  const filterByChain = (chainId: string | 'all') =>
    filterPositionsByChain(positions, chainId);

  return {
    positions,
    lendingPositions,
    lpPositions,
    stakingPositions,
    yieldPositions,
    derivativesPositions,
    claimablePositions,
    otherPositions,
    summary,
    positionsByProtocol,
    isLoading: isLoadingZerion,
    isLoadingApy,
    isError,
    error: error as Error | null,
    refetch,
    filterByCategory,
    filterByChain,
  };
}

export default useDeFiPositions;
