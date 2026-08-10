import { NextRequest, NextResponse } from 'next/server';

const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC: 'bitcoin',
  WBTC: 'wrapped-bitcoin',
  ETH: 'ethereum',
  WETH: 'weth',
  SOL: 'solana',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  POL: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  AAVE: 'aave',
  ARB: 'arbitrum',
  OP: 'optimism',
  DOGE: 'dogecoin',
  SHIB: 'shiba-inu',
  ATOM: 'cosmos',
  NEAR: 'near',
  FTM: 'fantom',
  ALGO: 'algorand',
  MANA: 'decentraland',
  SAND: 'the-sandbox',
  CRV: 'curve-dao-token',
  MKR: 'maker',
  SNX: 'havven',
  COMP: 'compound-governance-token',
  SUSHI: 'sushi',
  JUP: 'jupiter-exchange-solana',
  RAY: 'raydium',
  ORCA: 'orca',
  BONK: 'bonk',
  WIF: 'dogwifcoin',
  LDO: 'lido-dao',
  RPL: 'rocket-pool',
  PEPE: 'pepe',
  RENDER: 'render-token',
  INJ: 'injective-protocol',
  TIA: 'celestia',
  SEI: 'sei-network',
  SUI: 'sui',
  APT: 'aptos',
  STX: 'blockstack',
  FIL: 'filecoin',
  GRT: 'the-graph',
  IMX: 'immutable-x',
  ARKM: 'arkham',
  PENDLE: 'pendle',
};

const cache = new Map<string, { data: unknown; timestamp: number }>();

function getCacheTtl(days: string) {
  return days === '1' ? 5 * 60 * 1000 : 60 * 60 * 1000;
}

function getCached(key: string, ttl: number) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() });
}

function calculateReturns(prices: [number, number][]): number[] {
  const returns: number[] = [];
  for (let index = 1; index < prices.length; index += 1) {
    const prevPrice = prices[index - 1][1];
    const currentPrice = prices[index][1];
    if (prevPrice > 0) {
      returns.push((currentPrice - prevPrice) / prevPrice);
    }
  }
  return returns;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const coinsParam = searchParams.get('coins');
  const symbolsParam = searchParams.get('symbols');
  const days = searchParams.get('days') || '30';

  let coinIds: string[] = [];

  if (symbolsParam) {
    const symbols = symbolsParam.split(',').map((symbol) => symbol.trim().toUpperCase());
    coinIds = symbols.map((symbol) => SYMBOL_TO_COINGECKO[symbol]).filter(Boolean);
  } else if (coinsParam) {
    coinIds = coinsParam.split(',').map((coin) => coin.trim().toLowerCase()).filter(Boolean);
  }

  coinIds = Array.from(new Set(coinIds)).slice(0, 15);

  if (coinIds.length === 0) {
    return NextResponse.json(
      { error: 'Provide coins (CoinGecko IDs) or symbols (e.g., BTC,ETH)' },
      { status: 400 }
    );
  }

  const cacheTtl = getCacheTtl(days);
  const intervalParam = days === '1' ? '' : '&interval=daily';
  const revalidateSeconds = days === '1' ? 300 : 3600;
  const results: Record<string, { prices: [number, number][]; returns: number[] }> = {};

  const fetchPromises = coinIds.map(async (coinId, index) => {
    const cacheKey = `${coinId}-${days}-${intervalParam || 'intraday'}`;
    const cached = getCached(cacheKey, cacheTtl);
    if (cached) {
      results[coinId] = cached as { prices: [number, number][]; returns: number[] };
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, index * 200));

    try {
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}${intervalParam}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        next: { revalidate: revalidateSeconds },
      });

      if (!response.ok) {
        console.error(`CoinGecko error for ${coinId}: ${response.status}`);
        return;
      }

      const data = await response.json();
      const prices: [number, number][] = data.prices || [];
      const result = { prices, returns: calculateReturns(prices) };

      results[coinId] = result;
      setCache(cacheKey, result);
    } catch (error) {
      console.error(`Failed to fetch ${coinId}:`, error);
    }
  });

  await Promise.all(fetchPromises);

  return NextResponse.json({
    data: results,
    symbols: SYMBOL_TO_COINGECKO,
    fetched: Object.keys(results).length,
    requested: coinIds.length,
    generatedAt: new Date().toISOString(),
  });
}
