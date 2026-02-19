import { NextRequest, NextResponse } from 'next/server';

// Mapeamento símbolo → CoinGecko ID
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  'BTC': 'bitcoin', 'WBTC': 'wrapped-bitcoin', 'ETH': 'ethereum',
  'WETH': 'weth', 'SOL': 'solana', 'USDT': 'tether', 'USDC': 'usd-coin',
  'BNB': 'binancecoin', 'XRP': 'ripple', 'ADA': 'cardano',
  'AVAX': 'avalanche-2', 'DOT': 'polkadot', 'MATIC': 'matic-network',
  'POL': 'matic-network', 'LINK': 'chainlink', 'UNI': 'uniswap',
  'AAVE': 'aave', 'ARB': 'arbitrum', 'OP': 'optimism',
  'DOGE': 'dogecoin', 'SHIB': 'shiba-inu', 'ATOM': 'cosmos',
  'NEAR': 'near', 'FTM': 'fantom', 'ALGO': 'algorand',
  'MANA': 'decentraland', 'SAND': 'the-sandbox',
  'CRV': 'curve-dao-token', 'MKR': 'maker', 'SNX': 'havven',
  'COMP': 'compound-governance-token', 'SUSHI': 'sushi',
  'JUP': 'jupiter-exchange-solana', 'RAY': 'raydium',
  'ORCA': 'orca', 'BONK': 'bonk', 'WIF': 'dogwifcoin',
  'LDO': 'lido-dao', 'RPL': 'rocket-pool', 'PEPE': 'pepe',
  'RENDER': 'render-token', 'INJ': 'injective-protocol',
  'TIA': 'celestia', 'SEI': 'sei-network', 'SUI': 'sui',
  'APT': 'aptos', 'STX': 'blockstack', 'FIL': 'filecoin',
  'GRT': 'the-graph', 'IMX': 'immutable-x',
};

// Cache em memória - 1 hora
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Calcular retornos diários a partir de preços
function calculateReturns(prices: [number, number][]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prevPrice = prices[i - 1][1];
    const currPrice = prices[i][1];
    if (prevPrice > 0) {
      returns.push((currPrice - prevPrice) / prevPrice);
    }
  }
  return returns;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const coinsParam = searchParams.get('coins'); // Pode ser IDs do CoinGecko ou símbolos
  const symbolsParam = searchParams.get('symbols'); // Símbolos como BTC,ETH,SOL
  const days = searchParams.get('days') || '30';

  let coinIds: string[] = [];

  if (symbolsParam) {
    // Converter símbolos para CoinGecko IDs
    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
    coinIds = symbols
      .map(s => SYMBOL_TO_COINGECKO[s])
      .filter(Boolean);
  } else if (coinsParam) {
    coinIds = coinsParam.split(',').map(s => s.trim().toLowerCase());
  }

  if (coinIds.length === 0) {
    return NextResponse.json(
      { error: 'Provide coins (CoinGecko IDs) or symbols (e.g., BTC,ETH)' },
      { status: 400 }
    );
  }

  // Limitar a 15 coins para não sobrecarregar CoinGecko
  coinIds = coinIds.slice(0, 15);

  const results: Record<string, {
    prices: [number, number][];
    returns: number[];
  }> = {};

  // Buscar em paralelo com controle de rate
  const fetchPromises = coinIds.map(async (coinId, index) => {
    const cacheKey = `${coinId}-${days}`;
    const cached = getCached(cacheKey);
    if (cached) {
      results[coinId] = cached as typeof results[string];
      return;
    }

    // CoinGecko free: ~10-30 req/min. Escalonar requests.
    await new Promise(resolve => setTimeout(resolve, index * 200));

    try {
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 3600 }, // Cache Next.js 1h
      });

      if (!response.ok) {
        console.error(`CoinGecko error for ${coinId}: ${response.status}`);
        return;
      }

      const data = await response.json();
      const prices: [number, number][] = data.prices || [];
      const returns = calculateReturns(prices);

      const result = { prices, returns };
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
  });
}
