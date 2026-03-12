// Token Price Service
// Uses DeFiLlama Coins API (free, no API key required)
// https://coins.llama.fi

const DEFILLAMA_CURRENT_URL = 'https://coins.llama.fi/prices/current';
const DEFILLAMA_HISTORICAL_URL = 'https://coins.llama.fi/prices/historical';

// Chain mapping for DeFiLlama coin IDs
const CHAIN_PREFIX: Record<string, string> = {
  ethereum: 'ethereum',
  base: 'base',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  polygon: 'polygon',
  bsc: 'bsc',
  avalanche: 'avax',
};

// In-memory cache with TTL
interface PriceEntry {
  price: number;
  timestamp: number;
}

const priceCache = new Map<string, PriceEntry>();
const CACHE_TTL = 60_000; // 1 minute

function getCacheKey(chain: string, address: string): string {
  return (chain + ':' + address).toLowerCase();
}

function getCachedPrice(chain: string, address: string): number | null {
  const key = getCacheKey(chain, address);
  const entry = priceCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.price;
  }
  return null;
}

function setCachedPrice(chain: string, address: string, price: number): void {
  const key = getCacheKey(chain, address);
  priceCache.set(key, { price: price, timestamp: Date.now() });
}

/**
 * Build DeFiLlama coin ID from chain + address
 * Native tokens (ETH, etc.) use special handling
 */
function buildCoinId(chain: string, address: string): string {
  const prefix = CHAIN_PREFIX[chain] || chain;
  // Native ETH / zero address
  if (!address ||
      address === '0x0000000000000000000000000000000000000000' ||
      address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
    // DeFiLlama uses coingecko IDs for native tokens
    if (prefix === 'ethereum' || prefix === 'base' || prefix === 'arbitrum' || prefix === 'optimism') {
      return 'coingecko:ethereum';
    }
    if (prefix === 'polygon') return 'coingecko:matic-network';
    if (prefix === 'bsc') return 'coingecko:binancecoin';
    if (prefix === 'avax') return 'coingecko:avalanche-2';
    return 'coingecko:ethereum';
  }
  return prefix + ':' + address.toLowerCase();
}

export interface TokenPriceInput {
  address: string;
  chain: string;
  symbol?: string;
}

/**
 * Batch-fetch current token prices from DeFiLlama
 * Returns a map of "chain:address" -> price (USD)
 */
export async function fetchTokenPrices(
  tokens: TokenPriceInput[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const uncachedTokens: TokenPriceInput[] = [];

  // Check cache first
  tokens.forEach(function(token) {
    const cached = getCachedPrice(token.chain, token.address);
    if (cached !== null) {
      result[getCacheKey(token.chain, token.address)] = cached;
    } else {
      uncachedTokens.push(token);
    }
  });

  if (uncachedTokens.length === 0) {
    return result;
  }

  // Build comma-separated coin IDs for DeFiLlama batch request
  const coinIds = uncachedTokens.map(function(t) {
    return buildCoinId(t.chain, t.address);
  });
  // Deduplicate coin IDs (e.g., multiple tokens mapping to coingecko:ethereum)
  const uniqueCoinIds = Array.from(new Set(coinIds));
  const coinsParam = uniqueCoinIds.join(',');

  try {
    const response = await fetch(DEFILLAMA_CURRENT_URL + '/' + coinsParam);
    if (!response.ok) {
      console.warn('[PriceService] DeFiLlama returned status', response.status);
      return result;
    }

    const data: { coins: Record<string, { price: number; symbol?: string; timestamp?: number }> } = await response.json();

    // Map responses back to our tokens
    uncachedTokens.forEach(function(token, idx) {
      const coinId = coinIds[idx];
      const priceData = data.coins[coinId];
      if (priceData && priceData.price > 0) {
        const key = getCacheKey(token.chain, token.address);
        result[key] = priceData.price;
        setCachedPrice(token.chain, token.address, priceData.price);
      }
    });
  } catch (err) {
    console.warn('[PriceService] Failed to fetch prices from DeFiLlama:', err);
  }

  return result;
}

/**
 * Fetch a single token's historical price at a given UNIX timestamp
 */
export async function fetchHistoricalPrice(
  chain: string,
  address: string,
  unixTimestamp: number
): Promise<number | null> {
  const coinId = buildCoinId(chain, address);

  try {
    const url = DEFILLAMA_HISTORICAL_URL + '/' + unixTimestamp + '/' + coinId;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data: { coins: Record<string, { price: number }> } = await response.json();
    const priceData = data.coins[coinId];
    return priceData ? priceData.price : null;
  } catch (err) {
    console.warn('[PriceService] Failed to fetch historical price:', err);
    return null;
  }
}

/**
 * Helper: get price for a specific token from the result map
 */
export function getPriceFromMap(
  priceMap: Record<string, number>,
  chain: string,
  address: string
): number {
  const key = getCacheKey(chain, address);
  return priceMap[key] || 0;
}
