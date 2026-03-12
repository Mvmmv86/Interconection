'use client';

import { useCallback, useMemo } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { PoolPosition } from '@/components/defi/pools/types';
import { useUniswapV3Positions } from '@/hooks/defi/useUniswapV3Positions';
import { useUniswapV4Positions } from '@/hooks/defi/useUniswapV4Positions';
import { useSolanaPoolPositions } from '@/hooks/defi/useSolanaPoolPositions';
import type { NormalizedDeFiPosition } from '@/lib/defi';

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface PositionsFetchState {
  evm: {
    status: FetchStatus;
    positions: PoolPosition[];
    error: string | null;
    lastFetched: Date | null;
  };
  solana: {
    status: FetchStatus;
    positions: PoolPosition[];
    error: string | null;
    lastFetched: Date | null;
  };
}

export interface UsePoolPositionsReturn {
  // State
  positions: PoolPosition[];
  evmPositions: PoolPosition[];
  solanaPositions: PoolPosition[];
  fetchState: PositionsFetchState;

  // Loading states
  isLoading: boolean;
  isLoadingEVM: boolean;
  isLoadingSolana: boolean;

  // Actions
  refreshPositions: () => Promise<void>;
  refreshEVMPositions: () => Promise<void>;
  refreshSolanaPositions: () => Promise<void>;

  // Totals
  totalValue: number;
  totalFees: number;
  totalUnclaimedFees: number;
}

export function usePoolPositions(
  zerionLpPositions?: NormalizedDeFiPosition[]
): UsePoolPositionsReturn {
  const { evmWallet, isEVMConnected, isSolanaConnected } = useWallet();

  // ═══════════════════════════════════════════
  // EVM: Real Uniswap V3 positions (subgraph)
  // ═══════════════════════════════════════════
  const {
    positions: uniswapPositions,
    isLoading: isLoadingUniswap,
    isError: isUniswapError,
    refetch: refetchUniswap,
  } = useUniswapV3Positions();

  // ═══════════════════════════════════════════
  // EVM: Uniswap V4 positions (on-chain + Zerion)
  // ═══════════════════════════════════════════
  const {
    positions: v4Positions,
    isLoading: isLoadingV4,
    isError: isV4Error,
    error: v4Error,
    refetch: refetchV4,
  } = useUniswapV4Positions(zerionLpPositions || []);

  // ═══════════════════════════════════════════
  // Solana: Real LP positions (Orca, Raydium, Meteora)
  // ═══════════════════════════════════════════
  const {
    positions: solanaLPPositions,
    isLoading: isLoadingSolanaLP,
    isError: isSolanaError,
    error: solanaError,
    refetch: refetchSolanaLP,
  } = useSolanaPoolPositions();

  // Combine V3 + V4 EVM positions
  const allEvmPositions = useMemo(
    () => [...uniswapPositions, ...v4Positions],
    [uniswapPositions, v4Positions]
  );

  // Derive EVM fetch state from Uniswap hooks
  const evmFetchState = useMemo(() => {
    let status: FetchStatus = 'idle';
    if (!isEVMConnected) {
      status = 'idle';
    } else if (isLoadingUniswap || isLoadingV4) {
      status = 'loading';
    } else if (isUniswapError && isV4Error) {
      status = 'error';
    } else if (allEvmPositions.length >= 0) {
      status = 'success';
    }

    const errorMsg = isUniswapError
      ? 'Failed to fetch V3 positions'
      : isV4Error
        ? (v4Error?.message || 'Failed to fetch V4 positions')
        : null;

    return {
      status,
      positions: allEvmPositions,
      error: errorMsg,
      lastFetched: status === 'success' ? new Date() : null,
    };
  }, [isEVMConnected, isLoadingUniswap, isLoadingV4, isUniswapError, isV4Error, v4Error, allEvmPositions]);

  // Derive Solana fetch state from Solana LP hook
  const solanaFetchState = useMemo(() => {
    let status: FetchStatus = 'idle';
    if (!isSolanaConnected) {
      status = 'idle';
    } else if (isLoadingSolanaLP) {
      status = 'loading';
    } else if (isSolanaError) {
      status = 'error';
    } else if (solanaLPPositions.length >= 0) {
      status = 'success';
    }

    return {
      status,
      positions: solanaLPPositions,
      error: isSolanaError ? (solanaError?.message || 'Failed to fetch Solana LP positions') : null,
      lastFetched: status === 'success' ? new Date() : null,
    };
  }, [isSolanaConnected, isLoadingSolanaLP, isSolanaError, solanaError, solanaLPPositions]);

  // Combined fetch state
  const fetchState: PositionsFetchState = useMemo(
    () => ({
      evm: evmFetchState,
      solana: solanaFetchState,
    }),
    [evmFetchState, solanaFetchState]
  );

  // Refresh EVM positions (V3 + V4)
  const refreshEVMPositions = useCallback(async () => {
    if (!evmWallet) return;
    await Promise.all([refetchUniswap(), refetchV4()]);
  }, [evmWallet, refetchUniswap, refetchV4]);

  // Refresh Solana positions
  const refreshSolanaPositions = useCallback(async () => {
    await refetchSolanaLP();
  }, [refetchSolanaLP]);

  // Refresh all positions
  const refreshPositions = useCallback(async () => {
    await Promise.all([refreshEVMPositions(), refreshSolanaPositions()]);
  }, [refreshEVMPositions, refreshSolanaPositions]);

  // Combined positions (real EVM + real Solana)
  const positions = useMemo(
    () => [...evmFetchState.positions, ...solanaFetchState.positions],
    [evmFetchState.positions, solanaFetchState.positions]
  );

  // Calculate totals
  const totalValue = useMemo(
    () => positions.reduce((sum, p) => sum + p.totalValueUsd, 0),
    [positions]
  );
  const totalFees = useMemo(
    () => positions.reduce((sum, p) => sum + p.feesEarned.totalUsd, 0),
    [positions]
  );
  const totalUnclaimedFees = useMemo(
    () => positions.reduce((sum, p) => sum + p.feesUnclaimed.totalUsd, 0),
    [positions]
  );

  return {
    positions,
    evmPositions: evmFetchState.positions,
    solanaPositions: solanaFetchState.positions,
    fetchState,
    isLoading: evmFetchState.status === 'loading' || solanaFetchState.status === 'loading',
    isLoadingEVM: evmFetchState.status === 'loading',
    isLoadingSolana: solanaFetchState.status === 'loading',
    refreshPositions,
    refreshEVMPositions,
    refreshSolanaPositions,
    totalValue,
    totalFees,
    totalUnclaimedFees,
  };
}
