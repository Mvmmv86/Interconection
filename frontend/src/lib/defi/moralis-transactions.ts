// Moralis Transactions API Service (Fallback)
// Documentation: https://docs.moralis.io/web3-data-api/evm/reference/wallet-api/get-wallet-history

const MORALIS_API_BASE = 'https://deep-index.moralis.io/api/v2.2';
const MORALIS_API_KEY = process.env.NEXT_PUBLIC_MORALIS_API_KEY || '';

const CHAIN_NAMES: Record<string, string> = {
  '0x1': 'Ethereum',
  '0x89': 'Polygon',
  '0x38': 'BNB Chain',
  '0xa4b1': 'Arbitrum',
  '0xa': 'Optimism',
  '0xa86a': 'Avalanche',
  '0x2105': 'Base',
  '0xfa': 'Fantom',
};

// ============ Types ============

export interface MoralisNativeTransfer {
  from_address: string;
  to_address: string;
  value: string;
  value_formatted: string;
  direction: 'send' | 'receive';
  internal_transaction: boolean;
  token_symbol: string;
  token_logo: string;
}

export interface MoralisErc20Transfer {
  token_name: string;
  token_symbol: string;
  token_logo: string;
  token_decimals: string;
  from_address: string;
  to_address: string;
  address: string; // contract address
  value: string;
  value_formatted: string;
  direction: 'send' | 'receive';
  possible_spam: boolean;
  verified_contract: boolean;
}

export interface MoralisNftTransfer {
  token_name: string;
  token_symbol: string;
  collection_logo: string;
  token_id: string;
  contract_type: string;
  from_address: string;
  to_address: string;
  direction: 'send' | 'receive';
  possible_spam: boolean;
}

export interface MoralisTransaction {
  hash: string;
  nonce: string;
  transaction_index: string;
  from_address: string;
  to_address: string;
  value: string;
  gas: string;
  gas_price: string;
  receipt_gas_used: string;
  receipt_status: string;
  block_timestamp: string;
  block_number: string;
  block_hash: string;
  method_label: string | null;
  summary: string;
  category: 'send' | 'receive' | 'token send' | 'token receive' | 'nft send' | 'nft receive' | 'token swap' | 'deposit' | 'withdraw' | 'airdrop' | 'mint' | 'burn' | 'contract interaction' | 'token approval';
  possible_spam: boolean;
  native_transfers: MoralisNativeTransfer[];
  erc20_transfers: MoralisErc20Transfer[];
  nft_transfers: MoralisNftTransfer[];
}

export interface MoralisTransactionsResponse {
  page_size: number;
  page: number;
  cursor: string | null;
  result: MoralisTransaction[];
}

// Reuse NormalizedTransaction type from zerion-transactions
import type { NormalizedTransaction } from './zerion-transactions';

// ============ Helper Functions ============

function hasApiKey(): boolean {
  return MORALIS_API_KEY.length > 0;
}

/**
 * Map Moralis category to our transaction type
 */
function mapMoralisCategory(
  category: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tx: MoralisTransaction
): NormalizedTransaction['type'] {
  switch (category) {
    case 'send':
      return 'transfer_out';
    case 'receive':
      return 'transfer_in';
    case 'token send':
      return 'transfer_out';
    case 'token receive':
      return 'transfer_in';
    case 'token swap':
      return 'swap';
    case 'deposit':
      return 'stake';
    case 'withdraw':
      return 'unstake';
    case 'airdrop':
      return 'claim';
    case 'mint':
      return 'buy';
    case 'burn':
      return 'sell';
    case 'token approval':
      return 'approve';
    case 'nft send':
      return 'transfer_out';
    case 'nft receive':
      return 'transfer_in';
    default:
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
 * Normalize a Moralis transaction to our app format
 */
export function normalizeMoralisTransaction(
  tx: MoralisTransaction,
  chainId: string
): NormalizedTransaction {
  const type = mapMoralisCategory(tx.category, tx);

  // Get primary transfer info
  let asset = 'Unknown';
  let symbol = 'ETH';
  let icon: string | undefined;
  let amount = 0;
  const value = 0;

  // For swaps
  let toAsset: string | undefined;
  let toSymbol: string | undefined;
  let toIcon: string | undefined;
  let toAmount: number | undefined;

  // Check ERC20 transfers first
  if (tx.erc20_transfers && tx.erc20_transfers.length > 0) {
    const outTransfers = tx.erc20_transfers.filter(t => t.direction === 'send');
    const inTransfers = tx.erc20_transfers.filter(t => t.direction === 'receive');

    if (type === 'swap' && outTransfers.length > 0 && inTransfers.length > 0) {
      // Swap: from token -> to token
      const fromTransfer = outTransfers[0];
      const toTransfer = inTransfers[0];

      asset = fromTransfer.token_name;
      symbol = fromTransfer.token_symbol;
      icon = fromTransfer.token_logo;
      amount = parseFloat(fromTransfer.value_formatted);

      toAsset = toTransfer.token_name;
      toSymbol = toTransfer.token_symbol;
      toIcon = toTransfer.token_logo;
      toAmount = parseFloat(toTransfer.value_formatted);
    } else if (outTransfers.length > 0) {
      // Outgoing token
      const transfer = outTransfers[0];
      asset = transfer.token_name;
      symbol = transfer.token_symbol;
      icon = transfer.token_logo;
      amount = parseFloat(transfer.value_formatted);
    } else if (inTransfers.length > 0) {
      // Incoming token
      const transfer = inTransfers[0];
      asset = transfer.token_name;
      symbol = transfer.token_symbol;
      icon = transfer.token_logo;
      amount = parseFloat(transfer.value_formatted);
    }
  }
  // Check native transfers
  else if (tx.native_transfers && tx.native_transfers.length > 0) {
    const transfer = tx.native_transfers[0];
    asset = transfer.token_symbol || 'ETH';
    symbol = transfer.token_symbol || 'ETH';
    icon = transfer.token_logo;
    amount = parseFloat(transfer.value_formatted);
  }
  // Fallback to transaction value
  else if (tx.value && tx.value !== '0') {
    const nativeSymbol = chainId === '0x1' ? 'ETH' : chainId === '0x89' ? 'MATIC' : chainId === '0x38' ? 'BNB' : 'ETH';
    asset = nativeSymbol;
    symbol = nativeSymbol;
    amount = parseFloat(tx.value) / 1e18;
  }

  // Get location from method label or summary
  const location = tx.method_label ||
    (tx.to_address ? `${tx.to_address.slice(0, 6)}...${tx.to_address.slice(-4)}` : 'Unknown');

  const normalized: NormalizedTransaction = {
    id: tx.hash,
    hash: tx.hash,
    type,
    status: tx.receipt_status === '1' ? 'confirmed' : 'failed',

    asset,
    symbol,
    icon,
    amount,
    value, // Moralis doesn't provide USD value directly

    location,
    locationIcon: undefined,

    chain: CHAIN_NAMES[chainId] || 'Unknown',
    chainId,
    chainIcon: undefined,

    timestamp: tx.block_timestamp,
    relativeTime: getRelativeTime(tx.block_timestamp),

    from: tx.from_address,
    to: tx.to_address,
  };

  // Add swap details
  if (type === 'swap' && toSymbol) {
    normalized.toAsset = toAsset;
    normalized.toSymbol = toSymbol;
    normalized.toIcon = toIcon;
    normalized.toAmount = toAmount;
  }

  return normalized;
}

// ============ API Functions ============

/**
 * Fetch transactions for a wallet from Moralis
 */
export async function fetchMoralisTransactions(
  walletAddress: string,
  options?: {
    chain?: string;
    limit?: number;
    cursor?: string;
  }
): Promise<MoralisTransactionsResponse> {
  if (!hasApiKey()) {
    throw new Error('Moralis API key not configured');
  }

  const chain = options?.chain || '0x1'; // Default to Ethereum
  const limit = options?.limit || 20;

  const params = new URLSearchParams({
    chain,
    limit: String(limit),
    include: 'internal_transactions',
  });

  if (options?.cursor) {
    params.append('cursor', options.cursor);
  }

  const url = `${MORALIS_API_BASE}/wallets/${walletAddress}/history?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-API-Key': MORALIS_API_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Moralis API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch transactions from multiple chains and combine
 */
export async function getMoralisTransactions(
  walletAddress: string,
  options?: {
    limit?: number;
    chains?: string[];
  }
): Promise<NormalizedTransaction[]> {
  const chains = options?.chains || ['0x1', '0xa', '0xa4b1', '0x89']; // Ethereum, Optimism, Arbitrum, Polygon
  const limitPerChain = Math.ceil((options?.limit || 20) / chains.length);

  // Fetch from all chains in parallel
  const results = await Promise.allSettled(
    chains.map(chain =>
      fetchMoralisTransactions(walletAddress, {
        chain,
        limit: limitPerChain,
      }).then(response => ({
        chain,
        transactions: response.result,
      }))
    )
  );

  // Combine and normalize transactions
  const allTransactions: NormalizedTransaction[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { chain, transactions } = result.value;
      for (const tx of transactions) {
        // Skip spam transactions
        if (tx.possible_spam) continue;
        allTransactions.push(normalizeMoralisTransaction(tx, chain));
      }
    }
  }

  // Sort by timestamp descending
  allTransactions.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Return limited results
  return allTransactions.slice(0, options?.limit || 20);
}
