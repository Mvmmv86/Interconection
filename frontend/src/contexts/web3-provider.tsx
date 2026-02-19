'use client';

import { FC, ReactNode, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wallet/wagmi-config';
import { SolanaWalletProvider } from '@/lib/wallet/solana-config';

interface Web3ProviderProps {
  children: ReactNode;
}

/**
 * Web3 Provider for both EVM and Solana wallet connections.
 * Wraps children with:
 * - QueryClientProvider (TanStack Query)
 * - WagmiProvider (EVM wallets)
 * - SolanaWalletProvider (Solana wallets)
 */
export const Web3Provider: FC<Web3ProviderProps> = ({ children }) => {
  // Create QueryClient inside component to avoid SSR issues
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60, // 1 minute
            gcTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
            retry: 2,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <SolanaWalletProvider>
          {children}
        </SolanaWalletProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
};

export default Web3Provider;
