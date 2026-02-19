// Solana Token Types

export interface SolanaToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  priceUsd: number;
  valueUsd: number;
  logoUrl?: string;
  isNative: boolean;
}

export interface SolanaTransaction {
  signature: string;
  timestamp: number;
  type: 'TRANSFER' | 'SWAP' | 'STAKE' | 'UNSTAKE' | 'NFT_SALE' | 'UNKNOWN';
  fee: number;
  status: 'success' | 'failed';
  description: string;
  tokenTransfers: TokenTransfer[];
}

export interface TokenTransfer {
  mint: string;
  symbol: string;
  amount: number;
  fromUserAccount: string;
  toUserAccount: string;
}

export interface SolanaDeFiPosition {
  protocol: string;
  protocolLogo?: string;
  type: 'staking' | 'liquidity' | 'lending';
  tokens: SolanaToken[];
  valueUsd: number;
  apy?: number;
  rewards?: SolanaToken[];
}

// Helius API Types
export interface HeliusAsset {
  interface: string;
  id: string;
  content: {
    $schema: string;
    json_uri: string;
    files: { uri: string; mime: string }[];
    metadata: {
      name: string;
      symbol: string;
      description?: string;
    };
    links?: {
      image?: string;
      external_url?: string;
    };
  };
  authorities: { address: string; scopes: string[] }[];
  compression?: {
    eligible: boolean;
    compressed: boolean;
  };
  grouping: { group_key: string; group_value: string }[];
  royalty?: {
    royalty_model: string;
    target: null;
    percent: number;
    basis_points: number;
    primary_sale_happened: boolean;
    locked: boolean;
  };
  creators?: { address: string; share: number; verified: boolean }[];
  ownership: {
    frozen: boolean;
    delegated: boolean;
    delegate: null | string;
    ownership_model: string;
    owner: string;
  };
  supply: null | {
    print_max_supply: number;
    print_current_supply: number;
    edition_nonce: number;
  };
  mutable: boolean;
  burnt: boolean;
  token_info?: {
    symbol: string;
    balance: number;
    supply: number;
    decimals: number;
    token_program: string;
    associated_token_address: string;
    price_info?: {
      price_per_token: number;
      total_price: number;
      currency: string;
    };
  };
}

export interface HeliusAssetsResponse {
  total: number;
  limit: number;
  page: number;
  items: HeliusAsset[];
  nativeBalance?: {
    lamports: number;
    price_per_sol: number;
    total_price: number;
  };
}

export interface HeliusTransaction {
  signature: string;
  slot: number;
  timestamp: number;
  type: string;
  fee: number;
  feePayer: string;
  description: string;
  tokenTransfers: {
    mint: string;
    tokenAmount: number;
    fromUserAccount: string;
    toUserAccount: string;
    tokenStandard: string;
  }[];
  nativeTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }[];
  accountData: {
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges: {
      mint: string;
      rawTokenAmount: {
        tokenAmount: string;
        decimals: number;
      };
      userAccount: string;
    }[];
  }[];
}
