'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/contexts/wallet-context';
import type { PoolPosition } from '@/components/defi/pools/types';
import { fetchSolanaLPPositions } from '@/lib/solana/solana-lp-service';

export interface UseSolanaPoolPositionsReturn {
  positions: PoolPosition[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  totalValue: number;
  totalFees: number;
  totalUnclaimedFees: number;
}

/**
 * Hook to fetch real Solana LP positions from Orca Whirlpool, Raydium CLMM, and Meteora DLMM.
 *
 * Uses our API route that aggregates:
 * - Shyft GraphQL for position discovery
 * - Protocol APIs for pool state
 * - Jupiter for token prices
 *
 * Follows the same pattern as useUniswapV3Positions for EVM.
 */
export function useSolanaPoolPositions(): UseSolanaPoolPositionsReturn {
  const { solanaWallet, isSolanaConnected } = useWallet();

  const {
    data: positions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['solana-lp-positions', solanaWallet?.address],
    queryFn: () => fetchSolanaLPPositions(solanaWallet!.address),
    enabled: isSolanaConnected && !!solanaWallet?.address,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: 2,
  });

  // Calculate totals
  const totalValue = positions.reduce((sum, p) => sum + p.totalValueUsd, 0);
  const totalFees = positions.reduce((sum, p) => sum + p.feesEarned.totalUsd, 0);
  const totalUnclaimedFees = positions.reduce(
    (sum, p) => sum + p.feesUnclaimed.totalUsd,
    0,
  );

  return {
    positions,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    totalValue,
    totalFees,
    totalUnclaimedFees,
  };
}

export default useSolanaPoolPositions;
