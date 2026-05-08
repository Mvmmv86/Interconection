'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/contexts/wallet-context';
import type { PoolPosition } from '@/components/defi/pools/types';
import { fetchSolanaLPPositions } from '@/lib/solana/solana-lp-service';
import { usePoolBaselines, buildPositionKey } from './usePoolBaselines';
import type { PoolBaselineUpsert } from '@/lib/api/client';

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
 * Data flow:
 *   - /api/defi/solana-lp/positions aggregates Helius DAS (NFT discovery) +
 *     Shyft GraphQL (position records) + Orca/Raydium/Meteora APIs (pool state) +
 *     Jupiter (prices). The service returns a `PoolPosition[]` with current values
 *     filled in but no baseline (initialValueUsd = totalValueUsd, IL/PnL = 0).
 *
 *   - This hook overlays the baseline using the same 3-layer strategy as the EVM
 *     V4 hook (see useUniswapV4Positions). For Solana we currently support
 *     only Layer 2 (stored backend snapshot) and Layer 3 (first_observed). A
 *     future upgrade will add Layer 1 (Helius getSignatures + DeFiLlama
 *     historical prices) to populate baselines from the actual creation tx.
 */
export function useSolanaPoolPositions(): UseSolanaPoolPositionsReturn {
  const { solanaWallet, isSolanaConnected } = useWallet();
  const walletAddress = solanaWallet?.address;

  // Baselines: same infra used by useUniswapV4Positions. Server-side
  // dedup ranks sources, so we can safely upsert first_observed without
  // worrying about overwriting a higher-quality baseline.
  const { getBaseline, upsertBaseline } = usePoolBaselines(walletAddress ?? null);

  // Queue of upserts deferred until after the position list is computed,
  // so we don't trigger setState inside useMemo.
  const pendingUpsertsRef = useRef<PoolBaselineUpsert[]>([]);

  const {
    data: rawPositions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['solana-lp-positions', walletAddress],
    queryFn: () => fetchSolanaLPPositions(walletAddress!),
    enabled: isSolanaConnected && !!walletAddress,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 2,
  });

  // Apply baseline overlay to each position. Pure derivation from
  // rawPositions + getBaseline; safe for useMemo.
  const positions = useMemo<PoolPosition[]>(() => {
    return rawPositions.map((pos) => {
      const positionKey = buildPositionKey(pos.protocol, pos.chain, pos.id);
      const storedBaseline = walletAddress ? getBaseline(positionKey) : undefined;

      let initialValue = pos.totalValueUsd;
      let baselineToken0Amount = pos.token0Amount;
      let baselineToken1Amount = pos.token1Amount;
      let baselineSource: PoolPosition['baselineSource'] = null;
      let baselineAt: string | null = null;

      if (storedBaseline) {
        // Layer 2 — backend snapshot (any source: first_observed or, in
        // the future, helius_history once we add the historical decoder).
        baselineToken0Amount = parseFloat(storedBaseline.token0_amount) || pos.token0Amount;
        baselineToken1Amount = parseFloat(storedBaseline.token1_amount) || pos.token1Amount;
        initialValue = parseFloat(storedBaseline.baseline_value_usd) || pos.totalValueUsd;
        baselineSource = storedBaseline.source;
        baselineAt = storedBaseline.baseline_at;
      } else if (walletAddress && pos.totalValueUsd > 0) {
        // Layer 3 — first observation. IL/PnL = 0 today; on the next
        // refresh the stored baseline kicks in and these become real.
        baselineSource = 'first_observed';
        baselineAt = new Date().toISOString();
      }

      // Only upsert when there's no stored baseline yet. We don't have a
      // higher-quality source for Solana yet — when Helius getSignatures
      // history lands, this condition expands like in V4.
      if (walletAddress && baselineSource === 'first_observed' && !storedBaseline) {
        pendingUpsertsRef.current.push({
          wallet_address: walletAddress,
          position_key: positionKey,
          protocol: pos.protocol,
          chain: pos.chain,
          token0_symbol: pos.token0.symbol,
          token1_symbol: pos.token1.symbol,
          token0_amount: baselineToken0Amount,
          token1_amount: baselineToken1Amount,
          token0_price_usd: pos.token0.price,
          token1_price_usd: pos.token1.price,
          baseline_value_usd: initialValue,
          baseline_at: baselineAt!,
          source: 'first_observed',
        });
      }

      // Recompute IL/PnL using the resolved baseline. Mirrors V4 math:
      //   hodl  = baseline tokens × current prices
      //   IL    = hodl - currentValue (only when positive — LP did worse)
      //   PnL   = currentValue + claimed fees - initialValue
      const hodlValue =
        baselineToken0Amount * pos.token0.price +
        baselineToken1Amount * pos.token1.price;
      const ilUsd = Math.max(0, hodlValue - pos.totalValueUsd);
      const ilPercent = hodlValue > 0 ? (ilUsd / hodlValue) * 100 : 0;
      const pnlUsd = pos.totalValueUsd + pos.feesEarned.totalUsd - initialValue;
      const pnlPercent = initialValue > 0 ? (pnlUsd / initialValue) * 100 : 0;

      return {
        ...pos,
        initialValueUsd: initialValue,
        currentValueUsd: pos.totalValueUsd,
        hodlValueUsd: hodlValue,
        impermanentLoss: Math.abs(ilPercent),
        impermanentLossUsd: Math.abs(ilUsd),
        pnlUsd,
        pnlPercent,
        baselineSource,
        baselineAt,
      };
    });
  }, [rawPositions, getBaseline, walletAddress]);

  // Flush queued upserts after positions are derived. Same pattern as V4.
  useEffect(() => {
    const queue = pendingUpsertsRef.current;
    if (queue.length === 0) return;
    pendingUpsertsRef.current = [];
    queue.forEach((payload) => {
      void upsertBaseline(payload);
    });
  }, [positions, upsertBaseline]);

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
