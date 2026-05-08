import { NextRequest, NextResponse } from 'next/server';
import type {
  ShyftOrcaPosition,
  ShyftRaydiumPosition,
  ShyftMeteoraPosition,
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
// Jupiter v2 (api.jup.ag/price/v2) returns empty bodies in May 2026.
// v3 lite is the working endpoint; response shape is mint → { usdPrice }.
const JUPITER_PRICE_URL = 'https://lite-api.jup.ag/price/v3';

// Helius for NFT discovery (Orca + Raydium positions are NFT-based — no `owner`
// field on Shyft, so we list NFTs from the wallet via DAS, then look up the
// position records by `positionMint`/`nftMint`).
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';

// Protocol API endpoints. Orca's public API is replaced by Shyft (see
// SHYFT_ORCA_POOL_QUERY) due to a Cloudflare 1016 misroute on their side.
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
// One unified query covers all 3 protocols. Earlier we split this in two
// to isolate failures, but Shyft's free tier rate limit (1 Index req/sec)
// makes parallel fan-out trip 429. After the schema fixes the unified
// shape is stable enough to use a single round-trip.

const SHYFT_POSITIONS_QUERY = `
  query GetSolanaLPPositions($mints: [String!]!, $wallet: String!) {
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

// Orca's public pool API (api.mainnet.orca.so) is currently returning a
// Cloudflare 1016 error wrapped in a JSON envelope. We bypass it entirely
// by fetching whirlpool state from Shyft (same source we already use for
// positions). Shyft only stores on-chain fields, so symbols/decimals/logos
// come separately from Helius DAS getAssetBatch.
const SHYFT_ORCA_POOL_QUERY = `
  query GetOrcaPools($pools: [String!]!) {
    ORCA_WHIRLPOOLS_whirlpool(where: { pubkey: { _in: $pools } }) {
      pubkey
      tokenMintA
      tokenMintB
      tokenVaultA
      tokenVaultB
      sqrtPrice
      tickCurrentIndex
      tickSpacing
      feeRate
      liquidity
    }
  }
`;

interface ShyftOrcaWhirlpoolState {
  pubkey: string;
  tokenMintA: string;
  tokenMintB: string;
  tokenVaultA: string;
  tokenVaultB: string;
  sqrtPrice: string;
  tickCurrentIndex: number | string;
  tickSpacing: number | string;
  feeRate: number | string;
  liquidity: string;
}

interface TokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
}

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

/**
 * Single Shyft GraphQL POST with a one-shot retry on rate limit (429).
 * Free tier allows 1 Index req/sec — when we make multiple sequential
 * calls per request (positions then pools), the second can land within
 * the same second window and trip 429.
 */
async function shyftQuery<T>(
  query: string,
  variables: Record<string, unknown>,
  label: string,
): Promise<T | null> {
  if (!SHYFT_API_KEY) {
    console.warn(`[Solana LP] ${label}: No SHYFT_API_KEY configured`);
    return null;
  }
  const url = `${SHYFT_GRAPHQL_URL}?api_key=${SHYFT_API_KEY}&network=mainnet-beta`;
  const body = JSON.stringify({ query, variables });
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    next: { revalidate: 30 } as { revalidate: number },
  } as RequestInit;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, init);

      if (response.status === 429) {
        if (attempt === 0) {
          console.warn(`[Solana LP] ${label}: 429 rate limit, retrying in 1.1s`);
          await new Promise((r) => setTimeout(r, 1100));
          continue;
        }
        console.error(`[Solana LP] ${label}: 429 after retry`);
        return null;
      }

      if (!response.ok) {
        console.error(`[Solana LP] ${label}: HTTP ${response.status}`);
        return null;
      }

      // Shyft (Hasura) returns `numeric` columns as raw JSON numbers — but
      // sqrtPriceX64, fee growth checkpoints and liquidityShares routinely
      // exceed Number.MAX_SAFE_INTEGER (2^53). JSON.parse silently truncates
      // those, breaking BigInt() math downstream. Wrap any unquoted integer
      // with 16+ digits in quotes so it round-trips losslessly as a string.
      const text = await response.text();
      const safeText = text.replace(
        /([:,[]\s*)(-?\d{16,})(?=\s*[,\]}])/g,
        '$1"$2"',
      );
      const data = JSON.parse(safeText);

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
  return null;
}

/**
 * Fetch all LP positions across Orca + Raydium (NFT-based, by positionMint
 * /nftMint) and Meteora V1+V2 (owner-based) in a single Shyft query.
 * The empty `mints` array still works — `_in: []` returns no rows but the
 * Meteora branch still runs.
 */
async function fetchShyftPositions(
  wallet: string,
  nftMints: string[],
): Promise<{
  orca: ShyftOrcaPosition[];
  raydium: ShyftRaydiumPosition[];
  meteora: ShyftMeteoraPosition[];
}> {
  const data = await shyftQuery<{
    orca?: ShyftOrcaPosition[];
    raydium?: ShyftRaydiumPosition[];
    meteoraV1?: ShyftMeteoraPosition[];
    meteoraV2?: ShyftMeteoraPosition[];
  }>(SHYFT_POSITIONS_QUERY, { mints: nftMints, wallet }, 'positions');

  const orca = data?.orca || [];
  const raydium = data?.raydium || [];
  const meteoraV1 = data?.meteoraV1 || [];
  const meteoraV2 = data?.meteoraV2 || [];

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
 * Fetch Orca whirlpool state(s) from Shyft. Replaces the broken Orca public
 * API. Single GraphQL query handles N pools at once.
 */
async function fetchOrcaPoolStatesViaShyft(
  whirlpoolAddresses: string[],
): Promise<Map<string, ShyftOrcaWhirlpoolState>> {
  const map = new Map<string, ShyftOrcaWhirlpoolState>();
  if (whirlpoolAddresses.length === 0) return map;

  const data = await shyftQuery<{
    ORCA_WHIRLPOOLS_whirlpool?: ShyftOrcaWhirlpoolState[];
  }>(SHYFT_ORCA_POOL_QUERY, { pools: whirlpoolAddresses }, 'Orca pool state');

  for (const pool of data?.ORCA_WHIRLPOOLS_whirlpool || []) {
    map.set(pool.pubkey, pool);
  }
  return map;
}

/**
 * Fetch token metadata (symbol, name, decimals, logo) from Helius DAS.
 * Used to enrich Shyft pool data which only stores on-chain fields.
 * `getAssetBatch` works for both NFTs and fungible SPL tokens.
 */
async function fetchTokenMetadata(
  mints: string[],
): Promise<Record<string, TokenMetadata>> {
  const result: Record<string, TokenMetadata> = {};
  if (mints.length === 0 || !HELIUS_API_KEY) return result;

  const uniqueMints = Array.from(new Set(mints));

  try {
    const response = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'token-meta',
          method: 'getAssetBatch',
          params: { ids: uniqueMints },
        }),
        next: { revalidate: 300 },
      },
    );
    if (!response.ok) {
      console.error('[Solana LP] Helius getAssetBatch:', response.status);
      return result;
    }
    type DASItem = {
      id?: string;
      content?: {
        metadata?: { symbol?: string; name?: string };
        links?: { image?: string };
      };
      token_info?: { symbol?: string; decimals?: number };
    };
    const data = await response.json();
    const items: (DASItem | null)[] = data.result || [];
    for (const item of items) {
      if (!item || !item.id) continue;
      result[item.id] = {
        symbol:
          item.token_info?.symbol ||
          item.content?.metadata?.symbol ||
          'UNKNOWN',
        name: item.content?.metadata?.name || 'Unknown Token',
        decimals: item.token_info?.decimals ?? 9,
        logoUrl: item.content?.links?.image,
      };
    }
  } catch (error) {
    console.error('[Solana LP] Failed to fetch token metadata:', error);
  }
  return result;
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
 * Fetch token prices from Jupiter v3 lite endpoint.
 *
 * Response shape (flat map, not wrapped in `data`):
 *   { "<mint>": { usdPrice: number, decimals: number, ... } }
 */
async function fetchJupiterPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};

  try {
    const uniqueMints = Array.from(new Set(mints));
    const ids = uniqueMints.join(',');
    const response = await fetch(`${JUPITER_PRICE_URL}?ids=${ids}`, {
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      console.error('[Solana LP] Jupiter v3 HTTP', response.status);
      return {};
    }

    const data = (await response.json()) as Record<
      string,
      { usdPrice?: number; price?: number | string }
    >;
    const prices: Record<string, number> = {};

    for (const [mint, info] of Object.entries(data || {})) {
      // v3 returns `usdPrice` as number; tolerate `price` as a fallback in
      // case the endpoint shape shifts again.
      const raw = info?.usdPrice ?? info?.price;
      const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
      if (Number.isFinite(num) && num > 0) prices[mint] = num;
    }

    return prices;
  } catch (e) {
    console.error('[Solana LP] Failed to fetch Jupiter prices:', e);
    return {};
  }
}

/**
 * Unify pool state from different protocol formats
 */
/**
 * Build a UnifiedPoolState from Shyft on-chain data + Helius metadata.
 * Computes currentPrice from sqrtPriceX64 + decimals — no external API needed.
 */
function unifyOrcaShyftPoolState(
  pool: ShyftOrcaWhirlpoolState,
  metaA: TokenMetadata | undefined,
  metaB: TokenMetadata | undefined,
): UnifiedPoolState {
  const decimalsA = metaA?.decimals ?? 9;
  const decimalsB = metaB?.decimals ?? 6;

  // price = (sqrtPriceX64 / 2^64)^2 × 10^(decimalA - decimalB)
  const Q64 = BigInt(1) << BigInt(64);
  const sqrtPriceDec = Number(BigInt(pool.sqrtPrice)) / Number(Q64);
  const currentPrice =
    sqrtPriceDec * sqrtPriceDec * Math.pow(10, decimalsA - decimalsB);

  return {
    address: pool.pubkey,
    protocol: 'orca-whirlpool',
    tokenA: {
      mint: pool.tokenMintA,
      symbol: metaA?.symbol || 'TOKEN_A',
      name: metaA?.name || 'Token A',
      decimals: decimalsA,
      logoUrl: metaA?.logoUrl,
      priceUsd: 0,
    },
    tokenB: {
      mint: pool.tokenMintB,
      symbol: metaB?.symbol || 'TOKEN_B',
      name: metaB?.name || 'Token B',
      decimals: decimalsB,
      logoUrl: metaB?.logoUrl,
      priceUsd: 0,
    },
    currentTick: Number(pool.tickCurrentIndex),
    sqrtPrice: pool.sqrtPrice,
    liquidity: pool.liquidity,
    // On-chain Orca feeRate is in hundredths of a basis point (1e-6 fraction).
    // Downstream code expects feeRate as a decimal (0.0004 = 0.04%, ×100 → %).
    // 400 / 1_000_000 = 0.0004 → renders as 0.04%.
    feeRate: Number(pool.feeRate) / 1_000_000,
    tickSpacing: Number(pool.tickSpacing),
    currentPrice,
    // tvl/volume/fees24h aren't on-chain — would need DefiLlama for those.
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

    // Step 3: Fetch pool states. Orca via Shyft (its public API is currently
    // returning Cloudflare 1016 errors); Raydium/Meteora via their own APIs.
    const [orcaShyftPools, raydiumPoolStates, meteoraPoolStates] = await Promise.all([
      fetchOrcaPoolStatesViaShyft(orcaPools),
      Promise.all(raydiumPools.map(fetchRaydiumPoolState)),
      Promise.all(meteoraPools.map(fetchMeteoraPoolState)),
    ]);

    // Orca pools from Shyft don't carry token metadata (decimals, symbols,
    // logos). Fetch those in one Helius getAssetBatch call covering both
    // sides of every Orca pool we care about.
    const orcaPoolEntries = Array.from(orcaShyftPools.entries());
    const orcaTokenMintsForMeta: string[] = [];
    for (const [, pool] of orcaPoolEntries) {
      orcaTokenMintsForMeta.push(pool.tokenMintA, pool.tokenMintB);
    }
    const orcaTokenMeta = await fetchTokenMetadata(orcaTokenMintsForMeta);
    console.log(
      `[Solana LP] Orca pool metadata — pools: ${orcaShyftPools.size},` +
      ` token meta: ${Object.keys(orcaTokenMeta).length}`,
    );

    // Step 4: Build unified pool states map
    const poolStates: Record<string, UnifiedPoolState> = {};
    const tokenMints: string[] = [];

    for (const [pubkey, shyftPool] of orcaPoolEntries) {
      const metaA = orcaTokenMeta[shyftPool.tokenMintA];
      const metaB = orcaTokenMeta[shyftPool.tokenMintB];
      const unified = unifyOrcaShyftPoolState(shyftPool, metaA, metaB);
      poolStates[pubkey] = unified;
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
