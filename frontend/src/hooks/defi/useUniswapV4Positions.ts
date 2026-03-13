'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { readContract } from '@wagmi/core';
import { keccak256, encodeAbiParameters } from 'viem';
import { wagmiConfig, CHAIN_IDS } from '@/lib/wallet/wagmi-config';
import type { PoolPosition, TokenInfo, EVMChain } from '@/components/defi/pools/types';
import type { NormalizedDeFiPosition } from '@/lib/defi';
import type { SupportedChainId } from '@/lib/wallet/wagmi-config';

// ═══════════════════════════════════════════
// V4 Contract Addresses (per chain)
// https://docs.uniswap.org/contracts/v4/deployments
// ═══════════════════════════════════════════

interface V4ChainConfig {
  positionManager: `0x${string}`;
  stateView: `0x${string}`;
  chainId: SupportedChainId;
}

const V4_CONTRACTS: Record<string, V4ChainConfig> = {
  ethereum: {
    positionManager: '0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e',
    stateView: '0x7ffe42c4a5deea5b0fec41c94c136cf115597227',
    chainId: CHAIN_IDS.ETHEREUM,
  },
  base: {
    positionManager: '0x7C5f5A4bBd8fD63184577525326123B519429bDc',
    stateView: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
    chainId: CHAIN_IDS.BASE,
  },
  arbitrum: {
    positionManager: '0xd88F38F930b7952f2DB2432Cb002E7AbBf3dD869',
    stateView: '0x76fd297e2d437cd7f76d50f01afe6160f86e9990',
    chainId: CHAIN_IDS.ARBITRUM,
  },
};

// Map Zerion chain IDs to our chain identifiers
const ZERION_CHAIN_MAP: Record<string, string> = {
  'ethereum': 'ethereum',
  'base': 'base',
  'arbitrum-one': 'arbitrum',
};

// ═══════════════════════════════════════════
// ABIs
// ═══════════════════════════════════════════

// PositionManager: getPoolAndPositionInfo returns full PoolKey + packed info
const POSITION_MANAGER_ABI = [
  {
    name: 'getPoolAndPositionInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        name: 'poolKey',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      { name: 'info', type: 'uint256' },
    ],
  },
  {
    name: 'getPositionLiquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint128' }],
  },
] as const;

// StateView: read-only lens for pool state and fees
const STATE_VIEW_ABI = [
  {
    name: 'getPositionInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'poolId', type: 'bytes32' },
      { name: 'owner', type: 'address' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
    ],
  },
  {
    name: 'getFeeGrowthInside',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'poolId', type: 'bytes32' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
    ],
    outputs: [
      { name: 'feeGrowthInside0X128', type: 'uint256' },
      { name: 'feeGrowthInside1X128', type: 'uint256' },
    ],
  },
  {
    name: 'getSlot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' },
    ],
  },
] as const;

// ═══════════════════════════════════════════
// V3/V4 Math (same formulas)
// ═══════════════════════════════════════════

function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  return Math.pow(1.0001, tick) * Math.pow(10, decimals0 - decimals1);
}

function priceToTick(priceRatio: number, decimals0: number, decimals1: number): number {
  const adjustedPrice = priceRatio / Math.pow(10, decimals0 - decimals1);
  if (adjustedPrice <= 0) return 0;
  return Math.floor(Math.log(adjustedPrice) / Math.log(1.0001));
}

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
    amount0 = liquidityNum * (1 / sqrtRatioA - 1 / sqrtRatioB);
  } else if (currentTick < tickUpper) {
    amount0 = liquidityNum * (1 / sqrtPriceCurrent - 1 / sqrtRatioB);
    amount1 = liquidityNum * (sqrtPriceCurrent - sqrtRatioA);
  } else {
    amount1 = liquidityNum * (sqrtRatioB - sqrtRatioA);
  }

  return {
    amount0: amount0 / Math.pow(10, decimals0),
    amount1: amount1 / Math.pow(10, decimals1),
  };
}

// ═══════════════════════════════════════════
// V4-specific helpers
// ═══════════════════════════════════════════

// Q128 = 2^128 for fee math
const Q128 = BigInt(1) << BigInt(128);
// Mask for 2^256 wrapping
const TWO_256 = BigInt(1) << BigInt(256);

/**
 * Compute full poolId from PoolKey via keccak256(abi.encode(poolKey))
 */
function computePoolId(poolKey: {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
}): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address', name: 'currency0' },
        { type: 'address', name: 'currency1' },
        { type: 'uint24', name: 'fee' },
        { type: 'int24', name: 'tickSpacing' },
        { type: 'address', name: 'hooks' },
      ],
      [
        poolKey.currency0 as `0x${string}`,
        poolKey.currency1 as `0x${string}`,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks as `0x${string}`,
      ]
    )
  );
}

/**
 * Decode packed uint256 info from getPoolAndPositionInfo
 * Layout (from LSB): 8 bits hasSubscriber | 24 bits tickLower | 24 bits tickUpper | 200 bits poolIdPrefix
 */
function decodePackedInfo(infoBigInt: bigint): {
  tickLower: number;
  tickUpper: number;
} {
  // tickLower: bits [31:8] (shift right 8, mask 24 bits)
  let tickLower = Number((infoBigInt >> BigInt(8)) & BigInt(0xFFFFFF));
  if (tickLower >= 0x800000) tickLower -= 0x1000000;

  // tickUpper: bits [55:32] (shift right 32, mask 24 bits)
  let tickUpper = Number((infoBigInt >> BigInt(32)) & BigInt(0xFFFFFF));
  if (tickUpper >= 0x800000) tickUpper -= 0x1000000;

  return { tickLower: tickLower, tickUpper: tickUpper };
}

/**
 * Convert tokenId to bytes32 salt for StateView calls
 */
function tokenIdToSalt(tokenId: string): `0x${string}` {
  return ('0x' + BigInt(tokenId).toString(16).padStart(64, '0')) as `0x${string}`;
}

/**
 * Calculate unclaimed fees from fee growth differential
 */
function calculateFees(
  feeGrowthCurrent: bigint,
  feeGrowthLast: bigint,
  liquidity: bigint,
  decimals: number
): number {
  // Handle uint256 underflow wrapping
  let diff = feeGrowthCurrent - feeGrowthLast;
  if (diff < BigInt(0)) {
    diff = diff + TWO_256;
  }
  const rawFees = (diff * liquidity) / Q128;
  return Number(rawFees) / Math.pow(10, decimals);
}

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

interface V4OnChainData {
  tokenId: string;
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  liquidity: string;
  poolId: string;
  poolKey: {
    currency0: string;
    currency1: string;
    fee: number;
    tickSpacing: number;
    hooks: string;
  };
  // Unclaimed fees (from StateView)
  feesUnclaimed0: number;
  feesUnclaimed1: number;
  // Token decimals used for fee calculation
  decimals0: number;
  decimals1: number;
}

interface V4SubgraphData {
  tokenId: string;
  createdTimestamp: number;
  // Aggregated from ModifyLiquidity events
  totalDeposited0: number;
  totalDeposited1: number;
  totalWithdrawn0: number;
  totalWithdrawn1: number;
  totalDepositedUsd: number;
  totalWithdrawnUsd: number;
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
// V4 Subgraph
// ═══════════════════════════════════════════

const THEGRAPH_API_KEY = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_THEGRAPH_API_KEY || '')
  : (process.env.NEXT_PUBLIC_THEGRAPH_API_KEY || '');

function getV4SubgraphEndpoint(chainKey: string): string | null {
  const subgraphIds: Record<string, string> = {
    ethereum: 'DiYPVdygkfjDWhbxGSqAQxwBKmfKnkWQojqeM2rkLb3G',
  };
  const id = subgraphIds[chainKey];
  if (!id || !THEGRAPH_API_KEY) return null;
  return 'https://gateway.thegraph.com/api/' + THEGRAPH_API_KEY + '/subgraphs/id/' + id;
}

// Query positions for createdAt + all ModifyLiquidity events for the wallet
const V4_SUBGRAPH_QUERY = '\
  query GetV4Data($owner: String!, $tokenIds: [BigInt!]!) {\
    positions(where: { tokenId_in: $tokenIds }) {\
      tokenId\
      createdAtTimestamp\
    }\
    modifyLiquidities(\
      where: { origin: $owner }\
      orderBy: timestamp\
      first: 500\
    ) {\
      amount\
      amount0\
      amount1\
      amountUSD\
      tickLower\
      tickUpper\
      pool { id }\
      timestamp\
    }\
  }\
';

interface SubgraphModifyEvent {
  amount: string;
  amount0: string;
  amount1: string;
  amountUSD: string | null;
  tickLower: string;
  tickUpper: string;
  pool: { id: string };
  timestamp: string;
}

/**
 * Fetch subgraph data and match ModifyLiquidity events to positions
 * using poolId + tickLower + tickUpper from on-chain data
 */
async function fetchV4SubgraphData(
  chainKey: string,
  owner: string,
  tokenIds: string[],
  onChainPositions: Record<string, V4OnChainData>
): Promise<Record<string, V4SubgraphData>> {
  const endpoint = getV4SubgraphEndpoint(chainKey);
  if (!endpoint || tokenIds.length === 0) return {};

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: V4_SUBGRAPH_QUERY,
        variables: { owner: owner.toLowerCase(), tokenIds: tokenIds },
      }),
    });

    if (!response.ok) return {};

    const json = await response.json();
    if (json.errors) {
      console.warn('[V4 Subgraph] Query errors:', json.errors);
    }

    const positions: Array<{ tokenId: string; createdAtTimestamp: string }> = json.data?.positions || [];
    const events: SubgraphModifyEvent[] = json.data?.modifyLiquidities || [];

    // Build createdAt map
    const createdAtMap: Record<string, number> = {};
    positions.forEach(function(p) {
      createdAtMap[p.tokenId] = parseInt(p.createdAtTimestamp) || 0;
    });

    // Match events to positions by poolId + ticks
    const result: Record<string, V4SubgraphData> = {};

    tokenIds.forEach(function(tokenId) {
      const onChain = onChainPositions[tokenId];
      if (!onChain) return;

      // Find matching events: same pool + same ticks
      const matchingEvents = events.filter(function(evt) {
        return evt.pool.id.toLowerCase() === onChain.poolId.toLowerCase() &&
          parseInt(evt.tickLower) === onChain.tickLower &&
          parseInt(evt.tickUpper) === onChain.tickUpper;
      });

      let totalDeposited0 = 0;
      let totalDeposited1 = 0;
      let totalWithdrawn0 = 0;
      let totalWithdrawn1 = 0;
      let totalDepositedUsd = 0;
      let totalWithdrawnUsd = 0;

      matchingEvents.forEach(function(evt) {
        const liquidityDelta = parseFloat(evt.amount) || 0;
        const a0 = parseFloat(evt.amount0) || 0;
        const a1 = parseFloat(evt.amount1) || 0;
        const usd = parseFloat(evt.amountUSD || '0') || 0;

        if (liquidityDelta > 0) {
          // Adding liquidity = deposit
          totalDeposited0 += Math.abs(a0);
          totalDeposited1 += Math.abs(a1);
          totalDepositedUsd += Math.abs(usd);
        } else if (liquidityDelta < 0) {
          // Removing liquidity = withdrawal (includes collected fees)
          totalWithdrawn0 += Math.abs(a0);
          totalWithdrawn1 += Math.abs(a1);
          totalWithdrawnUsd += Math.abs(usd);
        }
      });

      result[tokenId] = {
        tokenId: tokenId,
        createdTimestamp: createdAtMap[tokenId] || 0,
        totalDeposited0: totalDeposited0,
        totalDeposited1: totalDeposited1,
        totalWithdrawn0: totalWithdrawn0,
        totalWithdrawn1: totalWithdrawn1,
        totalDepositedUsd: totalDepositedUsd,
        totalWithdrawnUsd: totalWithdrawnUsd,
      };
    });

    return result;
  } catch (err) {
    console.warn('[V4 Subgraph] Failed to fetch for chain', chainKey, err);
    return {};
  }
}

// ═══════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════

export function useUniswapV4Positions(
  zerionLpPositions: NormalizedDeFiPosition[]
): UseUniswapV4PositionsReturn {
  const { address, isConnected } = useAccount();

  // Extract V4 positions with NFT IDs from Zerion LP data
  const v4Inputs = useMemo(function(): V4PositionInput[] {
    const inputs: V4PositionInput[] = [];

    zerionLpPositions.forEach(function(pos) {
      const protocol = pos.protocol.toLowerCase();
      const isV4 = protocol.includes('uniswap') &&
        (protocol.includes('v4') || protocol.includes('v 4'));

      if (!isV4) return;

      const match = pos.positionName.match(/#(\d+)/);
      if (!match) return;

      const chainKey = ZERION_CHAIN_MAP[pos.chainId];
      if (!chainKey || !V4_CONTRACTS[chainKey]) return;

      inputs.push({
        tokenId: match[1],
        chainKey: chainKey,
        zerionPosition: pos,
      });
    });

    return inputs;
  }, [zerionLpPositions]);

  // ───────────────────────────────────────
  // Query 1: On-chain data (PositionManager + StateView)
  // ───────────────────────────────────────
  const {
    data: onChainResults,
    isLoading: isLoadingOnChain,
    isError: isErrorOnChain,
    error: errorOnChain,
    refetch: refetchOnChain,
  } = useQuery({
    queryKey: ['uniswap-v4-onchain', v4Inputs.map(function(i) { return i.tokenId; }).join(',')],
    queryFn: async function(): Promise<Record<string, V4OnChainData>> {
      const results: Record<string, V4OnChainData> = {};

      const promises = v4Inputs.map(async function(input) {
        const config = V4_CONTRACTS[input.chainKey];
        if (!config) return;

        try {
          // Step 1: Get full poolKey + position info + liquidity (parallel)
          const readResults = await Promise.all([
            readContract(wagmiConfig, {
              address: config.positionManager,
              abi: POSITION_MANAGER_ABI,
              functionName: 'getPoolAndPositionInfo',
              args: [BigInt(input.tokenId)],
              chainId: config.chainId,
            }),
            readContract(wagmiConfig, {
              address: config.positionManager,
              abi: POSITION_MANAGER_ABI,
              functionName: 'getPositionLiquidity',
              args: [BigInt(input.tokenId)],
              chainId: config.chainId,
            }),
          ]);

          const poolAndPositionResult = readResults[0] as [
            { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string },
            bigint
          ];
          const liquidityResult = readResults[1] as bigint;

          const poolKey = poolAndPositionResult[0];
          const infoBigInt = poolAndPositionResult[1];
          const decoded = decodePackedInfo(infoBigInt);
          const poolId = computePoolId(poolKey);
          const liquidity = liquidityResult;
          const salt = tokenIdToSalt(input.tokenId);

          // Get token decimals from Zerion data
          const tokenAmounts = input.zerionPosition.lpTokenAmounts || [];
          let decimals0 = 18;
          let decimals1 = 6;
          if (tokenAmounts.length >= 2) {
            // Sort by address to match token0/token1 order
            const sorted = tokenAmounts.slice().sort(function(a, b) {
              const addrA = (a.address || '').toLowerCase();
              const addrB = (b.address || '').toLowerCase();
              if (!addrA || addrA === '0x0000000000000000000000000000000000000000') return -1;
              if (!addrB || addrB === '0x0000000000000000000000000000000000000000') return 1;
              return addrA < addrB ? -1 : addrA > addrB ? 1 : 0;
            });
            decimals0 = sorted[0].decimals || 18;
            decimals1 = sorted[1].decimals || 6;
          }

          // Step 2: Get current tick from StateView and fee growth data (parallel)
          let feesUnclaimed0 = 0;
          let feesUnclaimed1 = 0;
          let currentTickOnChain = 0;

          try {
            const stateViewResults = await Promise.all([
              readContract(wagmiConfig, {
                address: config.stateView,
                abi: STATE_VIEW_ABI,
                functionName: 'getPositionInfo',
                args: [poolId, config.positionManager, decoded.tickLower, decoded.tickUpper, salt],
                chainId: config.chainId,
              }),
              readContract(wagmiConfig, {
                address: config.stateView,
                abi: STATE_VIEW_ABI,
                functionName: 'getFeeGrowthInside',
                args: [poolId, decoded.tickLower, decoded.tickUpper],
                chainId: config.chainId,
              }),
              readContract(wagmiConfig, {
                address: config.stateView,
                abi: STATE_VIEW_ABI,
                functionName: 'getSlot0',
                args: [poolId],
                chainId: config.chainId,
              }),
            ]);

            const positionInfo = stateViewResults[0] as [bigint, bigint, bigint];
            const feeGrowthResult = stateViewResults[1] as [bigint, bigint];
            const slot0Result = stateViewResults[2] as [bigint, number, number, number];

            const posLiquidity = positionInfo[0];
            const feeGrowthInside0Last = positionInfo[1];
            const feeGrowthInside1Last = positionInfo[2];
            const feeGrowthInside0Current = feeGrowthResult[0];
            const feeGrowthInside1Current = feeGrowthResult[1];
            currentTickOnChain = slot0Result[1];

            // Calculate unclaimed fees
            if (posLiquidity > BigInt(0)) {
              feesUnclaimed0 = calculateFees(
                feeGrowthInside0Current, feeGrowthInside0Last, posLiquidity, decimals0
              );
              feesUnclaimed1 = calculateFees(
                feeGrowthInside1Current, feeGrowthInside1Last, posLiquidity, decimals1
              );
            }
          } catch (stateViewErr) {
            console.warn('[V4 StateView] Failed for token', input.tokenId, stateViewErr);
            // Continue without fee data
          }

          results[input.tokenId] = {
            tokenId: input.tokenId,
            tickLower: decoded.tickLower,
            tickUpper: decoded.tickUpper,
            currentTick: currentTickOnChain,
            liquidity: liquidity.toString(),
            poolId: poolId,
            poolKey: {
              currency0: poolKey.currency0,
              currency1: poolKey.currency1,
              fee: poolKey.fee,
              tickSpacing: poolKey.tickSpacing,
              hooks: poolKey.hooks,
            },
            feesUnclaimed0: feesUnclaimed0,
            feesUnclaimed1: feesUnclaimed1,
            decimals0: decimals0,
            decimals1: decimals1,
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

  // ───────────────────────────────────────
  // Query 2: Subgraph historical data
  // Depends on on-chain results for poolId + ticks matching
  // ───────────────────────────────────────
  const {
    data: subgraphResults,
    isLoading: isLoadingSubgraph,
  } = useQuery({
    queryKey: ['uniswap-v4-subgraph', address, v4Inputs.map(function(i) { return i.tokenId + ':' + i.chainKey; }).join(',')],
    queryFn: async function(): Promise<Record<string, V4SubgraphData>> {
      if (!address || !onChainResults) return {};

      // Group token IDs by chain
      const byChain: Record<string, string[]> = {};
      v4Inputs.forEach(function(input) {
        if (!byChain[input.chainKey]) {
          byChain[input.chainKey] = [];
        }
        byChain[input.chainKey].push(input.tokenId);
      });

      const allResults: Record<string, V4SubgraphData> = {};
      const chainKeys = Object.keys(byChain);
      const chainPromises = chainKeys.map(function(chainKey) {
        return fetchV4SubgraphData(chainKey, address, byChain[chainKey], onChainResults);
      });

      const chainResults = await Promise.all(chainPromises);
      chainResults.forEach(function(data) {
        Object.keys(data).forEach(function(key) {
          allResults[key] = data[key];
        });
      });

      return allResults;
    },
    enabled: isConnected && v4Inputs.length > 0 && !!address && !!onChainResults,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });

  // ───────────────────────────────────────
  // Combine all data into PoolPosition objects
  // ───────────────────────────────────────
  const positions: PoolPosition[] = useMemo(function() {
    if (v4Inputs.length === 0) return [];

    const result: PoolPosition[] = [];

    v4Inputs.forEach(function(input) {
      const pos = input.zerionPosition;
      const onChain = onChainResults ? onChainResults[input.tokenId] : undefined;
      const subgraph = subgraphResults ? subgraphResults[input.tokenId] : undefined;

      // Get individual token data from the grouped LP position
      const tokenAmounts = pos.lpTokenAmounts || [];
      if (tokenAmounts.length < 2) return;

      // Sort tokens by address (token0 < token1 in Uniswap)
      const sortedTokens = tokenAmounts.slice().sort(function(a, b) {
        const addrA = (a.address || '').toLowerCase();
        const addrB = (b.address || '').toLowerCase();
        if (!addrA || addrA === '0x0000000000000000000000000000000000000000') return -1;
        if (!addrB || addrB === '0x0000000000000000000000000000000000000000') return 1;
        return addrA < addrB ? -1 : addrA > addrB ? 1 : 0;
      });

      const t0 = sortedTokens[0];
      const t1 = sortedTokens[1];

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

      const price0 = token0.price;
      const price1 = token1.price;

      // Current price: token0 in terms of token1
      const currentPrice = price1 > 0 ? price0 / price1 : 0;

      // Derive current tick: prefer on-chain, fallback to price-derived
      let currentTick = 0;
      if (onChain && onChain.currentTick !== 0) {
        currentTick = onChain.currentTick;
      } else if (currentPrice > 0) {
        currentTick = priceToTick(currentPrice, token0.decimals, token1.decimals);
      }

      // Use on-chain ticks if available, otherwise estimate
      const hasOnChain = !!onChain && onChain.liquidity !== '0';
      const tickLower = hasOnChain ? onChain.tickLower : currentTick - 5000;
      const tickUpper = hasOnChain ? onChain.tickUpper : currentTick + 5000;

      // Price range from ticks
      const priceLower = tickToPrice(tickLower, token0.decimals, token1.decimals);
      const priceUpper = tickToPrice(tickUpper, token0.decimals, token1.decimals);

      const inRange = currentTick >= tickLower && currentTick < tickUpper;

      // Token amounts: prefer on-chain calculation
      let amount0 = t0.amount || 0;
      let amount1 = t1.amount || 0;

      if (hasOnChain) {
        const liquidity = BigInt(onChain.liquidity);
        const calculated = calculateAmountsFromLiquidity(
          liquidity, currentTick, tickLower, tickUpper,
          token0.decimals, token1.decimals
        );
        if (calculated.amount0 >= 0 && calculated.amount1 >= 0) {
          amount0 = calculated.amount0;
          amount1 = calculated.amount1;
        }
      }

      const value0 = amount0 * price0;
      const value1 = amount1 * price1;
      const totalValue = pos.valueUsd || (value0 + value1);

      // ── Fees Unclaimed (StateView on-chain) ──
      const unclaimedFees0 = onChain ? onChain.feesUnclaimed0 : 0;
      const unclaimedFees1 = onChain ? onChain.feesUnclaimed1 : 0;
      const unclaimedFeesUsd = unclaimedFees0 * price0 + unclaimedFees1 * price1;

      // ── Historical Data (Subgraph ModifyLiquidity events) ──
      const deposited0 = subgraph ? subgraph.totalDeposited0 : 0;
      const deposited1 = subgraph ? subgraph.totalDeposited1 : 0;
      const withdrawn0 = subgraph ? subgraph.totalWithdrawn0 : 0;
      const withdrawn1 = subgraph ? subgraph.totalWithdrawn1 : 0;
      const depositedUsd = subgraph ? subgraph.totalDepositedUsd : 0;

      // Fees earned = withdrawn amounts include fees from liquidity removal
      // In V4, fees are collected automatically when removing liquidity
      // feesEarned = total withdrawn value - (net liquidity removed at current prices)
      // For now, use unclaimed fees as the primary fee metric
      const feesEarnedUsd = 0; // V4 doesn't track collected fees separately
      const collectedFees0 = 0;
      const collectedFees1 = 0;

      // Initial value: historical USD at time of deposit (most accurate cost basis)
      let initialValue = totalValue; // fallback
      if (subgraph && depositedUsd > 0) {
        initialValue = depositedUsd;
      } else if (subgraph && (deposited0 > 0 || deposited1 > 0)) {
        initialValue = deposited0 * price0 + deposited1 * price1;
      }

      // HODL value: what deposited tokens would be worth now at current prices
      let hodlValue = totalValue; // fallback
      if (subgraph && (deposited0 > 0 || deposited1 > 0)) {
        hodlValue = deposited0 * price0 + deposited1 * price1;
      }

      // Total withdrawn value at current prices
      const withdrawnValueUsd = withdrawn0 * price0 + withdrawn1 * price1;

      // PnL: (current position value + total withdrawn + unclaimed fees) - total deposited
      const pnlUsd = totalValue + withdrawnValueUsd + unclaimedFeesUsd - initialValue;
      const pnlPercent = initialValue > 0 ? (pnlUsd / initialValue) * 100 : 0;

      // Impermanent Loss: HODL vs LP (excluding fees)
      const ilUsd = Math.max(0, hodlValue - totalValue);
      const ilPercent = hodlValue > 0 ? (ilUsd / hodlValue) * 100 : 0;

      // Extract fee tier from position name or poolKey
      let feeTier = 0.3;
      if (hasOnChain && onChain.poolKey) {
        // Fee from poolKey is in hundredths of a bip (1 = 0.0001%)
        // Dynamic fees use fee = 0x800000
        const rawFee = onChain.poolKey.fee;
        if (rawFee > 0 && rawFee < 0x800000) {
          feeTier = rawFee / 10000; // Convert to percentage
        } else {
          // Try extract from position name
          const feeMatch = pos.positionName.match(/(\d+\.?\d*)\s*%/);
          if (feeMatch) feeTier = parseFloat(feeMatch[1]);
        }
      } else {
        const feeMatch2 = pos.positionName.match(/(\d+\.?\d*)\s*%/);
        if (feeMatch2) feeTier = parseFloat(feeMatch2[1]);
      }

      // APR from DeFiLlama enrichment
      const apr = pos.apy?.total || 0;
      // Compute fee-based APR from unclaimed fees if available
      let feeApr = apr;
      if (unclaimedFeesUsd > 0 && totalValue > 0) {
        const createdTs = subgraph ? subgraph.createdTimestamp : 0;
        if (createdTs > 0) {
          const ageMs = Date.now() - (createdTs * 1000);
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          if (ageDays > 0) {
            feeApr = (unclaimedFeesUsd / totalValue) * (365 / ageDays) * 100;
          }
        }
      }

      // Chain map
      const chainMap: Record<string, EVMChain> = {
        'ethereum': 'ethereum',
        'base': 'base',
        'arbitrum': 'arbitrum',
      };

      // Created at timestamp
      let createdAt = pos.updatedAt || new Date().toISOString();
      if (subgraph && subgraph.createdTimestamp > 0) {
        createdAt = new Date(subgraph.createdTimestamp * 1000).toISOString();
      }

      const poolPosition: PoolPosition = {
        id: 'v4-' + input.chainKey + '-' + input.tokenId,
        nftId: input.tokenId,
        protocol: 'uniswap-v4',
        chain: chainMap[input.chainKey] || 'ethereum',
        networkType: 'evm',
        token0: token0,
        token1: token1,
        feeTier: feeTier,
        liquidity: hasOnChain ? onChain.liquidity : '0',
        tickLower: tickLower,
        tickUpper: tickUpper,
        currentTick: currentTick,
        priceLower: priceLower,
        priceUpper: priceUpper,
        currentPrice: currentPrice,
        token0Amount: amount0,
        token1Amount: amount1,
        totalValueUsd: totalValue,
        feesEarned: {
          token0: collectedFees0,
          token1: collectedFees1,
          totalUsd: feesEarnedUsd,
        },
        feesUnclaimed: {
          token0: unclaimedFees0,
          token1: unclaimedFees1,
          totalUsd: unclaimedFeesUsd,
        },
        initialValueUsd: Math.max(initialValue, 0),
        currentValueUsd: totalValue,
        pnlUsd: pnlUsd,
        pnlPercent: pnlPercent,
        impermanentLoss: Math.abs(ilPercent),
        impermanentLossUsd: Math.abs(ilUsd),
        hodlValueUsd: hodlValue,
        feeApr: feeApr,
        rewardsApr: 0,
        totalApr: Math.max(feeApr, apr),
        status: inRange ? 'in-range' : 'out-of-range',
        inRangePercent: inRange ? 100 : 0,
        createdAt: createdAt,
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
  }, [v4Inputs, onChainResults, subgraphResults]);

  return {
    positions: positions,
    isLoading: isLoadingOnChain || isLoadingSubgraph,
    isError: isErrorOnChain,
    error: errorOnChain as Error | null,
    refetch: refetchOnChain,
  };
}

export default useUniswapV4Positions;
