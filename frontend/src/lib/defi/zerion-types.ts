// Zerion API Types
// Documentation: https://developers.zerion.io/reference

export interface ZerionPosition {
  type: 'positions';
  id: string;
  attributes: {
    parent: string | null;
    protocol: string;
    name: string;
    position_type: ZerionPositionType;
    quantity: {
      int: string;
      decimals: number;
      float: number;
      numeric: string;
    };
    value: number | null;
    price: number;
    changes: {
      absolute_1d: number | null;
      percent_1d: number | null;
    } | null;
    fungible_info: {
      name: string;
      symbol: string;
      icon: {
        url: string;
      } | null;
      flags: {
        verified: boolean;
      };
      implementations: {
        chain_id: string;
        address: string | null;
        decimals: number;
      }[];
    };
    flags: {
      displayable: boolean;
    };
    updated_at: string;
    updated_at_block: number;
  };
  relationships: {
    chain: {
      data: {
        type: 'chains';
        id: string;
      };
    };
    dapp: {
      data: {
        type: 'dapps';
        id: string;
      } | null;
    };
  };
}

export type ZerionPositionType =
  | 'wallet'      // Simple token balance
  | 'deposit'     // Lending supply / deposits
  | 'loan'        // Lending borrows
  | 'staked'      // Staking positions
  | 'locked'      // Locked/vesting tokens
  | 'liquidity'   // LP positions
  | 'reward'      // Claimable rewards
  | 'airdrop'     // Airdrops
  | 'nft';        // NFT positions

export interface ZerionChain {
  type: 'chains';
  id: string;
  attributes: {
    external_id: string;
    name: string;
    icon: {
      url: string;
    };
    explorer: {
      name: string;
      url: string;
      token_url_format: string;
      tx_url_format: string;
    };
    flags: {
      supports_trading: boolean;
      supports_sending: boolean;
    };
  };
}

export interface ZerionDapp {
  type: 'dapps';
  id: string;
  attributes: {
    name: string;
    description: string | null;
    icon: {
      url: string;
    } | null;
    url: string | null;
    categories: string[];
  };
}

export interface ZerionPositionsResponse {
  links: {
    self: string;
    next?: string;
  };
  data: ZerionPosition[];
  included?: (ZerionChain | ZerionDapp)[];
}

// Our normalized types for the app
export type DeFiCategory = 'lending' | 'lp' | 'staking' | 'yield' | 'derivatives' | 'claimable' | 'other';

export interface NormalizedDeFiPosition {
  id: string;

  // Protocol info
  protocol: string;
  protocolIcon?: string;
  protocolUrl?: string;

  // Chain info
  chain: string;
  chainId: string;
  chainIcon?: string;

  // Position type
  category: DeFiCategory;
  positionType: ZerionPositionType;
  positionName: string;

  // Asset info
  asset: {
    name: string;
    symbol: string;
    icon?: string;
    address?: string;
    decimals: number;
  };

  // Values
  quantity: number;
  valueUsd: number;
  priceUsd: number;

  // Changes
  change24h?: {
    absolute: number;
    percent: number;
  };

  // APY/APR data (enriched from DeFiLlama)
  apy?: {
    total: number;      // Total APY (base + reward)
    base: number;       // APY from fees/supply
    reward: number;     // APY from token rewards
    hasRewards: boolean;
    mean30d?: number;   // 30-day average APY
  };

  // Lending specific
  lending?: {
    ltv?: number;       // Loan-to-value ratio
    totalSupplyUsd?: number;
    totalBorrowUsd?: number;
    borrowApy?: number;
    borrowApyReward?: number;
  };

  // LP specific
  lp?: {
    il7d?: number;      // 7-day impermanent loss
    volume24h?: number;
    volume7d?: number;
    tvlUsd?: number;
    underlyingTokens?: string[];
  };

  // Pool metadata from DeFiLlama
  poolMeta?: {
    defiLlamaId?: string;
    url?: string;
    stablecoin?: boolean;
    ilRisk?: string;
    exposure?: string;
  };

  // LP token components (populated during Zerion LP grouping)
  lpTokenAmounts?: {
    symbol: string;
    name: string;
    icon?: string;
    address?: string;
    decimals: number;
    amount: number;
    valueUsd: number;
    priceUsd: number;
  }[];

  // Metadata
  isVerified: boolean;
  updatedAt: string;
}

export interface DeFiPositionsSummary {
  totalValueUsd: number;

  // By category
  lendingSupplyUsd: number;
  lendingBorrowUsd: number;
  lpValueUsd: number;
  stakingValueUsd: number;
  yieldValueUsd: number;
  claimableUsd: number;
  otherValueUsd: number;

  // APY metrics
  weightedAvgApy: number; // Weighted average APY across all positions
  totalAnnualYield: number; // Estimated annual yield in USD

  // Counts
  totalPositions: number;
  positionsWithApy: number;
  protocolsUsed: string[];
  chainsUsed: string[];
}

// Chain ID mapping
export const ZERION_CHAIN_IDS: Record<string, string> = {
  'ethereum': 'ethereum',
  'base': 'base',
  'arbitrum': 'arbitrum-one',
  'optimism': 'optimism',
  'polygon': 'polygon',
  'avalanche': 'avalanche',
  'bsc': 'binance-smart-chain',
};

// AMM/DEX protocols that Zerion may classify as 'deposit' but are actually LP positions
const LP_PROTOCOLS = [
  'uniswap', 'sushiswap', 'sushi', 'pancakeswap', 'pancake',
  'curve', 'balancer', 'camelot', 'aerodrome', 'velodrome',
  'trader joe', 'quickswap', 'spookyswap', 'beethoven',
  'raydium', 'orca', 'meteora', 'lifinity', 'phoenix',
  'maverick', 'ambient', 'thruster', 'kim', 'ramses',
  'fenix', 'lynex', 'nile', 'thena', 'retro',
];

// Position type to category mapping
export function mapPositionTypeToCategory(positionType: ZerionPositionType, protocol: string): DeFiCategory {
  const lowerProtocol = protocol.toLowerCase();

  // Derivatives protocols
  if (lowerProtocol.includes('gmx') || lowerProtocol.includes('dydx') || lowerProtocol.includes('perpetual')) {
    return 'derivatives';
  }

  // Yield aggregators
  if (lowerProtocol.includes('convex') || lowerProtocol.includes('yearn') || lowerProtocol.includes('beefy')) {
    return 'yield';
  }

  // AMM/DEX protocols: Zerion often classifies LP positions as 'deposit'
  // Override to 'lp' when the protocol is a known AMM/DEX
  if (positionType === 'deposit' && LP_PROTOCOLS.some(lp => lowerProtocol.includes(lp))) {
    return 'lp';
  }

  // Default mapping by position type
  switch (positionType) {
    case 'deposit':
    case 'loan':
      return 'lending';
    case 'liquidity':
      return 'lp';
    case 'staked':
      return 'staking';
    case 'locked':
      return 'other';
    case 'reward':
    case 'airdrop':
      return 'claimable';
    default:
      return 'other';
  }
}
