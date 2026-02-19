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
  return (
    <ThemeProvider>
      <AuthProvider>
        <Web3Provider>
          <WalletProvider>
            <ClientProvider>
              <AISettingsProvider>
                {children}
              </AISettingsProvider>
            </ClientProvider>
          </WalletProvider>
        </Web3Provider>
      </AuthProvider>
    </ThemeProvider>
  );
}
