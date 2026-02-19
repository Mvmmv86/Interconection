'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDeFiPositions, UseDeFiPositionsOptions } from './useDefiPositions';
import { useSolanaWalletBalances } from '../useSolanaWalletBalances';
import { useWallet } from '@/contexts/wallet-context';
import {
  fetchDeFiPositions,
  normalizePositions,
  findMatchingPools,
  getApyBreakdown,
} from '@/lib/defi';
import type {
  NormalizedDeFiPosition,
  DeFiPositionsSummary,
  DeFiCategory,
  DeFiLlamaPool,
} from '@/lib/defi';
import type { SolanaDeFiPosition } from '@/lib/solana/solana-types';

export interface MultiWalletDeFiReturn {
  // All positions combined
  positions: NormalizedDeFiPosition[];

  // By category
  lendingPositions: NormalizedDeFiPosition[];
  lpPositions: NormalizedDeFiPosition[];
  stakingPositions: NormalizedDeFiPosition[];
  yieldPositions: NormalizedDeFiPosition[];
  otherPositions: NormalizedDeFiPosition[];

  // Summary
  summary: DeFiPositionsSummary;

  // Per-network data
  evmPositions: NormalizedDeFiPosition[];
  solanaPositions: NormalizedDeFiPosition[];

  // Connected wallets info
  connectedWallets: {
    type: 'evm' | 'solana';
    address: string;
    label: string;
    positionCount: number;
    totalValue: number;
  }[];

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
 * Convert Solana DeFi position (Helius-detected) to normalized format.
 * Used as fallback for staking tokens not found by Zerion.
 */
function convertSolanaPosition(
  solanaPos: SolanaDeFiPosition,
  index: number
): NormalizedDeFiPosition {
  const token = solanaPos.tokens[0];

  const categoryMap: Record<string, DeFiCategory> = {
    staking: 'staking',
    lending: 'lending',
    lp: 'lp',
    farming: 'yield',
  };

  return {
    id: `solana-helius-${solanaPos.protocol}-${index}`,
    protocol: solanaPos.protocol,
    protocolIcon: undefined,
    protocolUrl: undefined,
    chain: 'Solana',
    chainId: 'solana',
    category: categoryMap[solanaPos.type] || 'other',
    positionType: 'deposit',
    positionName: `${token?.symbol || 'SOL'} Staking`,
    asset: {
      symbol: token?.symbol || 'SOL',
      name: token?.name || 'Solana',
      address: token?.mint || '',
      icon: token?.logoUrl,
      decimals: token?.decimals || 9,
    },
    quantity: token?.balance || 0,
    valueUsd: solanaPos.valueUsd,
    priceUsd: token?.priceUsd || 0,
    isVerified: true,
    apy: solanaPos.apy
      ? {
          total: solanaPos.apy,
          base: solanaPos.apy,
          reward: 0,
          hasRewards: false,
        }
      : undefined,
    change24h: undefined,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Enrich a position with APY data from DeFiLlama
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

  if (position.category === 'lp') {
    enriched.lp = {
      il7d: pool.il7d || undefined,
      volume24h: pool.volumeUsd1d || undefined,
      volume7d: pool.volumeUsd7d || undefined,
      tvlUsd: pool.tvlUsd,
      underlyingTokens: pool.underlyingTokens || undefined,
    };
  }

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
 * Hook to fetch DeFi positions from all connected wallets (EVM + Solana)
 * Uses Zerion API for both EVM and Solana DeFi positions, enriched with DeFiLlama APY
 */
export function useMultiWalletDeFiPositions(
  options?: UseDeFiPositionsOptions
): MultiWalletDeFiReturn {
  const { evmWallet, solanaWallet, isEVMConnected, isSolanaConnected } = useWallet();

  // ═══════════════════════════════════════════
  // SOURCE 1: EVM DeFi positions (Zerion + DeFiLlama)
  // ═══════════════════════════════════════════
  const evmData = useDeFiPositions({
    ...options,
    enabled: (options?.enabled ?? true) && isEVMConnected,
  });

  // ═══════════════════════════════════════════
  // SOURCE 2: Solana DeFi positions via Zerion API
  // ═══════════════════════════════════════════
  const {
    data: solanaZerionPositions,
    isLoading: isLoadingSolanaZerion,
    isError: isErrorSolanaZerion,
    error: errorSolanaZerion,
    refetch: refetchSolanaZerion,
  } = useQuery({
    queryKey: ['solana-defi-zerion', solanaWallet?.address],
    queryFn: async () => {
      if (!solanaWallet?.address) return [];
      const response = await fetchDeFiPositions(solanaWallet.address);
      return normalizePositions(response);
    },
    enabled: (options?.enabled ?? true) && isSolanaConnected && !!solanaWallet?.address,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    retry: 2,
  });

  // Enrich Solana Zerion positions with DeFiLlama APY data
  const {
    data: solanaEnrichedPositions,
    isLoading: isLoadingSolanaApy,
  } = useQuery({
    queryKey: ['solana-defi-apy', solanaZerionPositions?.map(p => p.id)],
    queryFn: async () => {
      if (!solanaZerionPositions || solanaZerionPositions.length === 0) {
        return [];
      }

      // Prepare positions for DeFiLlama matching
      const positionsForMatching = solanaZerionPositions.map(p => ({
        protocol: p.protocol,
        chain: p.chain,
        chainId: p.chainId,
        symbol: p.asset.symbol,
        positionId: p.id,
      }));

      let apyMatches: Map<string, DeFiLlamaPool>;
      try {
        apyMatches = await findMatchingPools(positionsForMatching);
      } catch (err) {
        console.warn('[Solana DeFi] Failed to fetch DeFiLlama APY data:', err);
        apyMatches = new Map();
      }

      // Enrich positions with APY
      return solanaZerionPositions.map(position => {
        const matchingPool = apyMatches.get(position.id);
        if (matchingPool) {
          return enrichPositionWithApy(position, matchingPool);
        }
        return position;
      });
    },
    enabled: !!solanaZerionPositions && solanaZerionPositions.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });

  // Use enriched if available, otherwise base Zerion data
  const solanaZerionFinal = useMemo(() => {
    return solanaEnrichedPositions || solanaZerionPositions || [];
  }, [solanaEnrichedPositions, solanaZerionPositions]);

  // ═══════════════════════════════════════════
  // SOURCE 3: Helius staking fallback (mSOL, bSOL, JitoSOL, stSOL)
  // ═══════════════════════════════════════════
  const solanaHeliusData = useSolanaWalletBalances({
    enabled: (options?.enabled ?? true) && isSolanaConnected,
  });

  // Convert Helius-detected staking positions, excluding duplicates from Zerion
  const solanaHeliusFallback = useMemo(() => {
    if (!solanaHeliusData.defiPositions || solanaHeliusData.defiPositions.length === 0) {
      return [];
    }

    // Build a set of asset symbols already found by Zerion on Solana
    const zerionSymbols = new Set(
      solanaZerionFinal
        .filter(p => p.chainId === 'solana')
        .map(p => p.asset.symbol.toLowerCase())
    );

    // Only include Helius positions not already covered by Zerion
    return solanaHeliusData.defiPositions
      .filter(pos => {
        const symbol = pos.tokens[0]?.symbol?.toLowerCase();
        return symbol && !zerionSymbols.has(symbol);
      })
      .map((pos, index) => convertSolanaPosition(pos, index));
  }, [solanaHeliusData.defiPositions, solanaZerionFinal]);

  // ═══════════════════════════════════════════
  // COMBINE: All Solana DeFi positions (Zerion + Helius fallback)
  // ═══════════════════════════════════════════
  const solanaPositions = useMemo(() => {
    return [...solanaZerionFinal, ...solanaHeliusFallback].sort(
      (a, b) => b.valueUsd - a.valueUsd
    );
  }, [solanaZerionFinal, solanaHeliusFallback]);

  // Combine ALL positions (EVM + Solana)
  const allPositions = useMemo(() => {
    return [...evmData.positions, ...solanaPositions].sort(
      (a, b) => b.valueUsd - a.valueUsd
    );
  }, [evmData.positions, solanaPositions]);

  // Calculate combined summary
  const summary = useMemo((): DeFiPositionsSummary => {
    const combined: DeFiPositionsSummary = {
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
      totalPositions: allPositions.length,
      positionsWithApy: 0,
      protocolsUsed: [],
      chainsUsed: [],
    };

    const protocolsSet = new Set<string>();
    const chainsSet = new Set<string>();
    let totalValueWithApy = 0;
    let weightedApySum = 0;

    for (const position of allPositions) {
      const value = position.valueUsd;
      combined.totalValueUsd += value;

      switch (position.category) {
        case 'lending':
          if (position.positionType === 'loan') {
            combined.lendingBorrowUsd += value;
          } else {
            combined.lendingSupplyUsd += value;
          }
          break;
        case 'lp':
          combined.lpValueUsd += value;
          break;
        case 'staking':
          combined.stakingValueUsd += value;
          break;
        case 'yield':
          combined.yieldValueUsd += value;
          break;
        case 'claimable':
          combined.claimableUsd += value;
          break;
        default:
          combined.otherValueUsd += value;
      }

      if (position.apy && position.apy.total > 0) {
        combined.positionsWithApy++;
        totalValueWithApy += value;
        weightedApySum += value * position.apy.total;
        combined.totalAnnualYield += (value * position.apy.total) / 100;
      }

      protocolsSet.add(position.protocol);
      chainsSet.add(position.chain);
    }

    if (totalValueWithApy > 0) {
      combined.weightedAvgApy = weightedApySum / totalValueWithApy;
    }

    combined.protocolsUsed = Array.from(protocolsSet);
    combined.chainsUsed = Array.from(chainsSet);

    return combined;
  }, [allPositions]);

  // Filter by category
  const filterByCategory = (category: DeFiCategory | 'all') => {
    if (category === 'all') return allPositions;
    return allPositions.filter((p) => p.category === category);
  };

  // Filter by chain
  const filterByChain = (chainId: string | 'all') => {
    if (chainId === 'all') return allPositions;
    return allPositions.filter((p) => p.chainId === chainId);
  };

  // Pre-filter by category
  const lendingPositions = filterByCategory('lending');
  const lpPositions = filterByCategory('lp');
  const stakingPositions = filterByCategory('staking');
  const yieldPositions = filterByCategory('yield');
  const otherPositions = filterByCategory('other');

  // Connected wallets info
  const connectedWallets = useMemo(() => {
    const wallets: MultiWalletDeFiReturn['connectedWallets'] = [];

    if (isEVMConnected && evmWallet) {
      wallets.push({
        type: 'evm',
        address: evmWallet.address,
        label: 'EVM Wallet',
        positionCount: evmData.positions.length,
        totalValue: evmData.summary.totalValueUsd,
      });
    }

    if (isSolanaConnected && solanaWallet) {
      wallets.push({
        type: 'solana',
        address: solanaWallet.address,
        label: 'Solana Wallet',
        positionCount: solanaPositions.length,
        totalValue: solanaPositions.reduce((sum, p) => sum + p.valueUsd, 0),
      });
    }

    return wallets;
  }, [
    isEVMConnected,
    evmWallet,
    isSolanaConnected,
    solanaWallet,
    evmData.positions.length,
    evmData.summary.totalValueUsd,
    solanaPositions,
  ]);

  // Refetch all sources
  const refetch = () => {
    evmData.refetch();
    refetchSolanaZerion();
    solanaHeliusData.refetch();
  };

  return {
    positions: allPositions,
    lendingPositions,
    lpPositions,
    stakingPositions,
    yieldPositions,
    otherPositions,
    summary,
    evmPositions: evmData.positions,
    solanaPositions,
    connectedWallets,
    isLoading: evmData.isLoading || isLoadingSolanaZerion || solanaHeliusData.isLoading,
    isLoadingApy: evmData.isLoadingApy || isLoadingSolanaApy,
    isError: evmData.isError || isErrorSolanaZerion || solanaHeliusData.isError,
    error: evmData.error || (errorSolanaZerion as Error | null) || solanaHeliusData.error,
    refetch,
    filterByCategory,
    filterByChain,
  };
}

export default useMultiWalletDeFiPositions;
