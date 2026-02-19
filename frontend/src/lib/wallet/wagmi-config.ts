'use client';

import { http, createConfig } from 'wagmi';
import { mainnet, base, arbitrum } from 'wagmi/chains';

// Chains we support
export const supportedChains = [mainnet, base, arbitrum] as const;

// Chain metadata for UI
export const chainMetadata: Record<number, { name: string; logo: string; color: string }> = {
  [mainnet.id]: { name: 'Ethereum', logo: 'ETH', color: '#627eea' },
  [base.id]: { name: 'Base', logo: 'BASE', color: '#0052FF' },
  [arbitrum.id]: { name: 'Arbitrum', logo: 'ARB', color: '#28a0f0' },
};

// Create wagmi config without connectors array
// Connectors will be added dynamically when user connects
// This avoids dependency issues with optional peer dependencies like @coinbase/wallet-sdk
export const wagmiConfig = createConfig({
  chains: supportedChains,
  transports: {
    [mainnet.id]: http(),
    [base.id]: http('https://mainnet.base.org'),
    [arbitrum.id]: http(),
  },
  // Enable batch multicall for performance
  batch: {
    multicall: {
      wait: 16, // 16ms batching window for performance
    },
  },
});

// Export chain IDs for easy access
export const CHAIN_IDS = {
  ETHEREUM: mainnet.id,
  BASE: base.id,
  ARBITRUM: arbitrum.id,
} as const;

export type SupportedChainId = typeof CHAIN_IDS[keyof typeof CHAIN_IDS];
