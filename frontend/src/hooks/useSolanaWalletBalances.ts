'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/contexts/wallet-context';
import { getSolanaTokens, identifyDeFiPositions } from '@/lib/solana';
import type { TokenBalance, WalletBalancesSummary } from './useWalletBalances';
import type { SolanaDeFiPosition } from '@/lib/solana/solana-types';

export interface UseSolanaWalletBalancesOptions {
  enabled?: boolean;
}

export interface UseSolanaWalletBalancesReturn {
  balances: WalletBalancesSummary;
  defiPositions: SolanaDeFiPosition[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch all token balances for connected Solana wallet using Helius API
 * Returns data in the same format as useWalletBalances for EVM
 */
export function useSolanaWalletBalances(
  options?: UseSolanaWalletBalancesOptions
): UseSolanaWalletBalancesReturn {
  const { solanaWallet, isSolanaConnected } = useWallet();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['solana-wallet-balances', solanaWallet?.address],
    queryFn: async () => {
      if (!solanaWallet?.address) return null;

      // Fetch tokens from Helius
      const tokens = await getSolanaTokens(solanaWallet.address);

      // Convert to TokenBalance format (same as EVM)
      const tokenBalances: TokenBalance[] = tokens.map((token) => ({
        symbol: token.symbol,
        name: token.name,
        icon: token.logoUrl,
        balance: token.balance,
        valueUsd: token.valueUsd,
        priceUsd: token.priceUsd,
        change24h: undefined, // Helius doesn't provide 24h change
        address: token.mint,
        chain: 'Solana',
        chainId: 'solana',
      }));

      // Identify DeFi positions (staking tokens like mSOL, bSOL, etc.)
      const defiPositions = identifyDeFiPositions(tokens);

      // Calculate totals
      const totalValueUsd = tokenBalances.reduce((sum, t) => sum + t.valueUsd, 0);
      const totalTokens = tokenBalances.length;

      // Get top 3 assets
      const topAssets = tokenBalances.slice(0, 3);

      // Chain breakdown (single chain for Solana)
      const chainBreakdown = totalTokens > 0 ? [
        {
          chain: 'Solana',
          chainId: 'solana',
          valueUsd: totalValueUsd,
          tokenCount: totalTokens,
        },
      ] : [];

      return {
        balances: {
          totalValueUsd,
          totalTokens,
          totalNfts: 0, // NFTs not included yet
          tokens: tokenBalances,
          topAssets,
          chainBreakdown,
        },
        defiPositions,
      };
    },
    enabled: (options?.enabled ?? true) && isSolanaConnected && !!solanaWallet?.address,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: 2,
  });

  const emptyBalances: WalletBalancesSummary = {
    totalValueUsd: 0,
    totalTokens: 0,
    totalNfts: 0,
    tokens: [],
    topAssets: [],
    chainBreakdown: [],
  };

  return {
    balances: data?.balances || emptyBalances,
    defiPositions: data?.defiPositions || [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

export default useSolanaWalletBalances;
