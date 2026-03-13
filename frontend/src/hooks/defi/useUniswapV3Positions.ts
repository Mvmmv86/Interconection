'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import type { PoolPosition, EVMChain, TokenInfo } from '@/components/defi/pools/types';

// The Graph Gateway API key (same as V4)
const THEGRAPH_API_KEY = process.env.NEXT_PUBLIC_THEGRAPH_API_KEY || '';

// Uniswap V3 Subgraph IDs for The Graph Network Gateway
const V3_SUBGRAPH_IDS: Record<EVMChain, string | null> = {
  ethereum: '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
  base: '43Hwfi3dJSoGpyas9VwNoDAv55yjgGrPpNSmbQZArzMG',
  arbitrum: 'FbCGRftH4a3yZugY7TnbYgPJVEv2LvMT6oF1fxPe9aJM',
  optimism: 'Cghf4LfVqPiFw6fp6Y5X5Ubc8UpmUhSfJL82zwiBFLaj',
  polygon: '3hCPRGf4z88VC5rsBKU5AA9FBBq5nF3jbKJG7VZCbhjm',
  bsc: null,
  avalanche: null,
};

// Build subgraph URL from ID + API key
function buildSubgraphUrl(id: string | null): string | null {
  if (!id || !THEGRAPH_API_KEY) return null;
  return 'https://gateway.thegraph.com/api/' + THEGRAPH_API_KEY + '/subgraphs/id/' + id;
}

// Uniswap V3 Subgraph endpoints (built from IDs + API key)
const UNISWAP_V3_SUBGRAPHS: Record<EVMChain, string | null> = {
  ethereum: buildSubgraphUrl(V3_SUBGRAPH_IDS.ethereum),
  base: buildSubgraphUrl(V3_SUBGRAPH_IDS.base),
  arbitrum: buildSubgraphUrl(V3_SUBGRAPH_IDS.arbitrum),
  optimism: buildSubgraphUrl(V3_SUBGRAPH_IDS.optimism),
  polygon: buildSubgraphUrl(V3_SUBGRAPH_IDS.polygon),
  bsc: null,
  avalanche: null,
};

// GraphQL query for user positions
const POSITIONS_QUERY = `
  query GetPositions($owner: String!) {
    positions(
      where: { owner: $owner, liquidity_gt: 0 }
      orderBy: id
      orderDirection: desc
      first: 100
    ) {
      id
      owner
      liquidity
      depositedToken0
      depositedToken1
      withdrawnToken0
      withdrawnToken1
      collectedFeesToken0
      collectedFeesToken1
      tickLower {
        tickIdx
      }
      tickUpper {
        tickIdx
      }
      pool {
        id
        token0 {
          id
          symbol
          name
          decimals
        }
        token1 {
          id
          symbol
          name
          decimals
        }
        feeTier
        tick
        sqrtPrice
        liquidity
        token0Price
        token1Price
      }
      transaction {
        timestamp
      }
    }
  }
`;

// Types for GraphQL response
interface SubgraphToken {
  id: string;
  symbol: string;
  name: string;
  decimals: string;
}

interface SubgraphPool {
  id: string;
  token0: SubgraphToken;
  token1: SubgraphToken;
  feeTier: string;
  tick: string;
  sqrtPrice: string;
  liquidity: string;
  token0Price: string;
  token1Price: string;
}

interface SubgraphPosition {
  id: string;
  owner: string;
  liquidity: string;
  depositedToken0: string;
  depositedToken1: string;
  withdrawnToken0: string;
  withdrawnToken1: string;
  collectedFeesToken0: string;
  collectedFeesToken1: string;
  tickLower: { tickIdx: string };
  tickUpper: { tickIdx: string };
  pool: SubgraphPool;
  transaction: { timestamp: string };
}

interface SubgraphResponse {
  data: {
    positions: SubgraphPosition[];
  };
}

import { fetchTokenPrices, getPriceFromMap } from '@/lib/defi/token-price-service';

// Q96 constant for Uniswap V3 math (2^96)
const Q96 = BigInt('79228162514264337593543950336'); // 2^96

/**
 * Calculate token amounts from liquidity and price range
 * Based on Uniswap V3 math (simplified for display purposes)
 */
function calculateAmounts(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  decimals0: number,
  decimals1: number
): { amount0: number; amount1: number } {
  // For display purposes, use simplified calculation
  // In production, use @uniswap/v3-sdk for precise calculations
  const liquidityNum = Number(liquidity);
  const sqrtPriceNum = Number(sqrtPriceX96) / Number(Q96);

  // Calculate sqrt prices at tick boundaries
  const sqrtRatioA = Math.sqrt(Math.pow(1.0001, tickLower));
  const sqrtRatioB = Math.sqrt(Math.pow(1.0001, tickUpper));

  let amount0 = 0;
  let amount1 = 0;

  if (sqrtPriceNum <= sqrtRatioA) {
    // Current price below range - all token0
    amount0 = liquidityNum * (1 / sqrtRatioA - 1 / sqrtRatioB);
  } else if (sqrtPriceNum < sqrtRatioB) {
    // Current price in range
    amount0 = liquidityNum * (1 / sqrtPriceNum - 1 / sqrtRatioB);
    amount1 = liquidityNum * (sqrtPriceNum - sqrtRatioA);
  } else {
    // Current price above range - all token1
    amount1 = liquidityNum * (sqrtRatioB - sqrtRatioA);
  }

  return {
    amount0: amount0 / Math.pow(10, decimals0),
    amount1: amount1 / Math.pow(10, decimals1),
  };
}

/**
 * Convert tick to price
 */
function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  return Math.pow(1.0001, tick) * Math.pow(10, decimals0 - decimals1);
}

/**
 * Fetch positions from Uniswap V3 subgraph
 */
async function fetchPositionsFromSubgraph(
  chain: EVMChain,
  owner: string
): Promise<PoolPosition[]> {
  const subgraphUrl = UNISWAP_V3_SUBGRAPHS[chain];

  if (!subgraphUrl) {
    return [];
  }

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: POSITIONS_QUERY,
        variables: { owner: owner.toLowerCase() },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: SubgraphResponse = await response.json();

    if (!result.data?.positions) {
      return [];
    }

    // Collect unique tokens for price fetching
    const tokenSet: Record<string, { address: string; chain: string }> = {};
    result.data.positions.forEach(function(pos: SubgraphPosition) {
      tokenSet[pos.pool.token0.id] = { address: pos.pool.token0.id, chain: chain };
      tokenSet[pos.pool.token1.id] = { address: pos.pool.token1.id, chain: chain };
    });

    // Batch-fetch real prices from DeFiLlama
    const tokenList = Object.values(tokenSet);
    const priceMap = tokenList.length > 0 ? await fetchTokenPrices(tokenList) : {};

    return result.data.positions.map(function(pos): PoolPosition {
      const pool = pos.pool;
      const decimals0 = parseInt(pool.token0.decimals);
      const decimals1 = parseInt(pool.token1.decimals);
      const tickLower = parseInt(pos.tickLower.tickIdx);
      const tickUpper = parseInt(pos.tickUpper.tickIdx);
      const currentTick = parseInt(pool.tick);
      const liquidity = BigInt(pos.liquidity);
      const sqrtPriceX96 = BigInt(pool.sqrtPrice);

      // Calculate current amounts
      const amounts = calculateAmounts(
        liquidity,
        sqrtPriceX96,
        tickLower,
        tickUpper,
        decimals0,
        decimals1
      );
      const amount0 = amounts.amount0;
      const amount1 = amounts.amount1;

      // Get real prices from DeFiLlama
      const price0 = getPriceFromMap(priceMap, chain, pool.token0.id) || 1;
      const price1 = getPriceFromMap(priceMap, chain, pool.token1.id) || 1;

      // Calculate values
      const value0 = amount0 * price0;
      const value1 = amount1 * price1;
      const totalValue = value0 + value1;

      // Calculate prices
      const priceLower = tickToPrice(tickLower, decimals0, decimals1);
      const priceUpper = tickToPrice(tickUpper, decimals0, decimals1);
      const currentPrice = parseFloat(pool.token0Price) || tickToPrice(currentTick, decimals0, decimals1);

      // Is in range?
      const inRange = currentTick >= tickLower && currentTick < tickUpper;

      // Calculate fees
      const deposited0 = parseFloat(pos.depositedToken0) || 0;
      const deposited1 = parseFloat(pos.depositedToken1) || 0;
      const withdrawn0 = parseFloat(pos.withdrawnToken0) || 0;
      const withdrawn1 = parseFloat(pos.withdrawnToken1) || 0;
      const collectedFees0 = parseFloat(pos.collectedFeesToken0) || 0;
      const collectedFees1 = parseFloat(pos.collectedFeesToken1) || 0;

      const initialValue = (deposited0 - withdrawn0) * price0 + (deposited1 - withdrawn1) * price1;
      const feesEarnedUsd = collectedFees0 * price0 + collectedFees1 * price1;

      // Estimate uncollected fees (simplified - in production use simulateContract)
      const unclaimedFees0 = Math.max(0, (deposited0 - withdrawn0 - amount0) * 0.01);
      const unclaimedFees1 = Math.max(0, (deposited1 - withdrawn1 - amount1) * 0.01);
      const unclaimedFeesUsd = unclaimedFees0 * price0 + unclaimedFees1 * price1;

      // Calculate PnL
      const pnl = totalValue + feesEarnedUsd - initialValue;
      const pnlPercent = initialValue > 0 ? (pnl / initialValue) * 100 : 0;

      // HODL value calculation
      const hodlValue = deposited0 * price0 + deposited1 * price1;
      const impermanentLossUsd = hodlValue - totalValue;
      const impermanentLoss = hodlValue > 0 ? (impermanentLossUsd / hodlValue) * 100 : 0;

      const token0Info: TokenInfo = {
        symbol: pool.token0.symbol,
        name: pool.token0.name,
        address: pool.token0.id,
        decimals: decimals0,
        price: price0,
      };

      const token1Info: TokenInfo = {
        symbol: pool.token1.symbol,
        name: pool.token1.name,
        address: pool.token1.id,
        decimals: decimals1,
        price: price1,
      };

      return {
        id: pos.id,
        nftId: pos.id,
        protocol: 'uniswap-v3',
        chain: chain,
        networkType: 'evm',
        token0: token0Info,
        token1: token1Info,
        feeTier: parseInt(pool.feeTier) / 10000,
        liquidity: pos.liquidity,
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
        initialValueUsd: Math.max(initialValue, totalValue),
        currentValueUsd: totalValue,
        pnlUsd: pnl,
        pnlPercent: pnlPercent,
        impermanentLoss: Math.abs(impermanentLoss),
        impermanentLossUsd: Math.abs(impermanentLossUsd),
        hodlValueUsd: hodlValue,
        feeApr: totalValue > 0 ? ((feesEarnedUsd * 365) / totalValue) * 100 : 0,
        rewardsApr: 0,
        totalApr: totalValue > 0 ? ((feesEarnedUsd * 365) / totalValue) * 100 : 0,
        status: inRange ? 'in-range' : 'out-of-range',
        inRangePercent: inRange ? 100 : 0,
        createdAt: new Date(parseInt(pos.transaction.timestamp) * 1000).toISOString(),
        lastUpdated: new Date().toISOString(),
        automation: {
          autoCompound: false,
          autoRange: false,
          autoExit: false,
        },
      };
    });
  } catch (error) {
    console.error('Error fetching positions from ' + chain + ':', error);
    return [];
  }
}

/**
 * Fetch positions from all supported chains
 */
async function fetchAllUniswapV3Positions(address: string): Promise<PoolPosition[]> {
  const chains: EVMChain[] = ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon'];

  const results = await Promise.all(
    chains.map(function(chain) { return fetchPositionsFromSubgraph(chain, address); })
  );

  return results.flat();
}

export interface UseUniswapV3PositionsReturn {
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
 * Hook to fetch Uniswap V3 positions for connected wallet
 */
export function useUniswapV3Positions(): UseUniswapV3PositionsReturn {
  const { address, isConnected } = useAccount();

  const {
    data: positions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['uniswap-v3-positions', address],
    queryFn: () => fetchAllUniswapV3Positions(address!),
    enabled: isConnected && !!address,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  // Calculate totals
  const totalValue = positions.reduce((sum, p) => sum + p.totalValueUsd, 0);
  const totalFees = positions.reduce((sum, p) => sum + p.feesEarned.totalUsd, 0);
  const totalUnclaimedFees = positions.reduce((sum, p) => sum + p.feesUnclaimed.totalUsd, 0);

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

export default useUniswapV3Positions;
