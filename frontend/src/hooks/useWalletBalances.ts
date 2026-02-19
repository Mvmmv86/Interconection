'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { fetchAllPositions } from '@/lib/defi';

// Types for wallet balances
export interface TokenBalance {
  symbol: string;
  name: string;
  icon?: string;
  balance: number;
  valueUsd: number;
  priceUsd: number;
  change24h?: number;
  address?: string;
  chain: string;
  chainId: string;
}

export interface WalletBalancesSummary {
  totalValueUsd: number;
  totalTokens: number;
  totalNfts: number; // Placeholder - Zerion positions doesn't include NFTs count
  tokens: TokenBalance[];
  topAssets: TokenBalance[];
  chainBreakdown: { chain: string; chainId: string; valueUsd: number; tokenCount: number }[];
}

export interface UseWalletBalancesOptions {
  enabled?: boolean;
  chains?: string[];
}

export interface UseWalletBalancesReturn {
  balances: WalletBalancesSummary;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch all token balances for connected wallet using Zerion API
 * Uses fetchAllPositions which returns both simple tokens and DeFi positions
 */
export function useWalletBalances(
  options?: UseWalletBalancesOptions
): UseWalletBalancesReturn {
  const { address, isConnected } = useAccount();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['wallet-balances', address, options?.chains],
    queryFn: async () => {
      if (!address) return null;

      const response = await fetchAllPositions(address, {
        chains: options?.chains,
      });

      // Process positions into token balances
      const tokensMap = new Map<string, TokenBalance>();
      const chainBreakdownMap = new Map<string, { chain: string; chainId: string; valueUsd: number; tokenCount: number }>();

      for (const position of response.data) {
        const { attributes, relationships } = position;
        const chainId = relationships.chain.data.id;

        // Get chain name from included data
        const chainData = response.included?.find(
          (item) => item.type === 'chains' && item.id === chainId
        );
        const chainName = chainData?.attributes?.name || chainId;

        // Create token key (symbol + chain for uniqueness)
        const tokenKey = `${attributes.fungible_info.symbol}-${chainId}`;

        const token: TokenBalance = {
          symbol: attributes.fungible_info.symbol,
          name: attributes.fungible_info.name,
          icon: attributes.fungible_info.icon?.url,
          balance: attributes.quantity.float,
          valueUsd: attributes.value || 0,
          priceUsd: attributes.price || 0,
          change24h: attributes.changes?.percent_1d ?? undefined,
          address: attributes.fungible_info.implementations?.[0]?.address ?? undefined,
          chain: chainName,
          chainId,
        };

        // Aggregate if same token on same chain
        if (tokensMap.has(tokenKey)) {
          const existing = tokensMap.get(tokenKey)!;
          existing.balance += token.balance;
          existing.valueUsd += token.valueUsd;
        } else {
          tokensMap.set(tokenKey, token);
        }

        // Update chain breakdown
        if (chainBreakdownMap.has(chainId)) {
          const existing = chainBreakdownMap.get(chainId)!;
          existing.valueUsd += token.valueUsd;
          existing.tokenCount++;
        } else {
          chainBreakdownMap.set(chainId, {
            chain: chainName,
            chainId,
            valueUsd: token.valueUsd,
            tokenCount: 1,
          });
        }
      }

      // Convert to arrays and sort
      const tokens = Array.from(tokensMap.values()).sort((a, b) => b.valueUsd - a.valueUsd);
      const chainBreakdown = Array.from(chainBreakdownMap.values()).sort((a, b) => b.valueUsd - a.valueUsd);

      // Calculate totals
      const totalValueUsd = tokens.reduce((sum, t) => sum + t.valueUsd, 0);
      const totalTokens = tokens.length;

      // Get top 3 assets
      const topAssets = tokens.slice(0, 3);

      return {
        totalValueUsd,
        totalTokens,
        totalNfts: 0, // Zerion positions endpoint doesn't include NFT count
        tokens,
        topAssets,
        chainBreakdown,
      };
    },
    enabled: (options?.enabled ?? true) && isConnected && !!address,
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
    balances: data || emptyBalances,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

export default useWalletBalances;
