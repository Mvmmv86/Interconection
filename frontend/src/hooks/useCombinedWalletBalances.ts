'use client';

import { useMemo } from 'react';
import { useWalletBalances, WalletBalancesSummary, TokenBalance } from './useWalletBalances';
import { useSolanaWalletBalances } from './useSolanaWalletBalances';
import { useWallet } from '@/contexts/wallet-context';
import type { SolanaDeFiPosition } from '@/lib/solana/solana-types';

export interface CombinedWalletData {
  // Combined totals
  totalValueUsd: number;
  totalTokens: number;
  totalWallets: number;
  totalChains: number;

  // Per-network data
  evm: {
    balances: WalletBalancesSummary;
    isLoading: boolean;
    isError: boolean;
  };
  solana: {
    balances: WalletBalancesSummary;
    defiPositions: SolanaDeFiPosition[];
    isLoading: boolean;
    isError: boolean;
  };

  // Combined lists
  allTokens: TokenBalance[];
  topAssets: TokenBalance[];
  chainBreakdown: { chain: string; chainId: string; valueUsd: number; tokenCount: number }[];

  // Status
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Hook that combines EVM and Solana wallet balances into a unified view
 * Useful for dashboard displays that show all positions together
 */
export function useCombinedWalletBalances(): CombinedWalletData {
  const { isEVMConnected, isSolanaConnected } = useWallet();

  // Fetch EVM balances
  const evmData = useWalletBalances({ enabled: isEVMConnected });

  // Fetch Solana balances
  const solanaData = useSolanaWalletBalances({ enabled: isSolanaConnected });

  // Combine data
  const combined = useMemo(() => {
    // All tokens from both networks
    const allTokens = [...evmData.balances.tokens, ...solanaData.balances.tokens]
      .sort((a, b) => b.valueUsd - a.valueUsd);

    // Top 3 assets across all networks
    const topAssets = allTokens.slice(0, 3);

    // Combined chain breakdown
    const chainBreakdown = [
      ...evmData.balances.chainBreakdown,
      ...solanaData.balances.chainBreakdown,
    ].sort((a, b) => b.valueUsd - a.valueUsd);

    // Calculate totals
    const totalValueUsd = evmData.balances.totalValueUsd + solanaData.balances.totalValueUsd;
    const totalTokens = evmData.balances.totalTokens + solanaData.balances.totalTokens;
    const totalWallets = (isEVMConnected ? 1 : 0) + (isSolanaConnected ? 1 : 0);
    const totalChains = chainBreakdown.length;

    return {
      totalValueUsd,
      totalTokens,
      totalWallets,
      totalChains,
      allTokens,
      topAssets,
      chainBreakdown,
    };
  }, [
    evmData.balances,
    solanaData.balances,
    isEVMConnected,
    isSolanaConnected,
  ]);

  // Refetch both
  const refetch = () => {
    if (isEVMConnected) evmData.refetch();
    if (isSolanaConnected) solanaData.refetch();
  };

  return {
    totalValueUsd: combined.totalValueUsd,
    totalTokens: combined.totalTokens,
    totalWallets: combined.totalWallets,
    totalChains: combined.totalChains,
    evm: {
      balances: evmData.balances,
      isLoading: evmData.isLoading,
      isError: evmData.isError,
    },
    solana: {
      balances: solanaData.balances,
      defiPositions: solanaData.defiPositions,
      isLoading: solanaData.isLoading,
      isError: solanaData.isError,
    },
    allTokens: combined.allTokens,
    topAssets: combined.topAssets,
    chainBreakdown: combined.chainBreakdown,
    isLoading: evmData.isLoading || solanaData.isLoading,
    isError: evmData.isError || solanaData.isError,
    refetch,
  };
}

export default useCombinedWalletBalances;
