/**
 * Solana LP Position Types
 *
 * Types for raw responses from Shyft GraphQL, protocol APIs (Orca, Raydium, Meteora),
 * and Jupiter Price API. Used by the solana-lp-service to transform into PoolPosition[].
 */

// ============================================
// Shyft GraphQL Response Types
// ============================================

/** Orca Whirlpool position from Shyft GraphQL */
export interface ShyftOrcaPosition {
  pubkey: string;
  whirlpool: string;
  positionMint: string;
  liquidity: string;
  tickLowerIndex: number;
  tickUpperIndex: number;
  feeGrowthCheckpointA: string;
  feeGrowthCheckpointB: string;
  feeOwedA: string;
  feeOwedB: string;
  rewardInfos?: {
    growthInsideCheckpoint: string;
    amountOwed: string;
  }[];
}

/** Raydium CLMM position from Shyft GraphQL (RAYDIUM_CLMM_PersonalPositionState) */
export interface ShyftRaydiumPosition {
  pubkey: string;
  poolId: string;
  nftMint: string;
  liquidity: string;
  tickLowerIndex: number;
  tickUpperIndex: number;
  feeGrowthInside0LastX64: string;
  feeGrowthInside1LastX64: string;
  tokenFeesOwed0: string;
  tokenFeesOwed1: string;
  rewardInfos?: {
    rewardGrowthInside: string;
    rewardAmountOwed: string;
  }[];
}

/** Meteora DLMM position from Shyft GraphQL */
export interface ShyftMeteoraPosition {
  pubkey: string;
  lbPair: string;
  owner: string;
  lowerBinId: number;
  upperBinId: number;
  liquidityShares: string[];
  lastUpdatedAt: string;
  totalClaimedFeeXAmount: string;
  totalClaimedFeeYAmount: string;
  feeInfos?: {
    feeXPerTokenComplete: string;
    feeYPerTokenComplete: string;
    feeXPending: string;
    feeYPending: string;
  }[];
  rewardInfos?: {
    rewardPerTokenCompletes: string[];
    rewardPendings: string[];
  }[];
}

/** Combined Shyft response */
export interface ShyftPositionsResponse {
  orca: ShyftOrcaPosition[];
  raydium: ShyftRaydiumPosition[];
  meteora: ShyftMeteoraPosition[];
}

// ============================================
// Protocol Pool State Types
// ============================================

/** Orca Whirlpool pool state (from Orca API) */
export interface OrcaPoolState {
  address: string;
  tokenMintA: string;
  tokenMintB: string;
  tokenDecimalsA: number;
  tokenDecimalsB: number;
  tickCurrentIndex: number;
  sqrtPrice: string;
  liquidity: string;
  feeRate: number;
  protocolFeeRate: number;
  tickSpacing: number;
  tokenVaultA: string;
  tokenVaultB: string;
  price: number;
  tokenSymbolA?: string;
  tokenSymbolB?: string;
  tokenNameA?: string;
  tokenNameB?: string;
  tokenLogoA?: string;
  tokenLogoB?: string;
  tvl?: number;
  volume24h?: number;
  fees24h?: number;
}

/** Raydium CLMM pool state (from Raydium API v3) */
export interface RaydiumPoolState {
  id: string;
  mintA: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
  };
  mintB: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
  };
  price: number;
  currentTick: number;
  sqrtPriceX64: string;
  liquidity: string;
  feeRate: number;
  tickSpacing: number;
  tvl: number;
  day?: {
    volume: number;
    volumeFee: number;
    feeApr: number;
    rewardApr: { A: number; B: number; C: number };
  };
}

/** Meteora DLMM pool state (from Meteora API) */
export interface MeteoraPoolState {
  address: string;
  name: string;
  mintX: string;
  mintY: string;
  reserveX: string;
  reserveY: string;
  reserveXAmount: number;
  reserveYAmount: number;
  binStep: number;
  baseFeePercentage: string;
  maxFeePercentage: string;
  protocolFeePercentage: string;
  liquidity: string;
  currentPrice: number;
  activeId: number;
  apr: number;
  apy: number;
  farmApr: number;
  farmApy: number;
  tokenXDecimal: number;
  tokenYDecimal: number;
  tokenXSymbol?: string;
  tokenYSymbol?: string;
  tokenXName?: string;
  tokenYName?: string;
  tokenXLogo?: string;
  tokenYLogo?: string;
}

// ============================================
// Jupiter Price API Types
// ============================================

export interface JupiterPriceData {
  id: string;
  type: string;
  price: string;
}

export interface JupiterPriceResponse {
  data: Record<string, JupiterPriceData>;
  timeTaken: number;
}

// ============================================
// Solana LP API Route Response Types
// ============================================

/** Token metadata resolved from Jupiter/Helius */
export interface SolanaTokenMeta {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  priceUsd: number;
}

/** Pool state (unified across protocols) */
export interface UnifiedPoolState {
  address: string;
  protocol: 'orca-whirlpool' | 'raydium-clmm' | 'meteora-dlmm';
  tokenA: SolanaTokenMeta;
  tokenB: SolanaTokenMeta;
  currentTick: number; // For CLMM; activeId for Meteora
  sqrtPrice: string; // Q64.64 for CLMM; not applicable for Meteora
  liquidity: string;
  feeRate: number; // In percentage (e.g., 0.3 = 0.3%)
  tickSpacing: number; // For CLMM; binStep for Meteora
  currentPrice: number;
  tvl?: number;
  volume24h?: number;
  fees24h?: number;
  feeApr?: number;
  rewardApr?: number;
}

/** Full API response from /api/defi/solana-lp/positions */
export interface SolanaLPApiResponse {
  positions: {
    orca: ShyftOrcaPosition[];
    raydium: ShyftRaydiumPosition[];
    meteora: ShyftMeteoraPosition[];
  };
  poolStates: Record<string, UnifiedPoolState>;
  prices: Record<string, number>; // mint -> USD price
  tokenMeta: Record<string, SolanaTokenMeta>; // mint -> metadata
}
