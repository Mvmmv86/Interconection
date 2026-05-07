'use client';

/**
 * usePoolBaselines — frontend cache + persistence for LP position
 * baselines used to compute IL, VS HODL and Fees Earned when the
 * protocol subgraph is unavailable.
 *
 * 3-layer fallback strategy (decision in code, not here):
 *   1. Subgraph returns historical deposits → use it AND backfill
 *      the backend baseline (so future loads still benefit).
 *   2. Subgraph empty + backend baseline exists → use baseline.
 *   3. Neither → save current snapshot as `first_observed`. IL is 0
 *      on first load, becomes real on next refresh.
 *
 * Source priority (enforced server-side):
 *   subgraph_history > manual > first_observed
 */

import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { api, type PoolBaseline, type PoolBaselineUpsert } from '@/lib/api/client';

export type PoolBaselineLookup = (positionKey: string) => PoolBaseline | undefined;

export interface UsePoolBaselinesReturn {
  /** All baselines for the connected wallet (loaded once on mount). */
  baselines: PoolBaseline[];
  isLoading: boolean;
  /** Synchronous lookup by position_key. */
  getBaseline: PoolBaselineLookup;
  /** Persist a baseline server-side. Idempotent (server-side dedup by key). */
  upsertBaseline: (payload: PoolBaselineUpsert) => Promise<PoolBaseline | null>;
  /** Force refetch from server (e.g., after upserting many). */
  refetch: () => void;
}

/**
 * Build the canonical position key used to dedupe baselines.
 * Format: "{protocol}:{chain}:{nft_id_or_pool_address}"
 */
export function buildPositionKey(
  protocol: string,
  chain: string,
  identifier: string | number,
): string {
  return `${protocol.toLowerCase()}:${chain.toLowerCase()}:${identifier}`.toLowerCase();
}

export function usePoolBaselines(
  walletAddress?: string | null,
): UsePoolBaselinesReturn {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const cacheKey = ['pool-baselines', walletAddress ?? 'all'];

  const { data, isLoading, refetch } = useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      const result = await api.getPoolBaselines(walletAddress ?? undefined);
      if (!result.success || !result.data) return [] as PoolBaseline[];
      return result.data.items;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes — baselines change slowly
    gcTime: 30 * 60 * 1000,
  });

  // Build a map for O(1) lookup. Recomputes whenever data changes.
  const lookupRef = useRef<Map<string, PoolBaseline>>(new Map());
  useEffect(() => {
    const map = new Map<string, PoolBaseline>();
    for (const b of data ?? []) {
      map.set(b.position_key, b);
    }
    lookupRef.current = map;
  }, [data]);

  const getBaseline = useCallback<PoolBaselineLookup>((positionKey: string) => {
    return lookupRef.current.get(positionKey);
  }, []);

  // Track in-flight upserts to dedupe rapid concurrent calls for the
  // same key. Keyed by position_key+source so a higher-quality source
  // (e.g., subgraph_history) is never suppressed by an in-flight
  // first_observed call — both fire, and the server-side ranking
  // resolves which wins.
  const inflightRef = useRef<Map<string, Promise<PoolBaseline | null>>>(new Map());

  const upsertBaseline = useCallback(
    async (payload: PoolBaselineUpsert): Promise<PoolBaseline | null> => {
      const inflightKey = `${payload.position_key}::${payload.source}`;
      const existing = inflightRef.current.get(inflightKey);
      if (existing) return existing;

      const promise = (async () => {
        const result = await api.upsertPoolBaseline(payload);
        if (!result.success || !result.data) return null;

        // Update our local cache so subsequent getBaseline() calls
        // see the new value without waiting for refetch.
        lookupRef.current.set(payload.position_key, result.data);
        queryClient.setQueryData(cacheKey, (current?: PoolBaseline[]) => {
          if (!current) return [result.data!];
          const idx = current.findIndex((b) => b.position_key === payload.position_key);
          if (idx >= 0) {
            const copy = [...current];
            copy[idx] = result.data!;
            return copy;
          }
          return [...current, result.data!];
        });
        return result.data;
      })();

      inflightRef.current.set(inflightKey, promise);
      try {
        return await promise;
      } finally {
        inflightRef.current.delete(inflightKey);
      }
    },
    [queryClient, cacheKey],
  );

  return {
    baselines: data ?? [],
    isLoading,
    getBaseline,
    upsertBaseline,
    refetch,
  };
}
