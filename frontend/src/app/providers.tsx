'use client';

import { ReactNode } from 'react';
import { WalletProvider } from '@/contexts/wallet-context';
import { ClientProvider } from '@/contexts/client-context';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WalletProvider>
      <ClientProvider>
        {children}
      </ClientProvider>
    </WalletProvider>
  );
}
