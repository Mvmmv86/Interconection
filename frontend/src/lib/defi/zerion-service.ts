// Zerion API Service
// Documentation: https://developers.zerion.io/reference

import {
  ZerionPositionsResponse,
  ZerionPosition,
  ZerionChain,
  ZerionDapp,
  NormalizedDeFiPosition,
  DeFiPositionsSummary,
  DeFiCategory,
  mapPositionTypeToCategory,
} from './zerion-types';

// API Configuration — use local proxy to avoid CORS in production
const ZERION_PROXY_BASE = '/api/defi/zerion';

/**
 * Fetch all DeFi positions for a wallet address
 * Returns only protocol positions (not simple token balances)
 */
export async function fetchDeFiPositions(
  walletAddress: string,
  options?: {
    chains?: string[];
    currency?: string;
  }
): Promise<ZerionPositionsResponse> {
  // Zerion doesn't support filter[positions] for Solana addresses
  const isSolana = !walletAddress.startsWith('0x');
  const params = new URLSearchParams({
    wallet: walletAddress,
    'filter[trash]': 'only_non_trash',
    'currency': options?.currency || 'usd',
    'sort': 'value',
  });

  // Only add positions filter for EVM wallets
  if (!isSolana) {
    params.append('filter[positions]', 'only_complex');
  }

  if (options?.chains && options.chains.length > 0) {
    params.append('filter[chain_ids]', options.chains.join(','));
  }

  const url = `${ZERION_PROXY_BASE}/positions?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch all positions (including simple token balances)
 */
export async function fetchAllPositions(
  walletAddress: string,
  options?: {
    chains?: string[];
    currency?: string;
  }
): Promise<ZerionPositionsResponse> {
  const params = new URLSearchParams({
    wallet: walletAddress,
    'filter[positions]': 'no_filter',
    'filter[trash]': 'only_non_trash',
    'currency': options?.currency || 'usd',
    'sort': 'value',
  });

  if (options?.chains && options.chains.length > 0) {
    params.append('filter[chain_ids]', options.chains.join(','));
  }

  const url = `${ZERION_PROXY_BASE}/positions?${params.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get chain info from included data
 */
function getChainFromIncluded(
  chainId: string,
  included?: (ZerionChain | ZerionDapp)[]
): ZerionChain | undefined {
  if (!included) return undefined;
  return included.find(
    (item): item is ZerionChain => item.type === 'chains' && item.id === chainId
  );
}

/**
 * Get dapp info from included data
 */
function getDappFromIncluded(
  dappId: string | null,
  included?: (ZerionChain | ZerionDapp)[]
): ZerionDapp | undefined {
  if (!dappId || !included) return undefined;
  return included.find(
    (item): item is ZerionDapp => item.type === 'dapps' && item.id === dappId
  );
}

/**
 * Normalize a Zerion position to our app format
 */
export function normalizePosition(
  position: ZerionPosition,
  included?: (ZerionChain | ZerionDapp)[]
): NormalizedDeFiPosition {
  const { attributes, relationships } = position;

  // Get chain info
  const chainId = relationships.chain.data.id;
  const chain = getChainFromIncluded(chainId, included);

  // Get dapp/protocol info
  const dappId = relationships.dapp?.data?.id || null;
  const dapp = getDappFromIncluded(dappId, included);

  // Determine protocol name
  const protocol = dapp?.attributes.name || attributes.protocol || 'Unknown';

  // Map to category
  const category = mapPositionTypeToCategory(attributes.position_type, protocol);

  return {
    id: position.id,

    // Protocol info
    protocol,
    protocolIcon: dapp?.attributes.icon?.url,
    protocolUrl: dapp?.attributes.url || undefined,

    // Chain info
    chain: chain?.attributes.name || chainId,
    chainId,
    chainIcon: chain?.attributes.icon?.url,

    // Position type
    category,
    positionType: attributes.position_type,
    positionName: attributes.name,

    // Asset info
    asset: {
      name: attributes.fungible_info.name,
      symbol: attributes.fungible_info.symbol,
      icon: attributes.fungible_info.icon?.url,
      address: attributes.fungible_info.implementations[0]?.address || undefined,
      decimals: attributes.fungible_info.implementations[0]?.decimals || 18,
    },

    // Values
    quantity: attributes.quantity.float,
    valueUsd: attributes.value || 0,
    priceUsd: attributes.price,

    // Changes
    change24h: attributes.changes
      ? {
          absolute: attributes.changes.absolute_1d || 0,
          percent: attributes.changes.percent_1d || 0,
        }
      : undefined,

    // Metadata
    isVerified: attributes.fungible_info.flags.verified,
    updatedAt: attributes.updated_at,
  };
}

/**
 * Normalize all positions from a Zerion response
 */
export function normalizePositions(
  response: ZerionPositionsResponse
): NormalizedDeFiPosition[] {
  return response.data.map((position) =>
    normalizePosition(position, response.included)
  );
}

/**
 * Calculate summary from normalized positions
 * Note: APY metrics will be 0 until enriched with DeFiLlama data
 */
export function calculatePositionsSummary(
  positions: NormalizedDeFiPosition[]
): DeFiPositionsSummary {
  const summary: DeFiPositionsSummary = {
    totalValueUsd: 0,
    lendingSupplyUsd: 0,
    lendingBorrowUsd: 0,
    lpValueUsd: 0,
    stakingValueUsd: 0,
    yieldValueUsd: 0,
    claimableUsd: 0,
    otherValueUsd: 0,
    weightedAvgApy: 0,
    totalAnnualYield: 0,
    totalPositions: positions.length,
    positionsWithApy: 0,
    protocolsUsed: [],
    chainsUsed: [],
  };

  const protocolsSet = new Set<string>();
  const chainsSet = new Set<string>();
  let totalValueWithApy = 0;
  let weightedApySum = 0;

  for (const position of positions) {
    const value = position.valueUsd;

    // Add to total
    summary.totalValueUsd += value;

    // Add to category totals
    switch (position.category) {
      case 'lending':
        if (position.positionType === 'loan') {
          summary.lendingBorrowUsd += value;
        } else {
          summary.lendingSupplyUsd += value;
        }
        break;
      case 'lp':
        summary.lpValueUsd += value;
        break;
      case 'staking':
        summary.stakingValueUsd += value;
        break;
      case 'yield':
        summary.yieldValueUsd += value;
        break;
      case 'claimable':
        summary.claimableUsd += value;
        break;
      case 'other':
        summary.otherValueUsd += value;
        break;
    }

    // Calculate APY metrics if available
    if (position.apy && position.apy.total > 0) {
      summary.positionsWithApy++;
      totalValueWithApy += value;
      weightedApySum += value * position.apy.total;
      summary.totalAnnualYield += (value * position.apy.total) / 100;
    }

    // Track protocols and chains
    protocolsSet.add(position.protocol);
    chainsSet.add(position.chain);
  }

  // Calculate weighted average APY
  if (totalValueWithApy > 0) {
    summary.weightedAvgApy = weightedApySum / totalValueWithApy;
  }

  summary.protocolsUsed = Array.from(protocolsSet);
  summary.chainsUsed = Array.from(chainsSet);

  return summary;
}

/**
 * Filter positions by category
 */
export function filterPositionsByCategory(
  positions: NormalizedDeFiPosition[],
  category: DeFiCategory | 'all'
): NormalizedDeFiPosition[] {
  if (category === 'all') return positions;
  return positions.filter((p) => p.category === category);
}

/**
 * Filter positions by chain
 */
export function filterPositionsByChain(
  positions: NormalizedDeFiPosition[],
  chainId: string | 'all'
): NormalizedDeFiPosition[] {
  if (chainId === 'all') return positions;
  return positions.filter((p) => p.chainId === chainId);
}

/**
 * Group positions by protocol
 */
export function groupPositionsByProtocol(
  positions: NormalizedDeFiPosition[]
): Record<string, NormalizedDeFiPosition[]> {
  const grouped: Record<string, NormalizedDeFiPosition[]> = {};

  for (const position of positions) {
    const protocol = position.protocol;
    if (!grouped[protocol]) {
      grouped[protocol] = [];
    }
    grouped[protocol].push(position);
  }

  return grouped;
}

/**
 * Group positions by chain
 */
export function groupPositionsByChain(
  positions: NormalizedDeFiPosition[]
): Record<string, NormalizedDeFiPosition[]> {
  const grouped: Record<string, NormalizedDeFiPosition[]> = {};

  for (const position of positions) {
    const chain = position.chain;
    if (!grouped[chain]) {
      grouped[chain] = [];
    }
    grouped[chain].push(position);
  }

  return grouped;
}
