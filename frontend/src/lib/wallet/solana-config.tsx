'use client';

import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';

// Solana network configuration
export const SOLANA_NETWORK = WalletAdapterNetwork.Mainnet;
export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(SOLANA_NETWORK);

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
      <WalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default SolanaWalletProvider;
