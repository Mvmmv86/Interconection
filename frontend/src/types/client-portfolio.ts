// Client Portfolio Types

export interface Client {
  id: string;
  name: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  color: string; // For UI identification
}

export interface ClientWallet {
  id: string;
  clientId: string;
  address: string;
  network: 'evm' | 'solana';
  chain?: string; // ethereum, arbitrum, solana, etc
  label: string;
  isActive: boolean;
  addedAt: string;
}

export interface ClientExchange {
  id: string;
  clientId: string;
  exchange: string; // binance, coinbase, kraken, etc
  label: string;
  apiKeyMasked: string; // Show only last 4 chars
  isActive: boolean;
  addedAt: string;
  lastSync?: string;
}

export interface ManualAsset {
  id: string;
  clientId: string;
  token: string; // Symbol: ETH, SOL, BTC
  tokenName: string;
  network: 'evm' | 'solana' | 'bitcoin' | 'other';
  quantity: number;
  purchasePrice: number; // Price per unit at purchase
  purchaseDate: string;
  currentPrice?: number;
  notes?: string;
  type: 'holding' | 'staking' | 'lending' | 'lp';
  stakingProvider?: string; // Lido, Marinade, Jito, etc
  apy?: number;
  addedAt: string;
  updatedAt: string;
}

export interface DetectedStakingPosition {
  id: string;
  clientId: string;
  walletId: string;
  protocol: string; // Lido, Marinade, Jito, Jupiter, Kamino, Meteora
  token: string;
  stakedToken: string; // stETH, mSOL, JitoSOL
  amount: number;
  valueUsd: number;
  apy: number;
  rewards: {
    pending: number;
    pendingUsd: number;
    claimed: number;
  };
  type: 'liquid' | 'locked' | 'validator';
  unlockDate?: string;
  autoCompound: boolean;
  detectedAt: string;
  lastUpdated: string;
}

export interface ClientPortfolioSummary {
  clientId: string;
  totalValueUsd: number;
  totalStakedUsd: number;
  totalHoldingUsd: number;
  totalLpUsd: number;
  totalPnlUsd: number;
  totalPnlPercent: number;
  pendingRewardsUsd: number;
  averageApy: number;
  assetCount: number;
  walletCount: number;
  exchangeCount: number;
}

export interface ClientPortfolio {
  client: Client;
  wallets: ClientWallet[];
  exchanges: ClientExchange[];
  manualAssets: ManualAsset[];
  detectedPositions: DetectedStakingPosition[];
  summary: ClientPortfolioSummary;
}

// Supported staking protocols for auto-detection
export const STAKING_PROTOCOLS = {
  // EVM
  lido: {
    name: 'Lido',
    token: 'stETH',
    network: 'evm',
    type: 'liquid',
    color: '#00A3FF',
  },
  rocketpool: {
    name: 'Rocket Pool',
    token: 'rETH',
    network: 'evm',
    type: 'liquid',
    color: '#FF6B4A',
  },
  coinbase: {
    name: 'Coinbase',
    token: 'cbETH',
    network: 'evm',
    type: 'liquid',
    color: '#0052FF',
  },
  frax: {
    name: 'Frax',
    token: 'sfrxETH',
    network: 'evm',
    type: 'liquid',
    color: '#000000',
  },
  // Solana
  marinade: {
    name: 'Marinade',
    token: 'mSOL',
    network: 'solana',
    type: 'liquid',
    color: '#36D6AE',
  },
  jito: {
    name: 'Jito',
    token: 'JitoSOL',
    network: 'solana',
    type: 'liquid',
    color: '#8B5CF6',
  },
  blazestake: {
    name: 'BlazeStake',
    token: 'bSOL',
    network: 'solana',
    type: 'liquid',
    color: '#F7931A',
  },
  sanctum: {
    name: 'Sanctum',
    token: 'INF',
    network: 'solana',
    type: 'liquid',
    color: '#00D395',
  },
  // DeFi Protocols (Solana)
  jupiter: {
    name: 'Jupiter',
    token: 'JUP',
    network: 'solana',
    type: 'staking',
    color: '#00D395',
  },
  kamino: {
    name: 'Kamino',
    token: 'KMNO',
    network: 'solana',
    type: 'lending',
    color: '#FF6B6B',
  },
  meteora: {
    name: 'Meteora',
    token: 'MET',
    network: 'solana',
    type: 'lp',
    color: '#00D4AA',
  },
} as const;

export type StakingProtocol = keyof typeof STAKING_PROTOCOLS;

// Client colors for UI
export const CLIENT_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Purple
  '#85C1E9', // Sky Blue
];

export function getRandomClientColor(): string {
  return CLIENT_COLORS[Math.floor(Math.random() * CLIENT_COLORS.length)];
}

// Supported exchanges
export const SUPPORTED_EXCHANGES = [
  'binance',
  'coinbase',
  'kraken',
  'bybit',
  'okx',
  'kucoin',
  'gateio',
  'mexc',
] as const;

export type SupportedExchange = typeof SUPPORTED_EXCHANGES[number];
