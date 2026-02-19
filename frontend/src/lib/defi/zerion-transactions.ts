// Zerion Transactions API Service
// Documentation: https://developers.zerion.io/reference/listwallettransactions

// API Configuration
const ZERION_API_BASE = 'https://api.zerion.io/v1';
const ZERION_API_KEY = process.env.NEXT_PUBLIC_ZERION_API_KEY || '';

// Helper to create auth header
function getAuthHeader(): string {
  return `Basic ${btoa(ZERION_API_KEY + ':')}`;
}

// Check if API key exists
function hasApiKey(): boolean {
  return ZERION_API_KEY.length > 0;
}

// ============ Types ============

export interface ZerionTransactionFee {
  fungible_id: string;
  quantity: {
    int: string;
    decimals: number;
    float: number;
    numeric: string;
  };
  price: number;
  value: number;
}

export interface ZerionTransactionTransfer {
  fungible_info: {
    name: string;
    symbol: string;
    icon: {
      url: string;
    } | null;
    flags: {
      verified: boolean;
    };
    implementations: Array<{
      chain_id: string;
      address: string | null;
      decimals: number;
    }>;
  };
  direction: 'in' | 'out' | 'self';
  quantity: {
    int: string;
    decimals: number;
    float: number;
    numeric: string;
  };
  value: number | null;
  price: number | null;
  sender: string;
  recipient: string;
}

export interface ZerionTransactionAttributes {
  operation_type:
    | 'trade'
    | 'send'
    | 'receive'
    | 'approve'
    | 'mint'
    | 'burn'
    | 'deposit'
    | 'withdraw'
    | 'stake'
    | 'unstake'
    | 'claim'
    | 'borrow'
    | 'repay'
    | 'execute'
    | 'deploy'
    | 'bridge';
  hash: string;
  mined_at_block: number;
  mined_at: string; // ISO timestamp
  sent_from: string;
  sent_to: string;
  status: 'confirmed' | 'pending' | 'failed';
  nonce: number;
  fee: ZerionTransactionFee | null;
  transfers: ZerionTransactionTransfer[];
  approvals: Array<{
    fungible_info: {
      name: string;
      symbol: string;
    };
    quantity: {
      float: number;
    };
    sender: string;
  }>;
  application_metadata: {
    name: string;
    icon: {
      url: string;
    } | null;
  } | null;
}

export interface ZerionTransaction {
  type: 'transactions';
  id: string;
  attributes: ZerionTransactionAttributes;
  relationships: {
    chain: {
      data: {
        type: 'chains';
        id: string;
      };
    };
  };
}

export interface ZerionChainInfo {
  type: 'chains';
  id: string;
  attributes: {
    name: string;
    icon: {
      url: string;
    } | null;
  };
}

export interface ZerionTransactionsResponse {
  links: {
    self: string;
    next?: string;
  };
  data: ZerionTransaction[];
  included?: ZerionChainInfo[];
}

// Normalized transaction for our app
export interface NormalizedTransaction {
  id: string;
  hash: string;
  type: 'buy' | 'sell' | 'transfer_in' | 'transfer_out' | 'swap' | 'stake' | 'unstake' | 'claim' | 'approve' | 'other';
  status: 'confirmed' | 'pending' | 'failed';

  // Primary asset info
  asset: string;
  symbol: string;
  icon?: string;
  amount: number;
  value: number;

  // For swaps - secondary asset
  toAsset?: string;
  toSymbol?: string;
  toIcon?: string;
  toAmount?: number;

  // Location/Protocol
  location: string;
  locationIcon?: string;

  // Chain
  chain: string;
  chainId: string;
  chainIcon?: string;

  // Timestamps
  timestamp: string;
  relativeTime: string;

  // Addresses
  from: string;
  to: string;

  // Fee
  fee?: {
    amount: number;
    value: number;
    symbol: string;
  };
}

// ============ Helper Functions ============

/**
 * Map Zerion operation type to our transaction type
 */
function mapOperationType(
  operationType: string,
  transfers: ZerionTransactionTransfer[]
): NormalizedTransaction['type'] {
  switch (operationType) {
    case 'trade':
      return 'swap';
    case 'send':
      return 'transfer_out';
    case 'receive':
      return 'transfer_in';
    case 'stake':
    case 'deposit':
      return 'stake';
    case 'unstake':
    case 'withdraw':
      return 'unstake';
    case 'claim':
      return 'claim';
    case 'approve':
      return 'approve';
    case 'mint':
      // Check if it's a buy (received tokens for ETH/stablecoin)
      const hasIncoming = transfers.some(t => t.direction === 'in');
      const hasOutgoing = transfers.some(t => t.direction === 'out');
      if (hasIncoming && hasOutgoing) return 'swap';
      if (hasIncoming) return 'buy';
      return 'other';
    case 'burn':
      return 'sell';
    default:
      // Determine from transfers
      const inTransfers = transfers.filter(t => t.direction === 'in');
      const outTransfers = transfers.filter(t => t.direction === 'out');

      if (inTransfers.length > 0 && outTransfers.length > 0) {
        return 'swap';
      } else if (inTransfers.length > 0) {
        return 'transfer_in';
      } else if (outTransfers.length > 0) {
        return 'transfer_out';
      }
      return 'other';
  }
}

/**
 * Calculate relative time string
 */
function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const txTime = new Date(timestamp);
  const diffMs = now.getTime() - txTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return txTime.toLocaleDateString();
}

/**
 * Get chain info from included data
 */
function getChainFromIncluded(
  chainId: string,
  included?: ZerionChainInfo[]
): ZerionChainInfo | undefined {
  if (!included) return undefined;
  return included.find(item => item.type === 'chains' && item.id === chainId);
}

/**
 * Normalize a Zerion transaction
 */
export function normalizeTransaction(
  tx: ZerionTransaction,
  included?: ZerionChainInfo[]
): NormalizedTransaction {
  const { attributes, relationships } = tx;
  const transfers = attributes.transfers || [];

  // Get chain info
  const chainId = relationships.chain.data.id;
  const chain = getChainFromIncluded(chainId, included);

  // Determine transaction type
  const type = mapOperationType(attributes.operation_type, transfers);

  // Get primary transfer (usually the most valuable incoming or outgoing)
  const inTransfers = transfers.filter(t => t.direction === 'in');
  const outTransfers = transfers.filter(t => t.direction === 'out');

  // For swaps, primary is what we sent, secondary is what we received
  // For others, primary is the main transfer
  let primaryTransfer: ZerionTransactionTransfer | undefined;
  let secondaryTransfer: ZerionTransactionTransfer | undefined;

  if (type === 'swap' && outTransfers.length > 0 && inTransfers.length > 0) {
    // Sort by value to get the main assets
    primaryTransfer = outTransfers.sort((a, b) => (b.value || 0) - (a.value || 0))[0];
    secondaryTransfer = inTransfers.sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  } else if (inTransfers.length > 0) {
    primaryTransfer = inTransfers.sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  } else if (outTransfers.length > 0) {
    primaryTransfer = outTransfers.sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  }

  // Build normalized transaction
  const normalized: NormalizedTransaction = {
    id: tx.id,
    hash: attributes.hash,
    type,
    status: attributes.status,

    // Primary asset
    asset: primaryTransfer?.fungible_info.name || 'Unknown',
    symbol: primaryTransfer?.fungible_info.symbol || '???',
    icon: primaryTransfer?.fungible_info.icon?.url,
    amount: primaryTransfer?.quantity.float || 0,
    value: primaryTransfer?.value || 0,

    // Location (dApp or address)
    location: attributes.application_metadata?.name ||
              (attributes.sent_to ? `${attributes.sent_to.slice(0, 6)}...${attributes.sent_to.slice(-4)}` : 'Unknown'),
    locationIcon: attributes.application_metadata?.icon?.url,

    // Chain
    chain: chain?.attributes.name || chainId,
    chainId,
    chainIcon: chain?.attributes.icon?.url,

    // Timestamps
    timestamp: attributes.mined_at,
    relativeTime: getRelativeTime(attributes.mined_at),

    // Addresses
    from: attributes.sent_from,
    to: attributes.sent_to,
  };

  // Add secondary asset for swaps
  if (type === 'swap' && secondaryTransfer) {
    normalized.toAsset = secondaryTransfer.fungible_info.name;
    normalized.toSymbol = secondaryTransfer.fungible_info.symbol;
    normalized.toIcon = secondaryTransfer.fungible_info.icon?.url;
    normalized.toAmount = secondaryTransfer.quantity.float;
  }

  // Add fee info
  if (attributes.fee) {
    normalized.fee = {
      amount: attributes.fee.quantity.float,
      value: attributes.fee.value,
      symbol: 'ETH', // Usually ETH for EVM chains
    };
  }

  return normalized;
}

// ============ API Functions ============

/**
 * Fetch transactions for a wallet address
 */
export async function fetchWalletTransactions(
  walletAddress: string,
  options?: {
    currency?: string;
    pageSize?: number;
    pageAfter?: string;
  }
): Promise<ZerionTransactionsResponse> {
  if (!hasApiKey()) {
    throw new Error('Zerion API key not configured');
  }

  const params = new URLSearchParams({
    'currency': options?.currency || 'usd',
    'page[size]': String(options?.pageSize || 20),
    'filter[trash]': 'only_non_trash',
  });

  if (options?.pageAfter) {
    params.append('page[after]', options.pageAfter);
  }

  const url = `${ZERION_API_BASE}/wallets/${walletAddress}/transactions/?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': getAuthHeader(),
    },
  });

  if (!response.ok) {
    // Check for specific error codes
    if (response.status === 401) {
      throw new Error('API_KEY_UNAUTHORIZED: Zerion API key does not have access to transactions endpoint. Upgrade your plan or use a production API key.');
    }
    if (response.status === 403) {
      throw new Error('API_KEY_FORBIDDEN: Transactions endpoint requires a paid Zerion plan.');
    }
    const errorText = await response.text();
    throw new Error(`Zerion API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch and normalize transactions
 */
export async function getWalletTransactions(
  walletAddress: string,
  options?: {
    limit?: number;
  }
): Promise<NormalizedTransaction[]> {
  const response = await fetchWalletTransactions(walletAddress, {
    pageSize: options?.limit || 20,
  });

  return response.data.map(tx => normalizeTransaction(tx, response.included));
}
