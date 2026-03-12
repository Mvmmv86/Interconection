'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { readContract } from '@wagmi/core';
import { wagmiConfig, CHAIN_IDS } from '@/lib/wallet/wagmi-config';
import type { PoolPosition, TokenInfo, EVMChain } from '@/components/defi/pools/types';
import type { NormalizedDeFiPosition } from '@/lib/defi';

// ═══════════════════════════════════════════
// V4 Contract Addresses (per chain)
// https://docs.uniswap.org/contracts/v4/deployments
// ═══════════════════════════════════════════

import type { SupportedChainId } from '@/lib/wallet/wagmi-config';

const V4_POSITION_MANAGERS: Record<string, { address: `0x${string}`; chainId: SupportedChainId }> = {
  ethereum: {
    address: '0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e',
    chainId: CHAIN_IDS.ETHEREUM,
  },
  base: {
    address: '0x7C5f5A4bBd8fD63184577525326123B519429bDc',
    chainId: CHAIN_IDS.BASE,
  },
  arbitrum: {
    address: '0xd88F38F930b7952f2DB2432Cb002E7AbBf3dD869',
    chainId: CHAIN_IDS.ARBITRUM,
  },
};

// Map Zerion chain IDs to our chain identifiers
const ZERION_CHAIN_MAP: Record<string, string> = {
  'ethereum': 'ethereum',
  'base': 'base',
  'arbitrum-one': 'arbitrum',
};

// Minimal ABI for reading V4 PositionManager
const POSITION_MANAGER_ABI = [
  {
    name: 'positionInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: 'info', type: 'bytes32' }],
  },
  {
    name: 'getPositionLiquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint128' }],
  },
] as const;

// ═══════════════════════════════════════════
// V3/V4 Math (same formulas)
// ═══════════════════════════════════════════

/**
 * Convert tick to human-readable price
 * Returns price of token0 in terms of token1
 */
function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  return Math.pow(1.0001, tick) * Math.pow(10, decimals0 - decimals1);
}

/**
 * Convert price ratio to tick
 */
function priceToTick(priceRatio: number, decimals0: number, decimals1: number): number {
  const adjustedPrice = priceRatio / Math.pow(10, decimals0 - decimals1);
  if (adjustedPrice <= 0) return 0;
  return Math.floor(Math.log(adjustedPrice) / Math.log(1.0001));
}

/**
 * Calculate token amounts from liquidity and tick range
 */
function calculateAmountsFromLiquidity(
  liquidity: bigint,
  currentTick: number,
  tickLower: number,
  tickUpper: number,
  decimals0: number,
  decimals1: number
): { amount0: number; amount1: number } {
  const liquidityNum = Number(liquidity);
  const sqrtPriceCurrent = Math.sqrt(Math.pow(1.0001, currentTick));
  const sqrtRatioA = Math.sqrt(Math.pow(1.0001, tickLower));
  const sqrtRatioB = Math.sqrt(Math.pow(1.0001, tickUpper));

  let amount0 = 0;
  let amount1 = 0;

  if (currentTick <= tickLower) {
    // All token0
    amount0 = liquidityNum * (1 / sqrtRatioA - 1 / sqrtRatioB);
  } else if (currentTick < tickUpper) {
    // In range
    amount0 = liquidityNum * (1 / sqrtPriceCurrent - 1 / sqrtRatioB);
    amount1 = liquidityNum * (sqrtPriceCurrent - sqrtRatioA);
  } else {
    // All token1
    amount1 = liquidityNum * (sqrtRatioB - sqrtRatioA);
  }

  return {
    amount0: amount0 / Math.pow(10, decimals0),
    amount1: amount1 / Math.pow(10, decimals1),
  };
}

/**
 * Decode V4 PositionInfo bytes32
 *
 * Layout (big-endian):
 *   bits [255:56] = poolId (200 bits = 25 bytes) → hex chars [0:50]
 *   bits [55:32]  = tickLower (24 bits)          → hex chars [50:56]
 *   bits [31:8]   = tickUpper (24 bits)          → hex chars [56:62]
 *   bits [7:0]    = hasSubscriber (8 bits)        → hex chars [62:64]
 */
function decodePositionInfo(infoHex: string): {
  poolIdTruncated: string;
  tickLower: number;
  tickUpper: number;
  hasSubscriber: boolean;
} {
  const hex = infoHex.slice(2); // remove 0x

  // poolId: first 50 hex chars (25 bytes)
  const poolIdTruncated = '0x' + hex.slice(0, 50);

  // tickLower: next 6 hex chars (3 bytes, int24)
  let tickLower = parseInt(hex.slice(50, 56), 16);
  if (tickLower >= 0x800000) tickLower -= 0x1000000;

  // tickUpper: next 6 hex chars (3 bytes, int24)
  let tickUpper = parseInt(hex.slice(56, 62), 16);
  if (tickUpper >= 0x800000) tickUpper -= 0x1000000;

  // hasSubscriber: last 2 hex chars (1 byte)
  const hasSubscriber = parseInt(hex.slice(62, 64), 16) !== 0;

  return { poolIdTruncated, tickLower, tickUpper, hasSubscriber };
}

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

interface V4OnChainData {
  tokenId: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  poolIdTruncated: string;
}

interface V4PositionInput {
  tokenId: string;
  chainKey: string;
  zerionPosition: NormalizedDeFiPosition;
}

export interface UseUniswapV4PositionsReturn {
  positions: PoolPosition[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

// ═══════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════

/**
 * Hook to fetch Uniswap V4 position data by combining:
 * - Zerion LP data (token info, prices, values)
 * - On-chain V4 data (tick range, liquidity)
 *
 * @param zerionLpPositions - Grouped LP positions from Zerion
 */
export function useUniswapV4Positions(
  zerionLpPositions: NormalizedDeFiPosition[]
): UseUniswapV4PositionsReturn {
  const { isConnected } = useAccount();

  // Extract V4 positions with NFT IDs from Zerion LP data
  const v4Inputs = useMemo((): V4PositionInput[] => {
    const inputs: V4PositionInput[] = [];

    zerionLpPositions.forEach(function(pos) {
      const protocol = pos.protocol.toLowerCase();
      const isV4 = protocol.includes('uniswap') &&
        (protocol.includes('v4') || protocol.includes('v 4'));

      if (!isV4) return;

      const match = pos.positionName.match(/#(\d+)/);
      if (!match) return;

      const chainKey = ZERION_CHAIN_MAP[pos.chainId];
      if (!chainKey || !V4_POSITION_MANAGERS[chainKey]) return;

      inputs.push({
        tokenId: match[1],
        chainKey,
        zerionPosition: pos,
      });
    });

    return inputs;
  }, [zerionLpPositions]);

  // Fetch on-chain V4 data for all positions
  const {
    data: onChainResults,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['uniswap-v4-onchain', v4Inputs.map(function(i) { return i.tokenId; }).join(',')],
    queryFn: async (): Promise<Record<string, V4OnChainData>> => {
      const results: Record<string, V4OnChainData> = {};

      // Process each position (Promise.all for parallelism)
      const promises = v4Inputs.map(async function(input) {
        const config = V4_POSITION_MANAGERS[input.chainKey];
        if (!config) return;

        try {
          const [infoResult, liquidityResult] = await Promise.all([
            readContract(wagmiConfig, {
              address: config.address,
              abi: POSITION_MANAGER_ABI,
              functionName: 'positionInfo',
              args: [BigInt(input.tokenId)],
              chainId: config.chainId,
            }),
            readContract(wagmiConfig, {
              address: config.address,
              abi: POSITION_MANAGER_ABI,
              functionName: 'getPositionLiquidity',
              args: [BigInt(input.tokenId)],
              chainId: config.chainId,
            }),
          ]);

          const decoded = decodePositionInfo(infoResult as string);

          results[input.tokenId] = {
            tokenId: input.tokenId,
            tickLower: decoded.tickLower,
            tickUpper: decoded.tickUpper,
            liquidity: (liquidityResult as bigint).toString(),
            poolIdTruncated: decoded.poolIdTruncated,
          };
        } catch (err) {
          console.warn('[V4] Failed to read on-chain data for token', input.tokenId, err);
        }
      });

      await Promise.all(promises);
      return results;
    },
    enabled: isConnected && v4Inputs.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 2 * 60_000,
    retry: 1,
  });

  // Combine Zerion + on-chain data into PoolPosition objects
  const positions: PoolPosition[] = useMemo(function() {
    if (v4Inputs.length === 0) return [];

    const result: PoolPosition[] = [];

    v4Inputs.forEach(function(input) {
      const pos = input.zerionPosition;
      const onChain = onChainResults?.[input.tokenId];

      // Get individual token data from the grouped LP position
      const tokenAmounts = pos.lpTokenAmounts || [];

      // Need at least 2 tokens for a proper LP position
      if (tokenAmounts.length < 2) return;

      // Sort tokens by address (token0 < token1 in Uniswap)
      const sortedTokens = tokenAmounts.slice().sort(function(a, b) {
        const addrA = (a.address || '').toLowerCase();
        const addrB = (b.address || '').toLowerCase();
        // Native ETH (no address or 0x000...) sorts first
        if (!addrA || addrA === '0x0000000000000000000000000000000000000000') return -1;
        if (!addrB || addrB === '0x0000000000000000000000000000000000000000') return 1;
        return addrA < addrB ? -1 : addrA > addrB ? 1 : 0;
      });

      const t0 = sortedTokens[0];
      const t1 = sortedTokens[1] || sortedTokens[0]; // fallback to same token if only 1

      const token0: TokenInfo = {
        symbol: t0.symbol,
        name: t0.name,
        address: t0.address || '',
        decimals: t0.decimals || 18,
        price: t0.priceUsd || 0,
        logo: t0.icon,
      };

      const token1: TokenInfo = {
        symbol: t1.symbol,
        name: t1.name,
        address: t1.address || '',
        decimals: t1.decimals || 6,
        price: t1.priceUsd || 1,
        logo: t1.icon,
      };

      // Current price: token0 in terms of token1
      const currentPrice = token1.price > 0 ? token0.price / token1.price : 0;

      // Derive current tick from price
      const currentTick = currentPrice > 0
        ? priceToTick(currentPrice, token0.decimals, token1.decimals)
        : 0;

      // Use on-chain ticks if available, otherwise estimate from current price
      const hasOnChain = !!onChain && onChain.liquidity !== '0';
      const tickLower = hasOnChain ? onChain.tickLower : currentTick - 5000;
      const tickUpper = hasOnChain ? onChain.tickUpper : currentTick + 5000;

      // Calculate prices from ticks
      const priceLower = tickToPrice(tickLower, token0.decimals, token1.decimals);
      const priceUpper = tickToPrice(tickUpper, token0.decimals, token1.decimals);

      const inRange = currentTick >= tickLower && currentTick < tickUpper;

      // Token amounts: use on-chain calculation if available, otherwise Zerion data
      let amount0 = t0.amount || 0;
      let amount1 = t1.amount || 0;

      if (hasOnChain) {
        const liquidity = BigInt(onChain.liquidity);
        const calculated = calculateAmountsFromLiquidity(
          liquidity, currentTick, tickLower, tickUpper,
          token0.decimals, token1.decimals
        );
        // Only use calculated amounts if they're reasonable
        if (calculated.amount0 >= 0 && calculated.amount1 >= 0) {
          amount0 = calculated.amount0;
          amount1 = calculated.amount1;
        }
      }

      const value0 = amount0 * token0.price;
      const value1 = amount1 * token1.price;
      const totalValue = pos.valueUsd || (value0 + value1);

      // Extract fee tier from position name (e.g., "0.3%", "0.05%")
      const feeMatch = pos.positionName.match(/(\d+\.?\d*)\s*%/);
      const feeTier = feeMatch ? parseFloat(feeMatch[1]) : 0.3;

      // APR from DeFiLlama enrichment
      const apr = pos.apy?.total || 0;

      // Map chain key to PoolPosition chain type
      const chainMap: Record<string, EVMChain> = {
        'ethereum': 'ethereum',
        'base': 'base',
        'arbitrum': 'arbitrum',
      };

      const poolPosition: PoolPosition = {
        id: 'v4-' + input.chainKey + '-' + input.tokenId,
        nftId: input.tokenId,
        protocol: 'uniswap-v4',
        chain: chainMap[input.chainKey] || 'ethereum',
        networkType: 'evm',
        token0,
        token1,
        feeTier,
        liquidity: hasOnChain ? onChain.liquidity : '0',
        tickLower,
        tickUpper,
        currentTick,
        priceLower,
        priceUpper,
        currentPrice,
        token0Amount: amount0,
        token1Amount: amount1,
        totalValueUsd: totalValue,
        feesEarned: { token0: 0, token1: 0, totalUsd: 0 },
        feesUnclaimed: { token0: 0, token1: 0, totalUsd: 0 },
        initialValueUsd: totalValue,
        currentValueUsd: totalValue,
        pnlUsd: 0,
        pnlPercent: 0,
        impermanentLoss: 0,
        impermanentLossUsd: 0,
        hodlValueUsd: totalValue,
        feeApr: apr,
        rewardsApr: 0,
        totalApr: apr,
        status: inRange ? 'in-range' : 'out-of-range',
        inRangePercent: inRange ? 100 : 0,
        createdAt: pos.updatedAt || new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        automation: {
          autoCompound: false,
          autoRange: false,
          autoExit: false,
        },
      };

      result.push(poolPosition);
    });

    return result;
  }, [v4Inputs, onChainResults]);

  return {
    positions,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

export default useUniswapV4Positions;
