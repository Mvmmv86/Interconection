// Pool position types for DeFi LP management

// EVM Protocols
export type EVMProtocol =
  | 'uniswap-v3'
  | 'uniswap-v2'
  | 'sushiswap'
  | 'curve'
  | 'balancer'
  | 'pancakeswap'
  | 'camelot'
  | 'aerodrome'
  | 'velodrome';

// Solana Protocols
export type SolanaProtocol =
  | 'raydium'
  | 'raydium-clmm'
  | 'orca'
  | 'orca-whirlpool'
  | 'meteora'
  | 'meteora-dlmm'
  | 'lifinity'
  | 'phoenix';

// All Protocols
export type PoolProtocol = EVMProtocol | SolanaProtocol;

// EVM Chains
export type EVMChain =
  | 'ethereum'
  | 'arbitrum'
  | 'optimism'
  | 'polygon'
  | 'base'
  | 'bsc'
  | 'avalanche';

// Non-EVM Chains
export type NonEVMChain =
  | 'solana'
  | 'eclipse'; // Solana L2

// All Chains
export type PoolChain = EVMChain | NonEVMChain;

export type PoolStatus = 'in-range' | 'out-of-range' | 'closed';

export type AutomationType = 'auto-compound' | 'auto-range' | 'auto-exit';

export type NetworkType = 'evm' | 'solana';

export interface TokenInfo {
  symbol: string;
  name: string;
  address: string; // For Solana, this is the mint address
  decimals: number;
  logo?: string;
  price: number;
}

export interface PoolPosition {
  id: string;
  nftId?: string; // For Uniswap V3 style positions (EVM) or Position NFT (Solana CLMM)
  protocol: PoolProtocol;
  chain: PoolChain;
  networkType: NetworkType;

  // Token pair
  token0: TokenInfo;
  token1: TokenInfo;
  feeTier: number; // 0.01%, 0.05%, 0.3%, 1%

  // Position details
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  currentTick: number;

  // Price range (human readable)
  priceLower: number;
  priceUpper: number;
  currentPrice: number;

  // Values
  token0Amount: number;
  token1Amount: number;
  totalValueUsd: number;

  // Performance metrics
  feesEarned: {
    token0: number;
    token1: number;
    totalUsd: number;
  };
  feesUnclaimed: {
    token0: number;
    token1: number;
    totalUsd: number;
  };

  // PnL & IL
  initialValueUsd: number;
  currentValueUsd: number;
  pnlUsd: number;
  pnlPercent: number;
  impermanentLoss: number; // percentage
  impermanentLossUsd: number;
  hodlValueUsd: number; // Value if just held tokens

  // APR/APY
  feeApr: number;
  rewardsApr: number;
  totalApr: number;

  // Status
  status: PoolStatus;
  inRangePercent: number; // % of time in range

  // Dates
  createdAt: string;
  lastUpdated: string;

  // Automation settings
  automation: {
    autoCompound: boolean;
    autoCompoundThreshold?: number; // Min fees in USD to trigger
    autoRange: boolean;
    autoRangePercent?: number; // % out of range to trigger rebalance
    autoExit: boolean;
    autoExitPrice?: number; // Price to trigger exit
    autoExitToken?: 'token0' | 'token1'; // Which token to exit to
  };

  // Rewards (for incentivized pools)
  rewards?: {
    token: TokenInfo;
    amount: number;
    valueUsd: number;
    apr: number;
  }[];
}

export interface PoolMetrics {
  totalLiquidityUsd: number;
  volume24h: number;
  volume7d: number;
  fees24h: number;
  fees7d: number;
  apr24h: number;
  apr7d: number;
  txCount24h: number;
}

export interface PoolInfo {
  address: string;
  protocol: PoolProtocol;
  chain: PoolChain;
  networkType: NetworkType;
  token0: TokenInfo;
  token1: TokenInfo;
  feeTier: number;
  metrics: PoolMetrics;
  tvl: number;
}

export interface BacktestParams {
  poolAddress: string;
  token0Amount: number;
  token1Amount: number;
  priceLower: number;
  priceUpper: number;
  startDate: string;
  endDate: string;
}

export interface BacktestResult {
  totalFeesEarned: number;
  impermanentLoss: number;
  netPnl: number;
  timeInRange: number;
  avgApr: number;
  dailyData: {
    date: string;
    fees: number;
    il: number;
    value: number;
  }[];
}

// Protocol configurations - EVM
export const EVM_PROTOCOL_CONFIG: Record<EVMProtocol, {
  name: string;
  logo: string;
  color: string;
  supportedChains: EVMChain[];
  isConcentrated: boolean;
  networkType: 'evm';
}> = {
  'uniswap-v3': {
    name: 'Uniswap V3',
    logo: 'UNI',
    color: '#ff007a',
    supportedChains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base', 'bsc', 'avalanche'],
    isConcentrated: true,
    networkType: 'evm',
  },
  'uniswap-v2': {
    name: 'Uniswap V2',
    logo: 'UNI',
    color: '#ff007a',
    supportedChains: ['ethereum'],
    isConcentrated: false,
    networkType: 'evm',
  },
  'sushiswap': {
    name: 'SushiSwap',
    logo: 'SUSHI',
    color: '#fa52a0',
    supportedChains: ['ethereum', 'arbitrum', 'polygon', 'avalanche'],
    isConcentrated: false,
    networkType: 'evm',
  },
  'curve': {
    name: 'Curve Finance',
    logo: 'CRV',
    color: '#ff6b6b',
    supportedChains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'avalanche'],
    isConcentrated: false,
    networkType: 'evm',
  },
  'balancer': {
    name: 'Balancer',
    logo: 'BAL',
    color: '#1e1e1e',
    supportedChains: ['ethereum', 'arbitrum', 'polygon', 'avalanche'],
    isConcentrated: false,
    networkType: 'evm',
  },
  'pancakeswap': {
    name: 'PancakeSwap',
    logo: 'CAKE',
    color: '#1fc7d4',
    supportedChains: ['bsc', 'ethereum', 'arbitrum'],
    isConcentrated: true,
    networkType: 'evm',
  },
  'camelot': {
    name: 'Camelot',
    logo: 'GRAIL',
    color: '#ffaf1d',
    supportedChains: ['arbitrum'],
    isConcentrated: true,
    networkType: 'evm',
  },
  'aerodrome': {
    name: 'Aerodrome',
    logo: 'AERO',
    color: '#0052ff',
    supportedChains: ['base'],
    isConcentrated: true,
    networkType: 'evm',
  },
  'velodrome': {
    name: 'Velodrome',
    logo: 'VELO',
    color: '#ff0420',
    supportedChains: ['optimism'],
    isConcentrated: true,
    networkType: 'evm',
  },
};

// Protocol configurations - Solana
export const SOLANA_PROTOCOL_CONFIG: Record<SolanaProtocol, {
  name: string;
  logo: string;
  color: string;
  supportedChains: NonEVMChain[];
  isConcentrated: boolean;
  networkType: 'solana';
  programId: string;
}> = {
  'raydium': {
    name: 'Raydium',
    logo: 'RAY',
    color: '#5ac4be',
    supportedChains: ['solana'],
    isConcentrated: false,
    networkType: 'solana',
    programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  },
  'raydium-clmm': {
    name: 'Raydium CLMM',
    logo: 'RAY',
    color: '#5ac4be',
    supportedChains: ['solana'],
    isConcentrated: true,
    networkType: 'solana',
    programId: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  },
  'orca': {
    name: 'Orca',
    logo: 'ORCA',
    color: '#ffb238',
    supportedChains: ['solana'],
    isConcentrated: false,
    networkType: 'solana',
    programId: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
  },
  'orca-whirlpool': {
    name: 'Orca Whirlpool',
    logo: 'ORCA',
    color: '#ffb238',
    supportedChains: ['solana', 'eclipse'],
    isConcentrated: true,
    networkType: 'solana',
    programId: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  },
  'meteora': {
    name: 'Meteora',
    logo: 'MET',
    color: '#00d4aa',
    supportedChains: ['solana'],
    isConcentrated: false,
    networkType: 'solana',
    programId: 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB',
  },
  'meteora-dlmm': {
    name: 'Meteora DLMM',
    logo: 'MET',
    color: '#00d4aa',
    supportedChains: ['solana'],
    isConcentrated: true,
    networkType: 'solana',
    programId: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  },
  'lifinity': {
    name: 'Lifinity',
    logo: 'LFNTY',
    color: '#00ffcc',
    supportedChains: ['solana'],
    isConcentrated: true,
    networkType: 'solana',
    programId: 'EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S',
  },
  'phoenix': {
    name: 'Phoenix',
    logo: 'PHX',
    color: '#ff6b35',
    supportedChains: ['solana'],
    isConcentrated: false, // Order book based
    networkType: 'solana',
    programId: 'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
  },
};

// Combined Protocol Config
export const PROTOCOL_CONFIG: Record<PoolProtocol, {
  name: string;
  logo: string;
  color: string;
  supportedChains: PoolChain[];
  isConcentrated: boolean;
  networkType: NetworkType;
  programId?: string;
}> = {
  ...EVM_PROTOCOL_CONFIG,
  ...SOLANA_PROTOCOL_CONFIG,
};

// Chain configurations
export const CHAIN_CONFIG: Record<PoolChain, {
  name: string;
  color: string;
  explorer: string;
  networkType: NetworkType;
  rpcEndpoint?: string;
}> = {
  // EVM Chains
  ethereum: {
    name: 'Ethereum',
    color: '#627eea',
    explorer: 'https://etherscan.io',
    networkType: 'evm',
  },
  arbitrum: {
    name: 'Arbitrum',
    color: '#28a0f0',
    explorer: 'https://arbiscan.io',
    networkType: 'evm',
  },
  optimism: {
    name: 'Optimism',
    color: '#ff0420',
    explorer: 'https://optimistic.etherscan.io',
    networkType: 'evm',
  },
  polygon: {
    name: 'Polygon',
    color: '#8247e5',
    explorer: 'https://polygonscan.com',
    networkType: 'evm',
  },
  base: {
    name: 'Base',
    color: '#0052ff',
    explorer: 'https://basescan.org',
    networkType: 'evm',
  },
  bsc: {
    name: 'BNB Chain',
    color: '#f3ba2f',
    explorer: 'https://bscscan.com',
    networkType: 'evm',
  },
  avalanche: {
    name: 'Avalanche',
    color: '#e84142',
    explorer: 'https://snowtrace.io',
    networkType: 'evm',
  },
  // Solana Chains
  solana: {
    name: 'Solana',
    color: '#9945ff',
    explorer: 'https://solscan.io',
    networkType: 'solana',
    rpcEndpoint: 'https://api.mainnet-beta.solana.com',
  },
  eclipse: {
    name: 'Eclipse',
    color: '#14f195',
    explorer: 'https://explorer.eclipse.xyz',
    networkType: 'solana',
  },
};

// Integration APIs for data fetching
export interface IntegrationAPI {
  name: string;
  description: string;
  baseUrl: string;
  supportedChains: PoolChain[];
  features: string[];
}

export const INTEGRATION_APIS: IntegrationAPI[] = [
  {
    name: 'DeFiLlama',
    description: 'Multi-chain TVL and yields aggregator',
    baseUrl: 'https://api.llama.fi',
    supportedChains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base', 'bsc', 'avalanche', 'solana'],
    features: ['TVL', 'Yields', 'Pool APY', 'Historical Data'],
  },
  {
    name: 'Bitquery',
    description: 'Blockchain data API with DEX pools support',
    baseUrl: 'https://graphql.bitquery.io',
    supportedChains: ['ethereum', 'bsc', 'solana'],
    features: ['Real-time pools', 'Liquidity events', 'Trading volume'],
  },
  {
    name: 'Jupiter',
    description: 'Solana DEX aggregator',
    baseUrl: 'https://quote-api.jup.ag',
    supportedChains: ['solana'],
    features: ['Best routes', 'Price quotes', 'Swap execution'],
  },
  {
    name: 'Orca Whirlpool',
    description: 'Orca concentrated liquidity SDK',
    baseUrl: 'https://api.orca.so',
    supportedChains: ['solana', 'eclipse'],
    features: ['Pool data', 'Position management', 'Fees tracking'],
  },
  {
    name: '1inch',
    description: 'Cross-chain DEX aggregator',
    baseUrl: 'https://api.1inch.dev',
    supportedChains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base', 'bsc', 'avalanche', 'solana'],
    features: ['Cross-chain swaps', 'Best rates', 'Liquidity aggregation'],
  },
  {
    name: 'LI.FI',
    description: 'Bridge and DEX aggregation protocol',
    baseUrl: 'https://li.quest/v1',
    supportedChains: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base', 'bsc', 'avalanche', 'solana'],
    features: ['Cross-chain bridges', 'DEX aggregation', 'Route optimization'],
  },
];

// Helper functions
export function isEVMChain(chain: PoolChain): chain is EVMChain {
  return CHAIN_CONFIG[chain].networkType === 'evm';
}

export function isSolanaChain(chain: PoolChain): chain is NonEVMChain {
  return CHAIN_CONFIG[chain].networkType === 'solana';
}

export function isEVMProtocol(protocol: PoolProtocol): protocol is EVMProtocol {
  return PROTOCOL_CONFIG[protocol].networkType === 'evm';
}

export function isSolanaProtocol(protocol: PoolProtocol): protocol is SolanaProtocol {
  return PROTOCOL_CONFIG[protocol].networkType === 'solana';
}

export function getProtocolsForChain(chain: PoolChain): PoolProtocol[] {
  return Object.entries(PROTOCOL_CONFIG)
    .filter(([, config]) => config.supportedChains.includes(chain))
    .map(([protocol]) => protocol as PoolProtocol);
}

export function getChainsForProtocol(protocol: PoolProtocol): PoolChain[] {
  return PROTOCOL_CONFIG[protocol].supportedChains;
}
