/**
 * Solana LP Math - Concentrated Liquidity Calculations
 *
 * Supports two concentrated liquidity models:
 * 1. CLMM (Orca Whirlpool, Raydium CLMM) - tick-based, similar to Uniswap V3
 * 2. DLMM (Meteora) - bin-based with discrete price bins
 */

// ============================================
// Constants
// ============================================

/** Q64 constant (2^64) for Solana CLMM fixed-point math */
const Q64 = BigInt('18446744073709551616'); // 2^64

/** Meteora bin ID offset (bins centered around 2^23) */
const METEORA_BIN_ID_OFFSET = 8388608; // 2^23

// ============================================
// CLMM Math (Orca Whirlpool & Raydium CLMM)
// ============================================

/**
 * Convert a tick to a price ratio.
 * price = 1.0001^tick
 */
export function tickToSqrtPriceRatio(tick: number): number {
  return Math.pow(1.0001, tick / 2);
}

/**
 * Convert a tick to a human-readable price.
 * Adjusts for token decimal differences.
 */
export function tickToPrice(tick: number, decimalsA: number, decimalsB: number): number {
  const rawPrice = Math.pow(1.0001, tick);
  return rawPrice * Math.pow(10, decimalsA - decimalsB);
}

/**
 * Calculate token amounts from CLMM position data.
 *
 * This uses the standard concentrated liquidity formula (same as Uniswap V3):
 * - If currentTick < tickLower: all token A
 * - If currentTick >= tickLower && currentTick < tickUpper: mix
 * - If currentTick >= tickUpper: all token B
 *
 * @param liquidity - Position liquidity (bigint from on-chain)
 * @param sqrtPriceX64 - Current sqrt price in Q64.64 format
 * @param tickLower - Lower tick boundary
 * @param tickUpper - Upper tick boundary
 * @param currentTick - Current pool tick
 * @param decimalsA - Token A decimals
 * @param decimalsB - Token B decimals
 */
export function calculateCLMMAmounts(
  liquidity: bigint,
  sqrtPriceX64: bigint,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
  decimalsA: number,
  decimalsB: number,
): { amountA: number; amountB: number } {
  const liquidityNum = Number(liquidity);
  const sqrtPriceNum = Number(sqrtPriceX64) / Number(Q64);

  const sqrtRatioA = Math.sqrt(Math.pow(1.0001, tickLower));
  const sqrtRatioB = Math.sqrt(Math.pow(1.0001, tickUpper));

  let amountA = 0;
  let amountB = 0;

  if (currentTick < tickLower) {
    // All token A
    amountA = liquidityNum * (1 / sqrtRatioA - 1 / sqrtRatioB);
  } else if (currentTick < tickUpper) {
    // Mix of both tokens
    amountA = liquidityNum * (1 / sqrtPriceNum - 1 / sqrtRatioB);
    amountB = liquidityNum * (sqrtPriceNum - sqrtRatioA);
  } else {
    // All token B
    amountB = liquidityNum * (sqrtRatioB - sqrtRatioA);
  }

  return {
    amountA: amountA / Math.pow(10, decimalsA),
    amountB: amountB / Math.pow(10, decimalsB),
  };
}

/**
 * Calculate unclaimed fees for a CLMM position.
 *
 * For Orca: fees are stored directly as feeOwedA/feeOwedB
 * For Raydium: tokenFeesOwedA/tokenFeesOwedB
 */
export function calculateCLMMFees(
  feeOwedA: bigint,
  feeOwedB: bigint,
  decimalsA: number,
  decimalsB: number,
  priceA: number,
  priceB: number,
): { feeA: number; feeB: number; totalUsd: number } {
  const feeA = Number(feeOwedA) / Math.pow(10, decimalsA);
  const feeB = Number(feeOwedB) / Math.pow(10, decimalsB);
  const totalUsd = feeA * priceA + feeB * priceB;

  return { feeA, feeB, totalUsd };
}

// ============================================
// DLMM Math (Meteora)
// ============================================

/**
 * Convert a Meteora bin ID to a price.
 *
 * Meteora DLMM uses bins instead of continuous ticks.
 * Each bin has a fixed width determined by binStep.
 *
 * price = (1 + binStep/10000)^(binId - 2^23)
 */
export function binToPrice(
  binId: number,
  binStep: number,
  decimalsX: number,
  decimalsY: number,
): number {
  const exponent = binId - METEORA_BIN_ID_OFFSET;
  const rawPrice = Math.pow(1 + binStep / 10000, exponent);
  return rawPrice * Math.pow(10, decimalsX - decimalsY);
}

/**
 * Calculate token amounts for a Meteora DLMM position.
 *
 * DLMM positions span multiple bins, each with its own liquidity share.
 * - Bins below activeId: contain only token Y (quote)
 * - Active bin: contains both tokens
 * - Bins above activeId: contain only token X (base)
 *
 * Simplified calculation: uses position's share of pool liquidity per bin.
 * For exact calculation, we'd need each bin's reserve amounts.
 *
 * @param lowerBinId - Position lower bin
 * @param upperBinId - Position upper bin
 * @param liquidityShares - Liquidity shares per bin (array from lower to upper)
 * @param activeBinId - Pool's current active bin
 * @param binStep - Bin step size (basis points)
 * @param currentPrice - Current pool price (from API)
 * @param totalValueEstimate - Estimated total value (from reserves or external source)
 * @param decimalsX - Token X decimals
 * @param decimalsY - Token Y decimals
 */
export function calculateDLMMAmounts(
  lowerBinId: number,
  upperBinId: number,
  liquidityShares: bigint[],
  activeBinId: number,
  binStep: number,
  currentPrice: number,
  decimalsX: number,
  decimalsY: number,
  priceX: number,
  priceY: number,
): { amountX: number; amountY: number; totalValueUsd: number } {
  // Calculate total liquidity shares
  let totalShares = BigInt(0);
  for (const share of liquidityShares) {
    totalShares += share;
  }

  if (totalShares === BigInt(0)) {
    return { amountX: 0, amountY: 0, totalValueUsd: 0 };
  }

  // Estimate token distribution based on active bin position
  let amountX = 0;
  let amountY = 0;

  for (let i = 0; i < liquidityShares.length; i++) {
    const binId = lowerBinId + i;
    const shareRatio = Number(liquidityShares[i]) / Number(totalShares);

    if (shareRatio === 0) continue;

    const binPrice = binToPrice(binId, binStep, decimalsX, decimalsY);

    if (binId < activeBinId) {
      // Below active: all token Y
      // Estimate value based on bin price and share
      amountY += shareRatio * (Number(totalShares) / Math.pow(10, decimalsY)) * binPrice;
    } else if (binId === activeBinId) {
      // Active bin: mix of both (simplified 50/50 split)
      const binValue = shareRatio * Number(totalShares);
      amountX += (binValue * 0.5) / Math.pow(10, decimalsX);
      amountY += (binValue * 0.5) / Math.pow(10, decimalsY);
    } else {
      // Above active: all token X
      amountX += shareRatio * (Number(totalShares) / Math.pow(10, decimalsX));
    }
  }

  const totalValueUsd = amountX * priceX + amountY * priceY;

  return { amountX, amountY, totalValueUsd };
}

/**
 * Get price range for a Meteora DLMM position.
 */
export function getDLMMPriceRange(
  lowerBinId: number,
  upperBinId: number,
  binStep: number,
  decimalsX: number,
  decimalsY: number,
): { priceLower: number; priceUpper: number } {
  return {
    priceLower: binToPrice(lowerBinId, binStep, decimalsX, decimalsY),
    priceUpper: binToPrice(upperBinId, binStep, decimalsX, decimalsY),
  };
}

// ============================================
// Shared Calculations
// ============================================

/**
 * Calculate impermanent loss for a concentrated liquidity position.
 *
 * For concentrated liquidity, IL is amplified within the price range:
 * IL_concentrated = IL_full_range * (priceRange_multiplier)
 *
 * Simplified formula:
 * priceRatio = currentPrice / initialPrice
 * IL = 2*sqrt(priceRatio) / (1 + priceRatio) - 1
 */
export function calculateConcentratedIL(
  initialPrice: number,
  currentPrice: number,
): number {
  if (initialPrice <= 0 || currentPrice <= 0) return 0;

  const priceRatio = currentPrice / initialPrice;
  const sqrtRatio = Math.sqrt(priceRatio);
  const il = (2 * sqrtRatio) / (1 + priceRatio) - 1;

  return il * 100; // Return as percentage (negative = loss)
}

/**
 * Determine if a position is in range.
 *
 * For CLMM: currentTick >= tickLower && currentTick < tickUpper
 * For DLMM: currentBinId >= lowerBinId && currentBinId <= upperBinId
 */
export function isPositionInRange(
  currentTickOrBin: number,
  lowerTickOrBin: number,
  upperTickOrBin: number,
): boolean {
  return currentTickOrBin >= lowerTickOrBin && currentTickOrBin < upperTickOrBin;
}

/**
 * Estimate fee APR based on collected fees and position value.
 *
 * APR = (totalFeesUsd / positionValueUsd) * (365 / daysActive) * 100
 */
export function estimateFeeApr(
  totalFeesUsd: number,
  positionValueUsd: number,
  createdAtTimestamp: number,
): number {
  if (positionValueUsd <= 0 || totalFeesUsd <= 0) return 0;

  const now = Date.now();
  const daysActive = Math.max(1, (now - createdAtTimestamp) / (1000 * 60 * 60 * 24));

  return (totalFeesUsd / positionValueUsd) * (365 / daysActive) * 100;
}

/**
 * Calculate PnL for a position.
 */
export function calculatePnL(
  currentValueUsd: number,
  initialValueUsd: number,
  feesEarnedUsd: number,
): { pnlUsd: number; pnlPercent: number } {
  const pnlUsd = currentValueUsd + feesEarnedUsd - initialValueUsd;
  const pnlPercent = initialValueUsd > 0 ? (pnlUsd / initialValueUsd) * 100 : 0;

  return { pnlUsd, pnlPercent };
}
