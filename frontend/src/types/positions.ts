/**
 * Unified Position Types for /positions page
 * Aggregates data from DeFi, Exchanges, and Wallets
 */

// Position location types
export type PositionLocationType = 'exchange' | 'defi' | 'wallet' | 'staking' | 'cold_wallet';

// Position categories for distribution
export type PositionCategory = 'spot' | 'defi' | 'staking' | 'pools' | 'futures' | 'earn' | 'funding' | 'margin' | 'other';

// Unified position interface for the table
export interface UnifiedPosition {
  id: string;

  // Asset info
  asset: string;
  symbol: string;
  icon?: string;

  // Quantities and prices
  quantity: number;
  avgPrice?: number; // Not always available
  currentPrice: number;
  value: number; // In USD

  // P&L (when available)
  pnl?: number;
  pnlPercent?: number;

  // Allocation
  allocation: number; // Percentage of total portfolio

  // Location
  location: string; // e.g., "Binance", "Aave V3", "Ledger"
  locationType: PositionLocationType;

  // Chain
  chain: string;
  chainId?: string;

  // Category for filtering
  category: PositionCategory;

  // Additional metadata
  protocol?: string;
  protocolIcon?: string;
  positionType?: string; // Original position type (deposit, stake, liquidity, etc.)
  apy?: number;

  // Exchange-specific fields (for futures/margin)
  side?: 'long' | 'short';
  leverage?: number;
  unrealizedPnl?: number;
  entryPrice?: number;
  liquidationPrice?: number;
  accountType?: string; // spot, futures, margin, earn, funding

  // Timestamps
  updatedAt?: string;
}

// Summary for the top cards
export interface PositionsSummary {
  // Main totals
  totalValue: number;
  exchangeHoldings: number;
  defiPositions: number;
  stakingAndYield: number;
  coldWallets: number;

  // Position counts
  totalPositionCount: number;
  exchangeCount: number;
  protocolCount: number;
  walletCount: number;

  // Performance
  totalChange24h?: number;
  totalChangePercent24h?: number;
  avgApy?: number;
}

// Distribution data for charts
export interface DistributionByType {
  label: string;
  value: number; // Percentage
  amount: number; // Absolute value in USD
  color: string;
}

export interface DistributionByChain {
  label: string;
  chainId: string;
  value: number; // Percentage
  amount: number; // Absolute value in USD
  color: string;
  icon?: string;
}

// Location group for cards
export interface LocationGroup {
  id: string;
  name: string;
  type: PositionLocationType;
  value: number;
  positions: number;
  change24h?: number;
  topAssets: string[];
  icon?: string;
  logo?: string;
  chain?: string;
}

// Exchange data
export interface ExchangeData {
  id: string;
  name: string;
  logo: string;
  status: 'connected' | 'syncing' | 'error' | 'disconnected';
  lastSync?: string;
  totalValue: number;
  spotValue: number;
  marginValue: number;
  futuresValue: number;
  fundingValue?: number;
  earnValue?: number;
  positionCount: number;
  hasSubaccounts?: boolean;
  subaccountsCount?: number;
  subaccountsValue?: number;
  topAssets: Array<{ symbol: string; value: number }>;
}

// Wallet data
export interface WalletData {
  id: string;
  address: string;
  name?: string;
  type: 'hot' | 'cold' | 'hardware';
  chain: string;
  totalValue: number;
  positionCount: number;
  topAssets: Array<{ symbol: string; value: number }>;
  lastActivity?: string;
}

// Protocol data for DeFi
export interface ProtocolData {
  id: string;
  name: string;
  icon?: string;
  url?: string;
  chains: string[];
  totalValue: number;
  positionCount: number;
  positions: Array<{
    type: string;
    asset: string;
    value: number;
    apy?: number;
  }>;
}

// Staking data
export interface StakingData {
  id: string;
  protocol: string;
  protocolIcon?: string;
  source: 'exchange' | 'dex' | 'native';
  asset: string;
  symbol: string;
  stakedAmount: number;
  stakedValue: number;
  apy?: number;
  rewards?: {
    pending: number;
    pendingValue: number;
  };
  chain: string;
}

// Exchange transaction
export interface ExchangeTransactionData {
  id: string;
  exchangeId: string;
  exchange: string;
  exchangeName: string;
  exchangeLabel: string;
  type: 'deposit' | 'withdrawal' | 'internal_transfer';
  coin: string;
  amount: number;
  fee: number;
  valueUsd: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  txId?: string;
  fromAccount?: string;
  toAccount?: string;
  chain?: string;
  address?: string;
  timestamp: string;
}

// Complete return type for useAllPositions hook
export interface AllPositionsData {
  // All positions in unified format
  positions: UnifiedPosition[];

  // Summary for top cards
  summary: PositionsSummary;

  // Distribution data
  distributionByType: DistributionByType[];
  distributionByChain: DistributionByChain[];

  // Location groups
  exchanges: ExchangeData[];
  protocols: ProtocolData[];
  wallets: WalletData[];
  stakingPositions: StakingData[];

  // Loading states
  isLoading: boolean;
  isLoadingExchanges: boolean;
  isLoadingDefi: boolean;
  isLoadingWallets: boolean;

  // Error states
  error: Error | null;

  // Actions
  refetch: () => void;

  // Filters
  filterByType: (type: PositionCategory | 'all') => UnifiedPosition[];
  filterByChain: (chain: string | 'all') => UnifiedPosition[];
  filterByLocation: (locationType: PositionLocationType | 'all') => UnifiedPosition[];
}

// Chain color mapping
export const CHAIN_COLORS: Record<string, string> = {
  'ethereum': '#627eea',
  'bitcoin': '#f7931a',
  'solana': '#00ffa3',
  'arbitrum': '#28a0f0',
  'polygon': '#8247e5',
  'optimism': '#ff0420',
  'base': '#0052ff',
  'avalanche': '#e84142',
  'bsc': '#f3ba2f',
  'cex': '#f59e0b',
  'default': '#64748b',
};

// Category color mapping
export const CATEGORY_COLORS: Record<PositionCategory, string> = {
  'spot': '#3b82f6',     // Blue
  'defi': '#a855f7',     // Purple
  'staking': '#22c55e',  // Green
  'pools': '#00d4ff',    // Cyan
  'futures': '#ef4444',  // Red
  'earn': '#10b981',     // Emerald
  'funding': '#6366f1',  // Indigo
  'margin': '#f59e0b',   // Amber
  'other': '#f97316',    // Orange
};
