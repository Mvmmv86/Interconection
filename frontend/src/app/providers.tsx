'use client';

import { ReactNode } from 'react';
import { Web3Provider } from '@/contexts/web3-provider';
import { WalletProvider } from '@/contexts/wallet-context';
import { ClientProvider } from '@/contexts/client-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { AuthProvider } from '@/contexts/auth-context';
import { AISettingsProvider } from '@/contexts/ai-settings-context';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Web3Provider sets up QueryClientProvider, so AuthProvider must live
  // inside it (auth-context calls useQueryClient() to clear cache on
  // login/logout). ClientProvider depends on AuthProvider so it stays
  // below.
  return (
    <ThemeProvider>
      <Web3Provider>
        <AuthProvider>
          <WalletProvider>
            <ClientProvider>
              <AISettingsProvider>
                {children}
              </AISettingsProvider>
            </ClientProvider>
          </WalletProvider>
        </AuthProvider>
      </Web3Provider>
    </ThemeProvider>
  );
}
