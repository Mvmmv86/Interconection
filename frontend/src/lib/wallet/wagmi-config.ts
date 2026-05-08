'use client';

import { http, fallback, createConfig } from 'wagmi';
import { mainnet, base, arbitrum } from 'wagmi/chains';

// Chains we support
export const supportedChains = [mainnet, base, arbitrum] as const;

// Chain metadata for UI
export const chainMetadata: Record<number, { name: string; logo: string; color: string }> = {
  [mainnet.id]: { name: 'Ethereum', logo: 'ETH', color: '#627eea' },
  [base.id]: { name: 'Base', logo: 'BASE', color: '#0052FF' },
  [arbitrum.id]: { name: 'Arbitrum', logo: 'ARB', color: '#28a0f0' },
};

// Resolve RPC URLs with optional API keys from env. When a key is
// configured (Alchemy is the most common), use it as the primary
// transport. Public free RPCs follow as fallbacks so a single
// provider rate-limit doesn't break on-chain reads.
const ALCHEMY_KEY = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_ALCHEMY_API_KEY : '';

function ethereumTransports() {
  const transports = [];
  if (ALCHEMY_KEY) transports.push(http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`));
  // Free public RPCs with higher limits than the wagmi default
  transports.push(http('https://eth.llamarpc.com'));
  transports.push(http('https://ethereum-rpc.publicnode.com'));
  transports.push(http('https://rpc.ankr.com/eth'));
  // wagmi default (Cloudflare) — last resort
  transports.push(http());
  return fallback(transports);
}

function arbitrumTransports() {
  const transports = [];
  if (ALCHEMY_KEY) transports.push(http(`https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`));
  transports.push(http('https://arbitrum.llamarpc.com'));
  transports.push(http('https://arbitrum-one-rpc.publicnode.com'));
  transports.push(http());
  return fallback(transports);
}

function baseTransports() {
  const transports = [];
  if (ALCHEMY_KEY) transports.push(http(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`));
  transports.push(http('https://base.llamarpc.com'));
  transports.push(http('https://mainnet.base.org'));
  transports.push(http('https://base-rpc.publicnode.com'));
  return fallback(transports);
}

export const wagmiConfig = createConfig({
  chains: supportedChains,
  transports: {
    [mainnet.id]: ethereumTransports(),
    [base.id]: baseTransports(),
    [arbitrum.id]: arbitrumTransports(),
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
