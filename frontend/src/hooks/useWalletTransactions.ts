'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { getWalletTransactions, NormalizedTransaction } from '@/lib/defi';
import { getMoralisTransactions } from '@/lib/defi/moralis-transactions';

export interface UseWalletTransactionsOptions {
  limit?: number;
  enabled?: boolean;
}

export interface UseWalletTransactionsReturn {
  transactions: NormalizedTransaction[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  source: 'zerion' | 'moralis' | null;
}

/**
 * Hook to fetch wallet transactions
 * Uses Zerion as primary, Moralis as fallback
 */
export function useWalletTransactions(
  options?: UseWalletTransactionsOptions
): UseWalletTransactionsReturn {
  const { address, isConnected } = useAccount();
  const limit = options?.limit ?? 10;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['wallet-transactions', address, limit],
    queryFn: async () => {
      if (!address) return { transactions: [], source: null as 'zerion' | 'moralis' | null };

      // Try Zerion first
      try {
        const transactions = await getWalletTransactions(address, { limit });
        return { transactions, source: 'zerion' as const };
      } catch (zerionError) {
        console.warn('Zerion transactions failed, trying Moralis:', zerionError);

        // Fallback to Moralis
        try {
          const transactions = await getMoralisTransactions(address, { limit });
          return { transactions, source: 'moralis' as const };
        } catch (moralisError) {
          console.error('Moralis transactions also failed:', moralisError);
          throw moralisError;
        }
      }
    },
    enabled: (options?.enabled ?? true) && isConnected && !!address,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: 1, // Retry once (fallback already handles one retry)
  });

  return {
    transactions: data?.transactions || [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    source: data?.source || null,
  };
}

export default useWalletTransactions;
