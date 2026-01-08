'use client';

import { ReactNode } from 'react';
import { WalletProvider } from '@/contexts/wallet-context';
import { ClientProvider } from '@/contexts/client-context';
import { ThemeProvider } from '@/contexts/theme-context';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <WalletProvider>
        <ClientProvider>
          {children}
        </ClientProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}
