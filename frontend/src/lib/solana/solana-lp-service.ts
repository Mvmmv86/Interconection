/**
 * Solana LP Service
 *
 * Client-side service that fetches LP position data from our API route
 * and transforms it into the PoolPosition[] format expected by usePoolPositions.
 */

import type { PoolPosition } from '@/components/defi/pools/types';
import type {
  ShyftOrcaPosition,
  ShyftRaydiumPosition,
  ShyftMeteoraPosition,
  UnifiedPoolState,
  SolanaLPApiResponse,
} from './solana-lp-types';
import {
  calculateCLMMAmounts,
  calculateCLMMFees,
  tickToPrice,
  getDLMMPriceRange,
  isPositionInRange,
  calculateConcentratedIL,
  estimateFeeApr,
  calculatePnL,
} from './solana-lp-math';

// ============================================
// Main Fetch Function
// ============================================

/**
 * Fetch all Solana LP positions for a wallet address.
 * Calls our API route which aggregates Shyft + Protocol APIs + Jupiter.
 */
export async function fetchSolanaLPPositions(
  walletAddress: string,
): Promise<PoolPosition[]> {
  const response = await fetch(
    `/api/defi/solana-lp/positions?wallet=${walletAddress}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Solana LP positions: ${response.status}`);
  }

  const data: SolanaLPApiResponse = await response.json();

  const positions: PoolPosition[] = [];

  // Transform Orca Whirlpool positions
  for (const pos of data.positions.orca) {
    const poolState = data.poolStates[pos.whirlpool];
    if (!poolState) continue;

    const transformed = transformOrcaPosition(pos, poolState, data.prices);
    if (transformed) positions.push(transformed);
  }

  // Transform Raydium CLMM positions
  for (const pos of data.positions.raydium) {
    const poolState = data.poolStates[pos.poolId];
    if (!poolState) continue;

    const transformed = transformRaydiumPosition(pos, poolState, data.prices);
    if (transformed) positions.push(transformed);
  }

  // Transform Meteora DLMM positions
  for (const pos of data.positions.meteora) {
    const poolState = data.poolStates[pos.lbPair];
    if (!poolState) continue;

    const transformed = transformMeteoraPosition(pos, poolState, data.prices);
    if (transformed) positions.push(transformed);
  }

  // Sort by total value descending
  positions.sort((a, b) => b.totalValueUsd - a.totalValueUsd);

  return positions;
}

// ============================================
// Transform Functions
// ============================================

/**
 * Transform an Orca Whirlpool position to PoolPosition format
 */
function transformOrcaPosition(
  pos: ShyftOrcaPosition,
  pool: UnifiedPoolState,
  prices: Record<string, number>,
): PoolPosition | null {
  try {
    const liquidity = BigInt(pos.liquidity);
    if (liquidity === BigInt(0)) return null;

    const sqrtPriceX64 = BigInt(pool.sqrtPrice);
    const decimalsA = pool.tokenA.decimals;
    const decimalsB = pool.tokenB.decimals;
    const priceA = prices[pool.tokenA.mint] || pool.tokenA.priceUsd || 0;
    const priceB = prices[pool.tokenB.mint] || pool.tokenB.priceUsd || 0;

    // Calculate token amounts
    const { amountA, amountB } = calculateCLMMAmounts(
      liquidity,
      sqrtPriceX64,
      pos.tickLowerIndex,
      pos.tickUpperIndex,
      pool.currentTick,
      decimalsA,
      decimalsB,
    );

    const valueA = amountA * priceA;
    const valueB = amountB * priceB;
    const totalValueUsd = valueA + valueB;

    // Calculate unclaimed fees
    const fees = calculateCLMMFees(
      BigInt(pos.feeOwedA || '0'),
      BigInt(pos.feeOwedB || '0'),
      decimalsA,
      decimalsB,
      priceA,
      priceB,
    );

    // Price range
    const priceLower = tickToPrice(pos.tickLowerIndex, decimalsA, decimalsB);
    const priceUpper = tickToPrice(pos.tickUpperIndex, decimalsA, decimalsB);

    // Status
    const inRange = isPositionInRange(pool.currentTick, pos.tickLowerIndex, pos.tickUpperIndex);

    // IL estimation (simplified: assume initial price was current price at entry)
    const il = calculateConcentratedIL(pool.currentPrice, pool.currentPrice);

    // Fee APR from pool data or estimate
    const feeApr = pool.feeApr || estimateFeeApr(fees.totalUsd, totalValueUsd, Date.now() - 30 * 86400000);

    // PnL (we don't have initial value from Shyft, estimate as current value)
    const initialValueUsd = totalValueUsd; // Will be improved with historical data
    const { pnlUsd, pnlPercent } = calculatePnL(totalValueUsd, initialValueUsd, fees.totalUsd);

    return {
      id: `orca-${pos.pubkey || pos.positionMint}`,
      nftId: pos.positionMint,
      protocol: 'orca-whirlpool',
      chain: 'solana',
      networkType: 'solana',
      token0: {
        symbol: pool.tokenA.symbol,
        name: pool.tokenA.name,
        address: pool.tokenA.mint,
        decimals: decimalsA,
        logo: pool.tokenA.logoUrl,
        price: priceA,
      },
      token1: {
        symbol: pool.tokenB.symbol,
        name: pool.tokenB.name,
        address: pool.tokenB.mint,
        decimals: decimalsB,
        logo: pool.tokenB.logoUrl,
        price: priceB,
      },
      feeTier: pool.feeRate,
      liquidity: pos.liquidity,
      tickLower: pos.tickLowerIndex,
      tickUpper: pos.tickUpperIndex,
      currentTick: pool.currentTick,
      priceLower,
      priceUpper,
      currentPrice: pool.currentPrice,
      token0Amount: amountA,
      token1Amount: amountB,
      totalValueUsd,
      feesEarned: {
        token0: 0, // Historical fees not available from Shyft
        token1: 0,
        totalUsd: 0,
      },
      feesUnclaimed: {
        token0: fees.feeA,
        token1: fees.feeB,
        totalUsd: fees.totalUsd,
      },
      initialValueUsd,
      currentValueUsd: totalValueUsd,
      pnlUsd,
      pnlPercent,
      impermanentLoss: Math.abs(il),
      impermanentLossUsd: Math.abs(il / 100) * totalValueUsd,
      hodlValueUsd: totalValueUsd + Math.abs(il / 100) * totalValueUsd,
      feeApr,
      rewardsApr: pool.rewardApr || 0,
      totalApr: feeApr + (pool.rewardApr || 0),
      status: inRange ? 'in-range' : 'out-of-range',
      inRangePercent: inRange ? 95 : 0, // Estimate
      createdAt: new Date().toISOString(), // Not available from Shyft
      lastUpdated: new Date().toISOString(),
      automation: {
        autoCompound: false,
        autoRange: false,
        autoExit: false,
      },
    };
  } catch (error) {
    console.error('[Solana LP] Failed to transform Orca position:', error);
    return null;
  }
}

/**
 * Transform a Raydium CLMM position to PoolPosition format
 */
function transformRaydiumPosition(
  pos: ShyftRaydiumPosition,
  pool: UnifiedPoolState,
  prices: Record<string, number>,
): PoolPosition | null {
  try {
    const liquidity = BigInt(pos.liquidity);
    if (liquidity === BigInt(0)) return null;

    const sqrtPriceX64 = BigInt(pool.sqrtPrice);
    const decimalsA = pool.tokenA.decimals;
    const decimalsB = pool.tokenB.decimals;
    const priceA = prices[pool.tokenA.mint] || pool.tokenA.priceUsd || 0;
    const priceB = prices[pool.tokenB.mint] || pool.tokenB.priceUsd || 0;

    // Same CLMM math as Orca
    const { amountA, amountB } = calculateCLMMAmounts(
      liquidity,
      sqrtPriceX64,
      pos.tickLowerIndex,
      pos.tickUpperIndex,
      pool.currentTick,
      decimalsA,
      decimalsB,
    );

    const totalValueUsd = amountA * priceA + amountB * priceB;

    // Fees
    const fees = calculateCLMMFees(
      BigInt(pos.tokenFeesOwedA || '0'),
      BigInt(pos.tokenFeesOwedB || '0'),
      decimalsA,
      decimalsB,
      priceA,
      priceB,
    );

    // Price range
    const priceLower = tickToPrice(pos.tickLowerIndex, decimalsA, decimalsB);
    const priceUpper = tickToPrice(pos.tickUpperIndex, decimalsA, decimalsB);

    // Status
    const inRange = isPositionInRange(pool.currentTick, pos.tickLowerIndex, pos.tickUpperIndex);

    const feeApr = pool.feeApr || 0;
    const rewardsApr = pool.rewardApr || 0;
    const initialValueUsd = totalValueUsd;

    return {
      id: `raydium-${pos.pubkey || pos.nftMint}`,
      nftId: pos.nftMint,
      protocol: 'raydium-clmm',
      chain: 'solana',
      networkType: 'solana',
      token0: {
        symbol: pool.tokenA.symbol,
        name: pool.tokenA.name,
        address: pool.tokenA.mint,
        decimals: decimalsA,
        logo: pool.tokenA.logoUrl,
        price: priceA,
      },
      token1: {
        symbol: pool.tokenB.symbol,
        name: pool.tokenB.name,
        address: pool.tokenB.mint,
        decimals: decimalsB,
        logo: pool.tokenB.logoUrl,
        price: priceB,
      },
      feeTier: pool.feeRate,
      liquidity: pos.liquidity,
      tickLower: pos.tickLowerIndex,
      tickUpper: pos.tickUpperIndex,
      currentTick: pool.currentTick,
      priceLower,
      priceUpper,
      currentPrice: pool.currentPrice,
      token0Amount: amountA,
      token1Amount: amountB,
      totalValueUsd,
      feesEarned: {
        token0: 0,
        token1: 0,
        totalUsd: 0,
      },
      feesUnclaimed: {
        token0: fees.feeA,
        token1: fees.feeB,
        totalUsd: fees.totalUsd,
      },
      initialValueUsd,
      currentValueUsd: totalValueUsd,
      pnlUsd: fees.totalUsd,
      pnlPercent: initialValueUsd > 0 ? (fees.totalUsd / initialValueUsd) * 100 : 0,
      impermanentLoss: 0,
      impermanentLossUsd: 0,
      hodlValueUsd: totalValueUsd,
      feeApr,
      rewardsApr,
      totalApr: feeApr + rewardsApr,
      status: inRange ? 'in-range' : 'out-of-range',
      inRangePercent: inRange ? 95 : 0,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      automation: {
        autoCompound: false,
        autoRange: false,
        autoExit: false,
      },
      // Add reward info if available from Raydium
      rewards: pos.rewardInfos
        ?.filter((r) => r.rewardAmountOwed && BigInt(r.rewardAmountOwed) > BigInt(0))
        .map((r, idx) => ({
          token: {
            symbol: `REWARD_${idx}`,
            name: `Reward ${idx}`,
            address: '',
            decimals: 9,
            price: 0,
          },
          amount: Number(BigInt(r.rewardAmountOwed)) / 1e9,
          valueUsd: 0,
          apr: 0,
        })),
    };
  } catch (error) {
    console.error('[Solana LP] Failed to transform Raydium position:', error);
    return null;
  }
}

/**
 * Transform a Meteora DLMM position to PoolPosition format
 */
function transformMeteoraPosition(
  pos: ShyftMeteoraPosition,
  pool: UnifiedPoolState,
  prices: Record<string, number>,
): PoolPosition | null {
  try {
    const decimalsX = pool.tokenA.decimals;
    const decimalsY = pool.tokenB.decimals;
    const priceX = prices[pool.tokenA.mint] || pool.tokenA.priceUsd || 0;
    const priceY = prices[pool.tokenB.mint] || pool.tokenB.priceUsd || 0;

    // Parse liquidity shares
    const liquidityShares = (pos.liquidityShares || []).map((s) => {
      try {
        return BigInt(s);
      } catch {
        return BigInt(0);
      }
    });

    const totalShares = liquidityShares.reduce((sum, s) => sum + s, BigInt(0));
    if (totalShares === BigInt(0)) return null;

    // Get price range
    const { priceLower, priceUpper } = getDLMMPriceRange(
      pos.lowerBinId,
      pos.upperBinId,
      pool.tickSpacing, // binStep for Meteora
      decimalsX,
      decimalsY,
    );

    // Estimate token amounts based on active bin position
    // Simplified: use pool's total value proportion
    const inRange = isPositionInRange(pool.currentTick, pos.lowerBinId, pos.upperBinId);
    const binCount = pos.upperBinId - pos.lowerBinId + 1;
    const activeBinIdx = pool.currentTick - pos.lowerBinId;

    let amountX = 0;
    let amountY = 0;

    if (inRange && binCount > 0) {
      // Position is in range: distribute tokens based on active bin position
      const ratioAbove = Math.max(0, Math.min(1, activeBinIdx / binCount));
      const estimatedValue = Number(totalShares) / 1e9; // Rough estimate

      amountX = estimatedValue * (1 - ratioAbove) / Math.max(priceX, 0.000001);
      amountY = estimatedValue * ratioAbove / Math.max(priceY, 0.000001);
    } else if (pool.currentTick < pos.lowerBinId) {
      // Below range: all token X
      amountX = Number(totalShares) / Math.pow(10, decimalsX);
    } else {
      // Above range: all token Y
      amountY = Number(totalShares) / Math.pow(10, decimalsY);
    }

    const totalValueUsd = amountX * priceX + amountY * priceY;

    // Unclaimed fees from feeInfos
    let unclaimedFeeX = 0;
    let unclaimedFeeY = 0;
    if (pos.feeInfos) {
      for (const feeInfo of pos.feeInfos) {
        unclaimedFeeX += Number(BigInt(feeInfo.feeXPending || '0')) / Math.pow(10, decimalsX);
        unclaimedFeeY += Number(BigInt(feeInfo.feeYPending || '0')) / Math.pow(10, decimalsY);
      }
    }
    const unclaimedFeesUsd = unclaimedFeeX * priceX + unclaimedFeeY * priceY;

    // Claimed fees
    const claimedFeeX = Number(BigInt(pos.totalClaimedFeeXAmount || '0')) / Math.pow(10, decimalsX);
    const claimedFeeY = Number(BigInt(pos.totalClaimedFeeYAmount || '0')) / Math.pow(10, decimalsY);
    const claimedFeesUsd = claimedFeeX * priceX + claimedFeeY * priceY;

    const feeApr = pool.feeApr || 0;
    const rewardsApr = pool.rewardApr || 0;

    return {
      id: `meteora-${pos.pubkey}`,
      protocol: 'meteora-dlmm',
      chain: 'solana',
      networkType: 'solana',
      token0: {
        symbol: pool.tokenA.symbol,
        name: pool.tokenA.name,
        address: pool.tokenA.mint,
        decimals: decimalsX,
        logo: pool.tokenA.logoUrl,
        price: priceX,
      },
      token1: {
        symbol: pool.tokenB.symbol,
        name: pool.tokenB.name,
        address: pool.tokenB.mint,
        decimals: decimalsY,
        logo: pool.tokenB.logoUrl,
        price: priceY,
      },
      feeTier: pool.feeRate,
      liquidity: totalShares.toString(),
      tickLower: pos.lowerBinId,
      tickUpper: pos.upperBinId,
      currentTick: pool.currentTick,
      priceLower,
      priceUpper,
      currentPrice: pool.currentPrice,
      token0Amount: amountX,
      token1Amount: amountY,
      totalValueUsd,
      feesEarned: {
        token0: claimedFeeX,
        token1: claimedFeeY,
        totalUsd: claimedFeesUsd,
      },
      feesUnclaimed: {
        token0: unclaimedFeeX,
        token1: unclaimedFeeY,
        totalUsd: unclaimedFeesUsd,
      },
      initialValueUsd: totalValueUsd,
      currentValueUsd: totalValueUsd,
      pnlUsd: claimedFeesUsd + unclaimedFeesUsd,
      pnlPercent: totalValueUsd > 0 ? ((claimedFeesUsd + unclaimedFeesUsd) / totalValueUsd) * 100 : 0,
      impermanentLoss: 0,
      impermanentLossUsd: 0,
      hodlValueUsd: totalValueUsd,
      feeApr,
      rewardsApr,
      totalApr: feeApr + rewardsApr,
      status: inRange ? 'in-range' : 'out-of-range',
      inRangePercent: inRange ? 90 : 0,
      createdAt: pos.lastUpdatedAt
        ? new Date(parseInt(pos.lastUpdatedAt) * 1000).toISOString()
        : new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      automation: {
        autoCompound: false,
        autoRange: false,
        autoExit: false,
      },
    };
  } catch (error) {
    console.error('[Solana LP] Failed to transform Meteora position:', error);
    return null;
  }
}
