import { NextRequest, NextResponse } from 'next/server';
import type {
  ShyftOrcaPosition,
  ShyftRaydiumPosition,
  ShyftMeteoraPosition,
  OrcaPoolState,
  RaydiumPoolState,
  MeteoraPoolState,
  UnifiedPoolState,
  SolanaTokenMeta,
  SolanaLPApiResponse,
} from '@/lib/solana/solana-lp-types';

// ============================================
// Configuration
// ============================================

const SHYFT_API_KEY = process.env.SHYFT_API_KEY || '';
const SHYFT_GRAPHQL_URL = 'https://programs.shyft.to/v0/graphql/';
const JUPITER_PRICE_URL = 'https://api.jup.ag/price/v2';

// Protocol API endpoints
const ORCA_API = 'https://api.mainnet.orca.so/v1/whirlpool';
const RAYDIUM_API = 'https://api-v3.raydium.io';
const METEORA_API = 'https://dlmm-api.meteora.ag';

// ============================================
// Shyft GraphQL Queries
// ============================================

const SHYFT_QUERY = `
  query GetSolanaLPPositions($wallet: String!) {
    orca: orca_whirlpools_Position(
      where: { owner: { _eq: $wallet } }
    ) {
      _lamports
      pubkey
      whirlpool
      positionMint
      liquidity
      tickLowerIndex
      tickUpperIndex
      feeGrowthCheckpointA
      feeGrowthCheckpointB
      feeOwedA
      feeOwedB
    }

    meteora: meteora_dlmm_Position(
      where: { owner: { _eq: $wallet } }
    ) {
      _lamports
      pubkey
      lbPair
      owner
      lowerBinId
      upperBinId
      liquidityShares
      lastUpdatedAt
      totalClaimedFeeXAmount
      totalClaimedFeeYAmount
      feeInfos
      rewardInfos
    }
  }
`;

// Raydium uses a separate query since positions are NFT-based
const RAYDIUM_POSITION_QUERY = `
  query GetRaydiumPositions($wallet: String!) {
    raydium_concentrated_liquidity_PersonalPositionState(
      where: { _lamports: { _gt: 0 } }
    ) {
      pubkey
      poolId
      nftMint
      liquidity
      tickLowerIndex
      tickUpperIndex
      feeGrowthInsideLastX64A
      feeGrowthInsideLastX64B
      tokenFeesOwedA
      tokenFeesOwedB
      rewardInfos
    }
  }
`;

// ============================================
// Data Fetching Functions
// ============================================

/**
 * Fetch positions from Shyft GraphQL (Orca + Meteora)
 */
async function fetchShyftPositions(
  wallet: string,
): Promise<{
  orca: ShyftOrcaPosition[];
  meteora: ShyftMeteoraPosition[];
}> {
  if (!SHYFT_API_KEY) {
    console.warn('[Solana LP] No SHYFT_API_KEY configured, skipping Shyft query');
    return { orca: [], meteora: [] };
  }

  try {
    const response = await fetch(
      `${SHYFT_GRAPHQL_URL}?api_key=${SHYFT_API_KEY}&network=mainnet-beta`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: SHYFT_QUERY,
          variables: { wallet },
        }),
        next: { revalidate: 30 },
      },
    );

    if (!response.ok) {
      console.error('[Solana LP] Shyft API error:', response.status);
      return { orca: [], meteora: [] };
    }

    const data = await response.json();

    if (data.errors) {
      console.error('[Solana LP] Shyft GraphQL errors:', data.errors);
      return { orca: [], meteora: [] };
    }

    return {
      orca: data.data?.orca || [],
      meteora: data.data?.meteora || [],
    };
  } catch (error) {
    console.error('[Solana LP] Failed to fetch from Shyft:', error);
    return { orca: [], meteora: [] };
  }
}

/**
 * Fetch Raydium CLMM positions
 * Raydium uses NFT-based ownership, so we need a different approach.
 * Use Helius DAS API to find position NFTs, then query Raydium API.
 */
async function fetchRaydiumPositions(
  wallet: string,
): Promise<ShyftRaydiumPosition[]> {
  // Approach: Use Raydium API v3 if available, or Shyft
  if (!SHYFT_API_KEY) return [];

  try {
    const response = await fetch(
      `${SHYFT_GRAPHQL_URL}?api_key=${SHYFT_API_KEY}&network=mainnet-beta`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: RAYDIUM_POSITION_QUERY,
          variables: { wallet },
        }),
        next: { revalidate: 30 },
      },
    );

    if (!response.ok) return [];

    const data = await response.json();
    if (data.errors) return [];

    // The Raydium query returns all positions; we need to filter by NFT ownership.
    // For now, return all positions and let the client filter.
    // In production, we'd cross-reference with Helius getAssetsByOwner.
    const allPositions =
      data.data?.raydium_concentrated_liquidity_PersonalPositionState || [];

    // TODO: Filter positions by wallet NFT ownership via Helius
    // For now, if the query supports wallet filtering, use that
    return allPositions.filter(
      (p: ShyftRaydiumPosition) => p.liquidity && BigInt(p.liquidity) > BigInt(0),
    );
  } catch (error) {
    console.error('[Solana LP] Failed to fetch Raydium positions:', error);
    return [];
  }
}

/**
 * Fetch pool state from Orca API
 */
async function fetchOrcaPoolState(poolAddress: string): Promise<OrcaPoolState | null> {
  try {
    const response = await fetch(`${ORCA_API}/${poolAddress}`, {
      next: { revalidate: 30 },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    console.error(`[Solana LP] Failed to fetch Orca pool ${poolAddress}`);
    return null;
  }
}

/**
 * Fetch pool state from Raydium API v3
 */
async function fetchRaydiumPoolState(poolId: string): Promise<RaydiumPoolState | null> {
  try {
    const response = await fetch(
      `${RAYDIUM_API}/pools/info/ids?ids=${poolId}`,
      { next: { revalidate: 30 } },
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.data?.[0] || null;
  } catch {
    console.error(`[Solana LP] Failed to fetch Raydium pool ${poolId}`);
    return null;
  }
}

/**
 * Fetch pool state from Meteora DLMM API
 */
async function fetchMeteoraPoolState(pairAddress: string): Promise<MeteoraPoolState | null> {
  try {
    const response = await fetch(`${METEORA_API}/pair/${pairAddress}`, {
      next: { revalidate: 30 },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    console.error(`[Solana LP] Failed to fetch Meteora pool ${pairAddress}`);
    return null;
  }
}

/**
 * Fetch token prices from Jupiter Price API v2
 */
async function fetchJupiterPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};

  try {
    const uniqueMints = Array.from(new Set(mints));
    const ids = uniqueMints.join(',');
    const response = await fetch(`${JUPITER_PRICE_URL}?ids=${ids}`, {
      next: { revalidate: 30 },
    });

    if (!response.ok) return {};

    const data = await response.json();
    const prices: Record<string, number> = {};

    for (const [mint, info] of Object.entries(data.data || {})) {
      const priceData = info as { price: string };
      prices[mint] = parseFloat(priceData.price) || 0;
    }

    return prices;
  } catch {
    console.error('[Solana LP] Failed to fetch Jupiter prices');
    return {};
  }
}

/**
 * Unify pool state from different protocol formats
 */
function unifyOrcaPoolState(pool: OrcaPoolState): UnifiedPoolState {
  return {
    address: pool.address,
    protocol: 'orca-whirlpool',
    tokenA: {
      mint: pool.tokenMintA,
      symbol: pool.tokenSymbolA || 'TOKEN_A',
      name: pool.tokenNameA || 'Token A',
      decimals: pool.tokenDecimalsA || 9,
      logoUrl: pool.tokenLogoA,
      priceUsd: 0, // Filled from Jupiter
    },
    tokenB: {
      mint: pool.tokenMintB,
      symbol: pool.tokenSymbolB || 'TOKEN_B',
      name: pool.tokenNameB || 'Token B',
      decimals: pool.tokenDecimalsB || 6,
      logoUrl: pool.tokenLogoB,
      priceUsd: 0,
    },
    currentTick: pool.tickCurrentIndex,
    sqrtPrice: pool.sqrtPrice,
    liquidity: pool.liquidity,
    feeRate: pool.feeRate / 10000, // Convert from bps to percentage
    tickSpacing: pool.tickSpacing,
    currentPrice: pool.price,
    tvl: pool.tvl,
    volume24h: pool.volume24h,
    fees24h: pool.fees24h,
  };
}

function unifyRaydiumPoolState(pool: RaydiumPoolState): UnifiedPoolState {
  return {
    address: pool.id,
    protocol: 'raydium-clmm',
    tokenA: {
      mint: pool.mintA.address,
      symbol: pool.mintA.symbol,
      name: pool.mintA.name,
      decimals: pool.mintA.decimals,
      logoUrl: pool.mintA.logoURI,
      priceUsd: 0,
    },
    tokenB: {
      mint: pool.mintB.address,
      symbol: pool.mintB.symbol,
      name: pool.mintB.name,
      decimals: pool.mintB.decimals,
      logoUrl: pool.mintB.logoURI,
      priceUsd: 0,
    },
    currentTick: pool.currentTick,
    sqrtPrice: pool.sqrtPriceX64,
    liquidity: pool.liquidity,
    feeRate: pool.feeRate / 1000000, // Raydium stores as raw number
    tickSpacing: pool.tickSpacing,
    currentPrice: pool.price,
    tvl: pool.tvl,
    volume24h: pool.day?.volume,
    fees24h: pool.day?.volumeFee,
    feeApr: pool.day?.feeApr,
    rewardApr: pool.day
      ? pool.day.rewardApr.A + pool.day.rewardApr.B + pool.day.rewardApr.C
      : undefined,
  };
}

function unifyMeteoraPoolState(pool: MeteoraPoolState): UnifiedPoolState {
  return {
    address: pool.address,
    protocol: 'meteora-dlmm',
    tokenA: {
      mint: pool.mintX,
      symbol: pool.tokenXSymbol || 'TOKEN_X',
      name: pool.tokenXName || 'Token X',
      decimals: pool.tokenXDecimal || 9,
      logoUrl: pool.tokenXLogo,
      priceUsd: 0,
    },
    tokenB: {
      mint: pool.mintY,
      symbol: pool.tokenYSymbol || 'TOKEN_Y',
      name: pool.tokenYName || 'Token Y',
      decimals: pool.tokenYDecimal || 6,
      logoUrl: pool.tokenYLogo,
      priceUsd: 0,
    },
    currentTick: pool.activeId,
    sqrtPrice: '0', // Not applicable for DLMM
    liquidity: pool.liquidity,
    feeRate: parseFloat(pool.baseFeePercentage) || 0,
    tickSpacing: pool.binStep,
    currentPrice: pool.currentPrice,
    feeApr: pool.apr,
    rewardApr: pool.farmApr,
  };
}

// ============================================
// Main Route Handler
// ============================================

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json(
      { error: 'Missing wallet parameter' },
      { status: 400 },
    );
  }

  try {
    // Step 1: Fetch positions from all protocols in parallel
    const [shyftData, raydiumPositions] = await Promise.all([
      fetchShyftPositions(wallet),
      fetchRaydiumPositions(wallet),
    ]);

    const orcaPositions = shyftData.orca;
    const meteoraPositions = shyftData.meteora;

    // Step 2: Collect unique pool addresses
    const orcaPools = Array.from(new Set(orcaPositions.map((p) => p.whirlpool)));
    const raydiumPools = Array.from(new Set(raydiumPositions.map((p) => p.poolId)));
    const meteoraPools = Array.from(new Set(meteoraPositions.map((p) => p.lbPair)));

    // Step 3: Fetch pool states in parallel
    const [orcaPoolStates, raydiumPoolStates, meteoraPoolStates] = await Promise.all([
      Promise.all(orcaPools.map(fetchOrcaPoolState)),
      Promise.all(raydiumPools.map(fetchRaydiumPoolState)),
      Promise.all(meteoraPools.map(fetchMeteoraPoolState)),
    ]);

    // Step 4: Build unified pool states map
    const poolStates: Record<string, UnifiedPoolState> = {};
    const tokenMints: string[] = [];

    for (const pool of orcaPoolStates) {
      if (!pool) continue;
      const unified = unifyOrcaPoolState(pool);
      poolStates[pool.address] = unified;
      tokenMints.push(unified.tokenA.mint, unified.tokenB.mint);
    }

    for (const pool of raydiumPoolStates) {
      if (!pool) continue;
      const unified = unifyRaydiumPoolState(pool);
      poolStates[pool.id] = unified;
      tokenMints.push(unified.tokenA.mint, unified.tokenB.mint);
    }

    for (const pool of meteoraPoolStates) {
      if (!pool) continue;
      const unified = unifyMeteoraPoolState(pool);
      poolStates[pool.address] = unified;
      tokenMints.push(unified.tokenA.mint, unified.tokenB.mint);
    }

    // Step 5: Fetch token prices from Jupiter
    const prices = await fetchJupiterPrices(tokenMints);

    // Update pool states with prices
    for (const poolState of Object.values(poolStates)) {
      poolState.tokenA.priceUsd = prices[poolState.tokenA.mint] || 0;
      poolState.tokenB.priceUsd = prices[poolState.tokenB.mint] || 0;
    }

    // Build token metadata
    const tokenMeta: Record<string, SolanaTokenMeta> = {};
    for (const poolState of Object.values(poolStates)) {
      tokenMeta[poolState.tokenA.mint] = poolState.tokenA;
      tokenMeta[poolState.tokenB.mint] = poolState.tokenB;
    }

    // Step 6: Return combined response
    const response: SolanaLPApiResponse = {
      positions: {
        orca: orcaPositions,
        raydium: raydiumPositions,
        meteora: meteoraPositions,
      },
      poolStates,
      prices,
      tokenMeta,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Solana LP] Route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Solana LP positions' },
      { status: 502 },
    );
  }
}
