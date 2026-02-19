// DeFiLlama API Service
// Free API for yield/APY data
// Documentation: https://defillama.com/docs/api

export interface DeFiLlamaPool {
  pool: string; // Unique pool ID
  chain: string;
  project: string; // Protocol name (lowercase)
  symbol: string; // Token symbol(s)
  tvlUsd: number;
  apyBase: number | null; // Base APY from fees/supply
  apyReward: number | null; // Reward APY from token emissions
  apy: number | null; // Total APY (apyBase + apyReward)
  rewardTokens: string[] | null;
  underlyingTokens: string[] | null;
  poolMeta: string | null;
  il7d: number | null; // 7-day impermanent loss
  apyBase7d: number | null; // 7-day average base APY
  apyMean30d: number | null; // 30-day average APY
  volumeUsd1d: number | null; // 24h volume
  volumeUsd7d: number | null; // 7-day volume
  apyBaseInception: number | null;
  // Lending specific
  apyBaseBorrow?: number | null;
  apyRewardBorrow?: number | null;
  totalSupplyUsd?: number;
  totalBorrowUsd?: number;
  ltv?: number | null; // Loan-to-value ratio
  borrowable?: boolean;
  mintedCoin?: string | null;
  // Extra metadata
  stablecoin?: boolean;
  ilRisk?: string;
  exposure?: string;
  predictions?: {
    predictedClass: string;
    predictedProbability: number;
    binnedConfidence: number;
  };
  mu?: number;
  sigma?: number;
  count?: number;
  outlier?: boolean;
  // URLs
  url?: string;
}

export interface DeFiLlamaPoolsResponse {
  status: string;
  data: DeFiLlamaPool[];
}

// Cache for pools data
let poolsCache: DeFiLlamaPool[] | null = null;
let poolsCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all yield pools from DeFiLlama
 * Uses caching to avoid excessive API calls
 */
export async function fetchAllPools(): Promise<DeFiLlamaPool[]> {
  // Check cache
  if (poolsCache && Date.now() - poolsCacheTime < CACHE_DURATION) {
    return poolsCache;
  }

  try {
    const response = await fetch('/api/defi/defillama/pools');

    if (!response.ok) {
      throw new Error(`DeFiLlama API error: ${response.status}`);
    }

    const result: DeFiLlamaPoolsResponse = await response.json();

    // Update cache
    poolsCache = result.data;
    poolsCacheTime = Date.now();

    return result.data;
  } catch (error) {
    console.error('Failed to fetch DeFiLlama pools:', error);
    // Return cached data if available, even if stale
    if (poolsCache) {
      return poolsCache;
    }
    throw error;
  }
}

/**
 * Search pools by project name
 */
export async function searchPoolsByProject(projectName: string): Promise<DeFiLlamaPool[]> {
  const pools = await fetchAllPools();
  const searchTerm = projectName.toLowerCase().replace(/\s+/g, '-');

  return pools.filter(pool =>
    pool.project.toLowerCase().includes(searchTerm) ||
    pool.project.toLowerCase() === searchTerm
  );
}

/**
 * Search pools by chain
 */
export async function searchPoolsByChain(chain: string): Promise<DeFiLlamaPool[]> {
  const pools = await fetchAllPools();
  const normalizedChain = normalizeChainName(chain);

  return pools.filter(pool =>
    pool.chain.toLowerCase() === normalizedChain.toLowerCase()
  );
}

/**
 * Find matching pool for a position
 * Uses fuzzy matching on project, chain, and symbol
 */
export async function findMatchingPool(
  protocol: string,
  chain: string,
  symbol: string
): Promise<DeFiLlamaPool | null> {
  const pools = await fetchAllPools();

  const normalizedProtocol = normalizeProtocolName(protocol);
  const normalizedChain = normalizeChainName(chain);
  const normalizedSymbol = symbol.toUpperCase();

  // Try exact match first
  let match = pools.find(pool =>
    pool.project.toLowerCase() === normalizedProtocol &&
    pool.chain.toLowerCase() === normalizedChain.toLowerCase() &&
    pool.symbol.toUpperCase().includes(normalizedSymbol)
  );

  if (match) return match;

  // Try partial protocol match
  match = pools.find(pool =>
    pool.project.toLowerCase().includes(normalizedProtocol) &&
    pool.chain.toLowerCase() === normalizedChain.toLowerCase() &&
    pool.symbol.toUpperCase().includes(normalizedSymbol)
  );

  if (match) return match;

  // Try just protocol and chain
  const protocolMatches = pools.filter(pool =>
    pool.project.toLowerCase().includes(normalizedProtocol) &&
    pool.chain.toLowerCase() === normalizedChain.toLowerCase()
  );

  // If multiple matches, try to find by symbol
  if (protocolMatches.length > 0) {
    const symbolMatch = protocolMatches.find(pool =>
      pool.symbol.toUpperCase().includes(normalizedSymbol) ||
      normalizedSymbol.includes(pool.symbol.split('-')[0].toUpperCase())
    );
    return symbolMatch || protocolMatches[0];
  }

  return null;
}

/**
 * Find multiple matching pools for batch enrichment
 */
export async function findMatchingPools(
  positions: Array<{
    protocol: string;
    chain: string;
    chainId: string;
    symbol: string;
    positionId: string;
  }>
): Promise<Map<string, DeFiLlamaPool>> {
  const pools = await fetchAllPools();
  const matches = new Map<string, DeFiLlamaPool>();

  // Create index for faster lookups
  const poolIndex = new Map<string, DeFiLlamaPool[]>();

  for (const pool of pools) {
    const key = `${pool.project.toLowerCase()}-${pool.chain.toLowerCase()}`;
    if (!poolIndex.has(key)) {
      poolIndex.set(key, []);
    }
    poolIndex.get(key)!.push(pool);
  }

  for (const position of positions) {
    const normalizedProtocol = normalizeProtocolName(position.protocol);
    const normalizedChain = normalizeChainName(position.chainId || position.chain);
    const normalizedSymbol = position.symbol.toUpperCase();

    // Try to find in index
    const key = `${normalizedProtocol}-${normalizedChain.toLowerCase()}`;
    let candidates = poolIndex.get(key);

    // If not found, try partial matches
    if (!candidates) {
      const indexKeys = Array.from(poolIndex.keys());
      for (const indexKey of indexKeys) {
        if (indexKey.includes(normalizedProtocol) && indexKey.includes(normalizedChain.toLowerCase())) {
          candidates = poolIndex.get(indexKey);
          break;
        }
      }
    }

    if (candidates && candidates.length > 0) {
      // Find best match by symbol
      let bestMatch = candidates.find(pool =>
        pool.symbol.toUpperCase() === normalizedSymbol ||
        pool.symbol.toUpperCase().includes(normalizedSymbol)
      );

      // If no symbol match, use first candidate
      if (!bestMatch) {
        bestMatch = candidates[0];
      }

      matches.set(position.positionId, bestMatch);
    }
  }

  return matches;
}

/**
 * Get top pools by APY for a specific chain/protocol
 */
export async function getTopPoolsByApy(
  options?: {
    chain?: string;
    project?: string;
    minTvl?: number;
    limit?: number;
  }
): Promise<DeFiLlamaPool[]> {
  let pools = await fetchAllPools();

  // Filter by options
  if (options?.chain) {
    const normalizedChain = normalizeChainName(options.chain);
    pools = pools.filter(p => p.chain.toLowerCase() === normalizedChain.toLowerCase());
  }

  if (options?.project) {
    const normalizedProject = normalizeProtocolName(options.project);
    pools = pools.filter(p => p.project.toLowerCase().includes(normalizedProject));
  }

  if (options?.minTvl) {
    pools = pools.filter(p => p.tvlUsd >= options.minTvl!);
  }

  // Sort by APY (descending)
  pools.sort((a, b) => (b.apy || 0) - (a.apy || 0));

  // Limit results
  if (options?.limit) {
    pools = pools.slice(0, options.limit);
  }

  return pools;
}

/**
 * Get lending pools with borrow rates
 */
export async function getLendingPools(
  options?: {
    chain?: string;
    project?: string;
    minTvl?: number;
  }
): Promise<DeFiLlamaPool[]> {
  let pools = await fetchAllPools();

  // Filter only lending pools (those with borrow data)
  pools = pools.filter(p =>
    p.apyBaseBorrow !== undefined ||
    p.totalBorrowUsd !== undefined ||
    p.ltv !== undefined
  );

  if (options?.chain) {
    const normalizedChain = normalizeChainName(options.chain);
    pools = pools.filter(p => p.chain.toLowerCase() === normalizedChain.toLowerCase());
  }

  if (options?.project) {
    const normalizedProject = normalizeProtocolName(options.project);
    pools = pools.filter(p => p.project.toLowerCase().includes(normalizedProject));
  }

  if (options?.minTvl) {
    pools = pools.filter(p => p.tvlUsd >= options.minTvl!);
  }

  return pools;
}

// Helper functions to normalize names for matching

/**
 * Normalize protocol name for matching
 * e.g., "Aave V3" -> "aave-v3", "Uniswap V3" -> "uniswap-v3"
 */
function normalizeProtocolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    // Common mappings
    .replace('aave-v3', 'aave-v3')
    .replace('uniswap-v3', 'uniswap-v3')
    .replace('compound-v3', 'compound-v3')
    .replace('curve-finance', 'curve')
    .replace('optimism-bridge', 'optimism');
}

/**
 * Normalize chain name for matching
 * Zerion chain IDs -> DeFiLlama chain names
 */
function normalizeChainName(chainIdOrName: string): string {
  const chainMap: Record<string, string> = {
    // Zerion chain IDs to DeFiLlama names
    'ethereum': 'Ethereum',
    'base': 'Base',
    'arbitrum-one': 'Arbitrum',
    'optimism': 'Optimism',
    'polygon': 'Polygon',
    'avalanche': 'Avalanche',
    'binance-smart-chain': 'BSC',
    'bsc': 'BSC',
    'fantom': 'Fantom',
    'gnosis': 'Gnosis',
    'celo': 'Celo',
    'moonbeam': 'Moonbeam',
    'aurora': 'Aurora',
    'harmony': 'Harmony',
    'cronos': 'Cronos',
    'metis': 'Metis',
    'boba': 'Boba',
    'kava': 'Kava',
    'linea': 'Linea',
    'zksync-era': 'zkSync Era',
    'polygon-zkevm': 'Polygon zkEVM',
    'scroll': 'Scroll',
    'mantle': 'Mantle',
    'blast': 'Blast',
    'mode': 'Mode',
    'manta': 'Manta',
  };

  const lower = chainIdOrName.toLowerCase();
  return chainMap[lower] || chainIdOrName;
}

/**
 * Format APY for display
 */
export function formatApy(apy: number | null | undefined): string {
  if (apy === null || apy === undefined) return '-';
  if (apy < 0.01) return '<0.01%';
  if (apy > 1000) return '>1000%';
  return `${apy.toFixed(2)}%`;
}

/**
 * Get APY breakdown
 */
export function getApyBreakdown(pool: DeFiLlamaPool): {
  total: number;
  base: number;
  reward: number;
  hasRewards: boolean;
} {
  const base = pool.apyBase || 0;
  const reward = pool.apyReward || 0;
  const total = pool.apy || (base + reward);

  return {
    total,
    base,
    reward,
    hasRewards: reward > 0,
  };
}
