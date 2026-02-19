/**
 * Pool Integration Services
 *
 * This module provides integration with multiple DeFi protocols across EVM and Solana chains.
 *
 * Supported Data Sources:
 * - DeFiLlama API: TVL, yields, pool APY data (multi-chain)
 * - Bitquery: Real-time pool events, liquidity data
 * - Jupiter: Solana DEX aggregation
 * - Protocol-specific APIs: Orca Whirlpool, Raydium, etc.
 */

import {
  PoolPosition,
  PoolInfo,
  PoolChain,
  PoolProtocol,
  CHAIN_CONFIG,
  isEVMChain,
  isSolanaChain,
} from '../types';

// ============================================
// DeFiLlama Integration
// ============================================

export interface DefiLlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number | null;
  rewardTokens: string[] | null;
  underlyingTokens: string[] | null;
  poolMeta: string | null;
  exposure: string;
  il7d: number | null;
  apyBase7d: number | null;
  apyMean30d: number | null;
  volumeUsd1d: number | null;
  volumeUsd7d: number | null;
  stablecoin?: boolean;
}

export interface DefiLlamaYieldResponse {
  status: string;
  data: DefiLlamaPool[];
}

/**
 * Fetch all yield pools from DeFiLlama via our API proxy
 */
export async function fetchDefiLlamaYields(): Promise<DefiLlamaPool[]> {
  try {
    const response = await fetch('/api/defi/defillama/pools');
    const data: DefiLlamaYieldResponse = await response.json();
    return data.data;
  } catch (error) {
    console.error('Failed to fetch DeFiLlama yields:', error);
    return [];
  }
}

/**
 * Filter DeFiLlama pools by chain
 */
export function filterPoolsByChain(pools: DefiLlamaPool[], chain: PoolChain): DefiLlamaPool[] {
  const chainName = CHAIN_CONFIG[chain].name.toLowerCase();
  return pools.filter(pool => pool.chain.toLowerCase() === chainName);
}

/**
 * Filter DeFiLlama pools by protocol
 */
export function filterPoolsByProtocol(pools: DefiLlamaPool[], protocol: string): DefiLlamaPool[] {
  return pools.filter(pool => pool.project.toLowerCase().includes(protocol.toLowerCase()));
}

// ============================================
// Solana-Specific Integrations
// ============================================

/**
 * Raydium Pool Data
 * Program ID: 675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8
 */
export interface RaydiumPoolInfo {
  id: string;
  baseMint: string;
  quoteMint: string;
  lpMint: string;
  baseDecimals: number;
  quoteDecimals: number;
  lpDecimals: number;
  version: number;
  programId: string;
  authority: string;
  openOrders: string;
  targetOrders: string;
  baseVault: string;
  quoteVault: string;
  marketId: string;
  marketProgramId: string;
  marketAuthority: string;
  marketBaseVault: string;
  marketQuoteVault: string;
  marketBids: string;
  marketAsks: string;
  marketEventQueue: string;
  lookupTableAccount?: string;
}

/**
 * Fetch Raydium pools from API
 */
export async function fetchRaydiumPools(): Promise<RaydiumPoolInfo[]> {
  try {
    // Raydium provides pool configs via their API
    const response = await fetch('https://api.raydium.io/v2/main/pairs');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch Raydium pools:', error);
    return [];
  }
}

/**
 * Orca Whirlpool Data
 * Program ID: whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc
 */
export interface OrcaWhirlpoolInfo {
  address: string;
  tokenMintA: string;
  tokenMintB: string;
  tickSpacing: number;
  feeRate: number;
  protocolFeeRate: number;
  liquidity: string;
  sqrtPrice: string;
  tickCurrentIndex: number;
  tokenVaultA: string;
  tokenVaultB: string;
  whirlpoolsConfig: string;
}

/**
 * Fetch Orca Whirlpool data
 */
export async function fetchOrcaWhirlpools(): Promise<OrcaWhirlpoolInfo[]> {
  try {
    // Orca provides whirlpool data via their API
    const response = await fetch('https://api.mainnet.orca.so/v1/whirlpool/list');
    const data = await response.json();
    return data.whirlpools || [];
  } catch (error) {
    console.error('Failed to fetch Orca whirlpools:', error);
    return [];
  }
}

/**
 * Meteora DLMM Data
 * Program ID: LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo
 */
export interface MeteoraPoolInfo {
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
  apr: number;
  apy: number;
  farmApr: number;
  farmApy: number;
}

/**
 * Fetch Meteora DLMM pools
 */
export async function fetchMeteoraPools(): Promise<MeteoraPoolInfo[]> {
  try {
    const response = await fetch('https://dlmm-api.meteora.ag/pair/all');
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('Failed to fetch Meteora pools:', error);
    return [];
  }
}

// ============================================
// Jupiter Integration (Solana DEX Aggregator)
// ============================================

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: null | { amount: string; feeBps: number };
  priceImpactPct: string;
  routePlan: {
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }[];
}

/**
 * Get swap quote from Jupiter
 */
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50
): Promise<JupiterQuote | null> {
  try {
    const response = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to get Jupiter quote:', error);
    return null;
  }
}

// ============================================
// Cross-Chain Aggregators (1inch, LI.FI)
// ============================================

/**
 * 1inch Integration
 * Supports EVM chains + Solana (bridge-free swaps since Aug 2025)
 */
export interface OneInchQuote {
  fromToken: { symbol: string; address: string; decimals: number };
  toToken: { symbol: string; address: string; decimals: number };
  toAmount: string;
  protocols: string[][][];
  gas: number;
}

/**
 * LI.FI Integration
 * Multi-chain bridge and DEX aggregation
 */
export interface LiFiRoute {
  id: string;
  fromChainId: number;
  toChainId: number;
  fromToken: { address: string; symbol: string };
  toToken: { address: string; symbol: string };
  fromAmount: string;
  toAmount: string;
  steps: {
    type: 'swap' | 'bridge';
    tool: string;
    estimate: { fromAmount: string; toAmount: string };
  }[];
}

// ============================================
// Bitquery GraphQL (Real-time DEX Data)
// ============================================

export interface BitqueryPoolEvent {
  block: { timestamp: { iso8601: string } };
  transaction: { hash: string };
  pool: { address: string };
  tokenA: { symbol: string; amount: number };
  tokenB: { symbol: string; amount: number };
  type: 'add' | 'remove';
}

/**
 * Subscribe to real-time pool events via Bitquery
 * Supports: Raydium, Orca Whirlpool, Meteora on Solana
 */
export function createBitquerySubscription(
  protocol: 'raydium' | 'orca' | 'meteora',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onEvent: (event: BitqueryPoolEvent) => void
): () => void {
  // This would create a WebSocket subscription in production
  // For now, return a cleanup function
  console.log(`Creating Bitquery subscription for ${protocol}`);
  return () => {
    console.log(`Cleaning up Bitquery subscription for ${protocol}`);
  };
}

// ============================================
// Unified Pool Fetcher
// ============================================

export interface FetchPoolsOptions {
  chains?: PoolChain[];
  protocols?: PoolProtocol[];
  minTvl?: number;
  minApr?: number;
}

// Default fee rates by protocol (as decimal, e.g. 0.003 = 0.3%)
const PROTOCOL_DEFAULT_FEE: Record<string, number> = {
  'uniswap-v3': 0.003,
  'uniswap-v2': 0.003,
  'sushiswap': 0.003,
  'curve': 0.0004,
  'balancer': 0.003,
  'pancakeswap': 0.0025,
  'camelot': 0.003,
  'aerodrome': 0.003,
  'velodrome': 0.003,
  'raydium': 0.0025,
  'raydium-clmm': 0.0025,
  'orca': 0.003,
  'orca-whirlpool': 0.003,
  'meteora': 0.003,
  'meteora-dlmm': 0.003,
  'lifinity': 0.003,
};

/**
 * Extract fee tier from DeFiLlama poolMeta field
 * poolMeta can be: "0.05%", "0.3%", "1%", "stable", null, etc.
 * Returns fee as decimal (e.g. 0.0005 for "0.05%")
 */
function extractFeeTier(poolMeta: string | null, protocol: PoolProtocol): number {
  if (poolMeta) {
    const match = poolMeta.match(/([\d.]+)%/);
    if (match) {
      return parseFloat(match[1]) / 100;
    }
  }
  return PROTOCOL_DEFAULT_FEE[protocol] || 0.003;
}

/**
 * Fetch pools from all supported sources
 */
export async function fetchAllPools(options: FetchPoolsOptions = {}): Promise<PoolInfo[]> {
  const {
    chains = Object.keys(CHAIN_CONFIG) as PoolChain[],
    protocols,
    minTvl = 0,
    minApr = 0,
  } = options;

  const allPools: PoolInfo[] = [];

  // Fetch from DeFiLlama (covers most chains)
  const llamaPools = await fetchDefiLlamaYields();

  // Filter and transform DeFiLlama data
  for (const pool of llamaPools) {
    if (pool.tvlUsd < minTvl) continue;
    if ((pool.apy || 0) < minApr) continue;

    // Map DeFiLlama chain name to our chain type
    const chain = mapLlamaChainToPoolChain(pool.chain);
    if (!chain || !chains.includes(chain)) continue;

    // Map project to protocol
    const protocol = mapLlamaProjectToProtocol(pool.project);
    if (!protocol) continue;
    if (protocols && !protocols.includes(protocol)) continue;

    // Parse token symbols from DeFiLlama symbol field (e.g. "USDC-ETH")
    const symbolParts = pool.symbol.split('-');
    const token0Symbol = symbolParts[0]?.trim() || 'TOKEN0';
    const token1Symbol = symbolParts[1]?.trim() || 'TOKEN1';

    // Extract fee tier from poolMeta or use protocol default
    const feeRate = extractFeeTier(pool.poolMeta, protocol);
    const feeTierPercent = feeRate * 100; // e.g. 0.003 → 0.3

    // Real volume data from DeFiLlama
    const volume24h = pool.volumeUsd1d || 0;
    const volume7d = pool.volumeUsd7d || 0;

    // Calculate fees from volume * fee rate
    const fees24h = volume24h * feeRate;
    const fees7d = volume7d * feeRate;

    // APR data
    const apr24h = pool.apyBase || pool.apy || 0;
    const apr7d = pool.apyBase7d || pool.apy || 0;

    allPools.push({
      address: pool.pool,
      protocol,
      chain,
      networkType: CHAIN_CONFIG[chain].networkType,
      token0: {
        symbol: token0Symbol,
        name: token0Symbol,
        address: '',
        decimals: 18,
        price: 0,
      },
      token1: {
        symbol: token1Symbol,
        name: token1Symbol,
        address: '',
        decimals: 18,
        price: 0,
      },
      feeTier: feeTierPercent,
      tvl: pool.tvlUsd,
      metrics: {
        totalLiquidityUsd: pool.tvlUsd,
        volume24h,
        volume7d,
        fees24h,
        fees7d,
        apr24h,
        apr7d,
        txCount24h: 0,
      },
    });
  }

  return allPools;
}

// ============================================
// Helper Mapping Functions
// ============================================

function mapLlamaChainToPoolChain(llamaChain: string): PoolChain | null {
  const mapping: Record<string, PoolChain> = {
    'ethereum': 'ethereum',
    'arbitrum': 'arbitrum',
    'optimism': 'optimism',
    'polygon': 'polygon',
    'base': 'base',
    'bsc': 'bsc',
    'avalanche': 'avalanche',
    'solana': 'solana',
  };
  return mapping[llamaChain.toLowerCase()] || null;
}

function mapLlamaProjectToProtocol(project: string): PoolProtocol | null {
  const mapping: Record<string, PoolProtocol> = {
    'uniswap-v3': 'uniswap-v3',
    'uniswap-v2': 'uniswap-v2',
    'sushiswap': 'sushiswap',
    'sushiswap-v3': 'sushiswap',
    'curve': 'curve',
    'curve-dex': 'curve',
    'balancer-v2': 'balancer',
    'pancakeswap-amm-v3': 'pancakeswap',
    'pancakeswap-amm-v2': 'pancakeswap',
    'camelot-v3': 'camelot',
    'camelot-v2': 'camelot',
    'aerodrome-v1': 'aerodrome',
    'aerodrome-v2': 'aerodrome',
    'aerodrome-slipstream': 'aerodrome',
    'velodrome-v1': 'velodrome',
    'velodrome-v2': 'velodrome',
    'raydium': 'raydium',
    'raydium-concentrated': 'raydium-clmm',
    'orca': 'orca',
    'orca-whirlpools': 'orca-whirlpool',
    'meteora': 'meteora',
    'meteora-dlmm': 'meteora-dlmm',
    'lifinity-v2': 'lifinity',
  };

  const lowerProject = project.toLowerCase();

  // Try exact match first
  if (mapping[lowerProject]) {
    return mapping[lowerProject];
  }

  // Try partial match (project name contains a known key)
  for (const [key, value] of Object.entries(mapping)) {
    if (lowerProject === key || lowerProject.startsWith(key)) {
      return value;
    }
  }

  return null;
}

// ============================================
// Position Tracking
// ============================================

/**
 * Fetch user positions across all protocols
 * In production, this would query each protocol's subgraph/API
 */
export async function fetchUserPositions(
  walletAddresses: { chain: PoolChain; address: string }[]
): Promise<PoolPosition[]> {
  const positions: PoolPosition[] = [];

  for (const { chain } of walletAddresses) {
    if (isEVMChain(chain)) {
      // Query EVM subgraphs for Uniswap V3, etc.
      // positions.push(...await fetchEVMPositions(chain, address));
    } else if (isSolanaChain(chain)) {
      // Query Solana for Orca Whirlpool, Raydium CLMM positions
      // positions.push(...await fetchSolanaPositions(address));
    }
  }

  return positions;
}

/**
 * Real-time position value calculation
 */
export function calculatePositionValue(position: PoolPosition): number {
  return position.token0Amount * position.token0.price +
         position.token1Amount * position.token1.price;
}

/**
 * Calculate impermanent loss
 */
export function calculateImpermanentLoss(
  initialToken0Price: number,
  initialToken1Price: number,
  currentToken0Price: number,
  currentToken1Price: number
): number {
  const priceRatio = (currentToken0Price / currentToken1Price) /
                     (initialToken0Price / initialToken1Price);
  const sqrtRatio = Math.sqrt(priceRatio);
  const il = 2 * sqrtRatio / (1 + priceRatio) - 1;
  return il * 100; // Return as percentage
}
