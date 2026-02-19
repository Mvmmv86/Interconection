'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchAllPools,
  type FetchPoolsOptions,
} from '@/components/defi/pools/services/pool-integrations';
import type { PoolInfo } from '@/components/defi/pools/types';

export interface UsePoolDiscoveryReturn {
  pools: PoolInfo[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch real pool discovery data from DeFiLlama.
 * Returns available pools with TVL, Volume, APR, and calculated Fees.
 */
export function usePoolDiscovery(
  options?: FetchPoolsOptions
): UsePoolDiscoveryReturn {
  const {
    data: pools = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['pool-discovery', options?.minTvl, options?.minApr, options?.chains, options?.protocols],
    queryFn: () => fetchAllPools(options),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
  });

  return {
    pools,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

export default usePoolDiscovery;
