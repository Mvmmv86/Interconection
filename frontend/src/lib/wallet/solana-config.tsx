'use client';

import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';

// Solana network configuration
export const SOLANA_NETWORK = WalletAdapterNetwork.Mainnet;

// Prefer explicit override → Helius (if key available) → public RPC
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  (HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
    : clusterApiUrl(SOLANA_NETWORK));

// Wallet metadata for UI
export const SOLANA_WALLETS_METADATA = {
  phantom: { name: 'Phantom', icon: '👻', color: '#AB9FF2' },
  solflare: { name: 'Solflare', icon: '🔥', color: '#FC822B' },
  backpack: { name: 'Backpack', icon: '🎒', color: '#E33E3F' },
} as const;

interface SolanaWalletProviderProps {
  children: ReactNode;
}

/**
 * Solana Wallet Provider with ConnectionProvider and WalletProvider
 * Phantom & Solflare auto-register via Wallet Standard — no legacy adapters needed.
 */
export const SolanaWalletProvider: FC<SolanaWalletProviderProps> = ({ children }) => {
  // Empty array — wallets register themselves via Wallet Standard protocol
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC_URL}>
      {/* autoConnect=true so Phantom/Solflare restore on page reload, matching
          wagmi's default for EVM. Required for the DeFi dashboard since the
          user expects to stay connected across refreshes. */}
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default SolanaWalletProvider;
