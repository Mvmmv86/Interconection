/**
 * Helius API Service for Solana wallet data
 *
 * Helius provides comprehensive Solana data including:
 * - Token balances with prices
 * - NFT data
 * - Transaction history
 * - DeFi positions
 */

import {
  SolanaToken,
  SolanaTransaction,
  HeliusAssetsResponse,
  HeliusTransaction,
  SolanaDeFiPosition
} from './solana-types';

// API Configuration
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
const HELIUS_RPC_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';
const HELIUS_API_URL = HELIUS_API_KEY
  ? `https://api.helius.xyz/v0`
  : null;

// SOL native token info
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const LAMPORTS_PER_SOL = 1_000_000_000;

// Known token metadata (fallback when API doesn't have it)
const KNOWN_TOKENS: Record<string, { symbol: string; name: string; decimals: number; logo?: string }> = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana', decimals: 9, logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6, logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', decimals: 6, logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg' },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', name: 'Marinade staked SOL', decimals: 9, logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png' },
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': { symbol: 'bSOL', name: 'BlazeStake Staked SOL', decimals: 9 },
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': { symbol: 'JitoSOL', name: 'Jito Staked SOL', decimals: 9 },
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': { symbol: 'stSOL', name: 'Lido Staked SOL', decimals: 9 },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk', decimals: 5, logo: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I' },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { symbol: 'JUP', name: 'Jupiter', decimals: 6 },
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': { symbol: 'PYTH', name: 'Pyth Network', decimals: 6 },
  'RLBxxFkseAZ4RgJH3Sqn8jXxhmGoz9jWxDNJMh8pL7a': { symbol: 'RLB', name: 'Rollbit Coin', decimals: 2 },
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof': { symbol: 'RNDR', name: 'Render Token', decimals: 8 },
};

// DeFi protocol identification
const DEFI_PROTOCOLS: Record<string, { name: string; type: SolanaDeFiPosition['type'] }> = {
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { name: 'Marinade Finance', type: 'staking' },
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': { name: 'BlazeStake', type: 'staking' },
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': { name: 'Jito', type: 'staking' },
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': { name: 'Lido', type: 'staking' },
};

/**
 * Fetch all tokens for a Solana wallet using Helius DAS API
 */
export async function getSolanaTokens(address: string): Promise<SolanaToken[]> {
  try {
    // Use Helius DAS API if available
    if (HELIUS_API_KEY) {
      return await fetchTokensViaHelius(address);
    }

    // Fallback to basic RPC
    return await fetchTokensViaRPC(address);
  } catch (error) {
    console.error('[Helius] Error fetching tokens:', error);
    throw error;
  }
}

/**
 * Fetch tokens using Helius DAS API (getAssetsByOwner)
 */
async function fetchTokensViaHelius(address: string): Promise<SolanaToken[]> {
  const response = await fetch(HELIUS_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'get-assets',
      method: 'getAssetsByOwner',
      params: {
        ownerAddress: address,
        page: 1,
        limit: 1000,
        displayOptions: {
          showFungible: true,
          showNativeBalance: true,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Helius API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Helius API error');
  }

  const result = data.result as HeliusAssetsResponse;
  const tokens: SolanaToken[] = [];

  // Add native SOL balance
  if (result.nativeBalance) {
    const solBalance = result.nativeBalance.lamports / LAMPORTS_PER_SOL;
    const solPrice = result.nativeBalance.price_per_sol || 0;

    tokens.push({
      mint: SOL_MINT,
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      balance: solBalance,
      priceUsd: solPrice,
      valueUsd: result.nativeBalance.total_price || solBalance * solPrice,
      logoUrl: KNOWN_TOKENS[SOL_MINT].logo,
      isNative: true,
    });
  }

  // Process fungible tokens
  for (const asset of result.items) {
    if (asset.interface !== 'FungibleToken' && asset.interface !== 'FungibleAsset') {
      continue;
    }

    const tokenInfo = asset.token_info;
    if (!tokenInfo || tokenInfo.balance === 0) {
      continue;
    }

    const mint = asset.id;
    const knownToken = KNOWN_TOKENS[mint];
    const symbol = tokenInfo.symbol || knownToken?.symbol || asset.content?.metadata?.symbol || 'UNKNOWN';
    const name = knownToken?.name || asset.content?.metadata?.name || symbol;
    const decimals = tokenInfo.decimals ?? knownToken?.decimals ?? 9;
    const balance = tokenInfo.balance / Math.pow(10, decimals);
    const priceUsd = tokenInfo.price_info?.price_per_token || 0;
    const valueUsd = tokenInfo.price_info?.total_price || balance * priceUsd;

    // Get logo
    const logoUrl = knownToken?.logo ||
      asset.content?.links?.image ||
      asset.content?.files?.[0]?.uri ||
      undefined;

    tokens.push({
      mint,
      symbol,
      name,
      decimals,
      balance,
      priceUsd,
      valueUsd,
      logoUrl,
      isNative: false,
    });
  }

  // Sort by value
  return tokens.sort((a, b) => b.valueUsd - a.valueUsd);
}

/**
 * Fallback: Fetch tokens using basic Solana RPC
 * Note: This doesn't include prices, only balances
 */
async function fetchTokensViaRPC(address: string): Promise<SolanaToken[]> {
  const tokens: SolanaToken[] = [];

  // Get SOL balance
  const solBalanceResponse = await fetch(HELIUS_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'get-balance',
      method: 'getBalance',
      params: [address],
    }),
  });

  const solData = await solBalanceResponse.json();
  if (solData.result?.value) {
    const solBalance = solData.result.value / LAMPORTS_PER_SOL;
    tokens.push({
      mint: SOL_MINT,
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      balance: solBalance,
      priceUsd: 0, // No price without Helius
      valueUsd: 0,
      logoUrl: KNOWN_TOKENS[SOL_MINT].logo,
      isNative: true,
    });
  }

  // Get SPL token accounts
  const tokenAccountsResponse = await fetch(HELIUS_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'get-token-accounts',
      method: 'getTokenAccountsByOwner',
      params: [
        address,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ],
    }),
  });

  const tokenData = await tokenAccountsResponse.json();
  if (tokenData.result?.value) {
    for (const account of tokenData.result.value) {
      const info = account.account.data.parsed.info;
      const mint = info.mint;
      const balance = parseFloat(info.tokenAmount.uiAmountString || '0');

      if (balance === 0) continue;

      const knownToken = KNOWN_TOKENS[mint];

      tokens.push({
        mint,
        symbol: knownToken?.symbol || 'UNKNOWN',
        name: knownToken?.name || 'Unknown Token',
        decimals: info.tokenAmount.decimals,
        balance,
        priceUsd: 0,
        valueUsd: 0,
        logoUrl: knownToken?.logo,
        isNative: false,
      });
    }
  }

  return tokens;
}

/**
 * Fetch transaction history using Helius Enhanced Transactions API
 */
export async function getSolanaTransactions(
  address: string,
  limit: number = 50
): Promise<SolanaTransaction[]> {
  if (!HELIUS_API_URL) {
    console.warn('[Helius] No API key configured, skipping transaction fetch');
    return [];
  }

  try {
    const response = await fetch(
      `${HELIUS_API_URL}/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const data = await response.json() as HeliusTransaction[];

    return data.map((tx) => ({
      signature: tx.signature,
      timestamp: tx.timestamp * 1000, // Convert to milliseconds
      type: mapTransactionType(tx.type),
      fee: tx.fee / LAMPORTS_PER_SOL,
      status: 'success', // Helius only returns successful transactions
      description: tx.description,
      tokenTransfers: tx.tokenTransfers.map((t) => ({
        mint: t.mint,
        symbol: KNOWN_TOKENS[t.mint]?.symbol || 'UNKNOWN',
        amount: t.tokenAmount,
        fromUserAccount: t.fromUserAccount,
        toUserAccount: t.toUserAccount,
      })),
    }));
  } catch (error) {
    console.error('[Helius] Error fetching transactions:', error);
    return [];
  }
}

/**
 * Map Helius transaction type to our type
 */
function mapTransactionType(heliusType: string): SolanaTransaction['type'] {
  const typeMap: Record<string, SolanaTransaction['type']> = {
    'TRANSFER': 'TRANSFER',
    'SWAP': 'SWAP',
    'STAKE': 'STAKE',
    'UNSTAKE': 'UNSTAKE',
    'NFT_SALE': 'NFT_SALE',
    'NFT_BID': 'NFT_SALE',
    'NFT_LISTING': 'NFT_SALE',
  };

  return typeMap[heliusType] || 'UNKNOWN';
}

/**
 * Identify DeFi positions from token holdings
 * Looks for staking tokens like mSOL, bSOL, JitoSOL, etc.
 */
export function identifyDeFiPositions(tokens: SolanaToken[]): SolanaDeFiPosition[] {
  const positions: SolanaDeFiPosition[] = [];

  for (const token of tokens) {
    const protocol = DEFI_PROTOCOLS[token.mint];
    if (protocol) {
      positions.push({
        protocol: protocol.name,
        type: protocol.type,
        tokens: [token],
        valueUsd: token.valueUsd,
        apy: getEstimatedAPY(token.mint),
      });
    }
  }

  return positions;
}

/**
 * Get estimated APY for known staking tokens
 */
function getEstimatedAPY(mint: string): number | undefined {
  const apyEstimates: Record<string, number> = {
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 7.5, // mSOL ~7.5%
    'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': 7.8, // bSOL ~7.8%
    'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 8.2, // JitoSOL ~8.2%
    '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': 6.5, // stSOL ~6.5%
  };

  return apyEstimates[mint];
}

/**
 * Get SOL price from Helius or fallback
 */
export async function getSolPrice(): Promise<number> {
  try {
    // Try to get from a simple balance call with price info
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-assets',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: '11111111111111111111111111111111', // System program
          page: 1,
          limit: 1,
          displayOptions: {
            showNativeBalance: true,
          },
        },
      }),
    });

    const data = await response.json();
    if (data.result?.nativeBalance?.price_per_sol) {
      return data.result.nativeBalance.price_per_sol;
    }
  } catch (error) {
    console.error('[Helius] Error fetching SOL price:', error);
  }

  // Fallback: No price available
  return 0;
}
