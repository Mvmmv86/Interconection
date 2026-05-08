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

// Helius for NFT discovery (Orca + Raydium positions are NFT-based — no `owner`
// field on Shyft, so we list NFTs from the wallet via DAS, then look up the
// position records by `positionMint`/`nftMint`).
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';

// Protocol API endpoints
const ORCA_API = 'https://api.mainnet.orca.so/v1/whirlpool';
const RAYDIUM_API = 'https://api-v3.raydium.io';
const METEORA_API = 'https://dlmm-api.meteora.ag';

// ============================================
// Shyft GraphQL Queries
// ============================================
//
// Schema notes (verified via introspection on 2026-05-08):
// - Orca:    ORCA_WHIRLPOOLS_position (no `owner` — positions are NFTs).
// - Raydium: RAYDIUM_CLMM_PersonalPositionState (no `owner` — NFT-based;
//            field names use `0`/`1` suffix instead of legacy `A`/`B`).
// - Meteora: meteora_dlmm_Position (V1) and meteora_dlmm_PositionV2 (V2),
//            both have `owner` and identical shape for our purposes.
//
// We split into two queries so a failure in one path (e.g., Shyft DB hiccup
// on a malformed mint from Helius) doesn't take down the other.

const SHYFT_NFT_QUERY = `
  query GetNFTBasedPositions($mints: [String!]!) {
    orca: ORCA_WHIRLPOOLS_position(
      where: { positionMint: { _in: $mints } }
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

    raydium: RAYDIUM_CLMM_PersonalPositionState(
      where: { nftMint: { _in: $mints } }
    ) {
      _lamports
      pubkey
      poolId
      nftMint
      liquidity
      tickLowerIndex
      tickUpperIndex
      feeGrowthInside0LastX64
      feeGrowthInside1LastX64
      tokenFeesOwed0
      tokenFeesOwed1
    }
  }
`;

const SHYFT_METEORA_QUERY = `
  query GetMeteoraPositions($wallet: String!) {
    meteoraV1: meteora_dlmm_Position(
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
    }

    meteoraV2: meteora_dlmm_PositionV2(
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
    }
  }
`;

// ============================================
// Data Fetching Functions
// ============================================

// Solana mint addresses are base58 32-44 chars, but compressed-NFT asset IDs
// from Helius DAS share the same format yet do NOT exist as on-chain accounts
// — passing them to Shyft causes "database query error".
const BASE58_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * List NFT mints owned by the wallet via Helius DAS getAssetsByOwner.
 *
 * Filters out:
 *   - compressed NFTs (their `id` is a Merkle-tree leaf hash, not a real
 *     SPL mint — Shyft can't resolve it and errors the whole query).
 *   - obviously invalid IDs (defense-in-depth against schema changes).
 *
 * Used to look up Orca/Raydium positions whose ownership is NFT-based.
 */
async function fetchWalletNFTMints(wallet: string): Promise<string[]> {
  if (!HELIUS_API_KEY) {
    console.warn('[Solana LP] No HELIUS key — Orca/Raydium positions will not be discovered');
    return [];
  }

  try {
    const response = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'lp-discovery',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: wallet,
            page: 1,
            limit: 1000,
            displayOptions: { showFungible: false, showZeroBalance: false },
          },
        }),
        next: { revalidate: 30 },
      },
    );

    if (!response.ok) {
      console.error('[Solana LP] Helius DAS error:', response.status);
      return [];
    }

    const data = await response.json();
    type DASItem = {
      id?: string;
      compression?: { compressed?: boolean };
    };
    const items: DASItem[] = data.result?.items || [];

    const totalItems = items.length;
    let droppedCompressed = 0;
    let droppedInvalid = 0;

    const mints = items
      .filter((item) => {
        if (item.compression?.compressed) {
          droppedCompressed++;
          return false;
        }
        if (!item.id || !BASE58_MINT_RE.test(item.id)) {
          droppedInvalid++;
          return false;
        }
        return true;
      })
      .map((item) => item.id!) as string[];

    console.log(
      `[Solana LP] Helius DAS: ${totalItems} assets → ${mints.length} candidate mints` +
      ` (compressed dropped: ${droppedCompressed}, invalid: ${droppedInvalid})`,
    );

    return mints;
  } catch (error) {
    console.error('[Solana LP] Failed to fetch NFTs from Helius:', error);
    return [];
  }
}

/** Single Shyft GraphQL POST. Returns parsed body or null on error. */
async function shyftQuery<T>(
  query: string,
  variables: Record<string, unknown>,
  label: string,
): Promise<T | null> {
  if (!SHYFT_API_KEY) {
    console.warn(`[Solana LP] ${label}: No SHYFT_API_KEY configured`);
    return null;
  }
  try {
    const response = await fetch(
      `${SHYFT_GRAPHQL_URL}?api_key=${SHYFT_API_KEY}&network=mainnet-beta`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        next: { revalidate: 30 },
      },
    );

    if (!response.ok) {
      console.error(`[Solana LP] ${label}: HTTP ${response.status}`);
      return null;
    }
    const data = await response.json();
    if (data.errors) {
      console.error(
        `[Solana LP] ${label}: GraphQL errors:`,
        JSON.stringify(data.errors).slice(0, 500),
      );
      return null;
    }
    return data.data as T;
  } catch (error) {
    console.error(`[Solana LP] ${label}: fetch failed:`, error);
    return null;
  }
}

/**
 * Fetch all LP positions across the 3 protocols. Split into two GraphQL
 * calls so a failure on one path doesn't poison the other:
 *   - NFT-based (Orca + Raydium): looked up by positionMint / nftMint.
 *   - Owner-based (Meteora V1 + V2): looked up by `owner`.
 */
async function fetchShyftPositions(
  wallet: string,
  nftMints: string[],
): Promise<{
  orca: ShyftOrcaPosition[];
  raydium: ShyftRaydiumPosition[];
  meteora: ShyftMeteoraPosition[];
}> {
  const [nftData, meteoraData] = await Promise.all([
    nftMints.length > 0
      ? shyftQuery<{
          orca?: ShyftOrcaPosition[];
          raydium?: ShyftRaydiumPosition[];
        }>(SHYFT_NFT_QUERY, { mints: nftMints }, 'NFT-based query')
      : Promise.resolve({ orca: [], raydium: [] }),
    shyftQuery<{
      meteoraV1?: ShyftMeteoraPosition[];
      meteoraV2?: ShyftMeteoraPosition[];
    }>(SHYFT_METEORA_QUERY, { wallet }, 'Meteora query'),
  ]);

  const orca = nftData?.orca || [];
  const raydium = nftData?.raydium || [];
  const meteoraV1 = meteoraData?.meteoraV1 || [];
  const meteoraV2 = meteoraData?.meteoraV2 || [];

  console.log(
    `[Solana LP] Shyft results — orca: ${orca.length}, raydium: ${raydium.length},` +
    ` meteora V1: ${meteoraV1.length}, V2: ${meteoraV2.length}`,
  );

  return {
    orca,
    raydium,
    meteora: [...meteoraV1, ...meteoraV2],
  };
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
    // Step 0: Discover NFT mints in the wallet (needed for Orca + Raydium).
    // Meteora positions are PDA-based with `owner` indexed, so we don't need
    // NFT discovery for them — they come from the same Shyft query but via
    // a different `where` clause.
    const nftMints = await fetchWalletNFTMints(wallet);

    // Step 1: Single Shyft query covering Orca + Raydium (by mint) +
    // Meteora V1+V2 (by owner).
    const {
      orca: orcaPositions,
      raydium: raydiumPositions,
      meteora: meteoraPositions,
    } = await fetchShyftPositions(wallet, nftMints);

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
