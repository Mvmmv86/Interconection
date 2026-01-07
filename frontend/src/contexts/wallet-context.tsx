'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Wallet types
export type EVMWalletType = 'metamask' | 'walletconnect' | 'coinbase' | 'rabby';
export type SolanaWalletType = 'phantom' | 'solflare' | 'backpack' | 'glow';
export type WalletType = EVMWalletType | SolanaWalletType;

export interface ConnectedWallet {
  type: WalletType;
  address: string;
  network: 'evm' | 'solana';
  chainId?: number; // For EVM
  label: string;
  icon: string;
}

export interface WalletContextType {
  // Connection state
  evmWallet: ConnectedWallet | null;
  solanaWallet: ConnectedWallet | null;
  isConnecting: boolean;
  connectionError: string | null;

  // Actions
  connectEVMWallet: (type: EVMWalletType) => Promise<void>;
  connectSolanaWallet: (type: SolanaWalletType) => Promise<void>;
  disconnectEVMWallet: () => void;
  disconnectSolanaWallet: () => void;
  disconnectAll: () => void;

  // Helpers
  isEVMConnected: boolean;
  isSolanaConnected: boolean;
  isAnyConnected: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Wallet configurations
export const EVM_WALLETS: Record<EVMWalletType, { name: string; icon: string; color: string }> = {
  metamask: { name: 'MetaMask', icon: '🦊', color: '#E2761B' },
  walletconnect: { name: 'WalletConnect', icon: '🔗', color: '#3B99FC' },
  coinbase: { name: 'Coinbase Wallet', icon: '🔵', color: '#0052FF' },
  rabby: { name: 'Rabby', icon: '🐰', color: '#8697FF' },
};

export const SOLANA_WALLETS: Record<SolanaWalletType, { name: string; icon: string; color: string }> = {
  phantom: { name: 'Phantom', icon: '👻', color: '#AB9FF2' },
  solflare: { name: 'Solflare', icon: '🔥', color: '#FC822B' },
  backpack: { name: 'Backpack', icon: '🎒', color: '#E33E3F' },
  glow: { name: 'Glow', icon: '✨', color: '#00FFA3' },
};

// Mock addresses for demo
const MOCK_EVM_ADDRESSES: Record<EVMWalletType, string> = {
  metamask: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28',
  walletconnect: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72',
  coinbase: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
  rabby: '0x1234567890abcdef1234567890abcdef12345678',
};

const MOCK_SOLANA_ADDRESSES: Record<SolanaWalletType, string> = {
  phantom: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  solflare: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
  backpack: '9WzDXwBbmPEi7Xck5n4JBh1VKsYxZMKgT8Vd3EUjweEk',
  glow: 'HN7cABqLq46Es1jh92dQQisAi5YqpCEjqpQPKYL5qqYf',
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [evmWallet, setEVMWallet] = useState<ConnectedWallet | null>(null);
  const [solanaWallet, setSolanaWallet] = useState<ConnectedWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const connectEVMWallet = useCallback(async (type: EVMWalletType) => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Simulate wallet connection delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // In real implementation, this would use ethers.js or wagmi
      // const provider = new ethers.BrowserProvider(window.ethereum);
      // const accounts = await provider.send('eth_requestAccounts', []);

      const walletConfig = EVM_WALLETS[type];
      setEVMWallet({
        type,
        address: MOCK_EVM_ADDRESSES[type],
        network: 'evm',
        chainId: 1, // Ethereum mainnet
        label: walletConfig.name,
        icon: walletConfig.icon,
      });
    } catch (error) {
      setConnectionError(`Failed to connect ${EVM_WALLETS[type].name}`);
      console.error('EVM wallet connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const connectSolanaWallet = useCallback(async (type: SolanaWalletType) => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Simulate wallet connection delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // In real implementation, this would use @solana/wallet-adapter
      // const { publicKey } = useWallet();

      const walletConfig = SOLANA_WALLETS[type];
      setSolanaWallet({
        type,
        address: MOCK_SOLANA_ADDRESSES[type],
        network: 'solana',
        label: walletConfig.name,
        icon: walletConfig.icon,
      });
    } catch (error) {
      setConnectionError(`Failed to connect ${SOLANA_WALLETS[type].name}`);
      console.error('Solana wallet connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectEVMWallet = useCallback(() => {
    setEVMWallet(null);
  }, []);

  const disconnectSolanaWallet = useCallback(() => {
    setSolanaWallet(null);
  }, []);

  const disconnectAll = useCallback(() => {
    setEVMWallet(null);
    setSolanaWallet(null);
  }, []);

  const value: WalletContextType = {
    evmWallet,
    solanaWallet,
    isConnecting,
    connectionError,
    connectEVMWallet,
    connectSolanaWallet,
    disconnectEVMWallet,
    disconnectSolanaWallet,
    disconnectAll,
    isEVMConnected: !!evmWallet,
    isSolanaConnected: !!solanaWallet,
    isAnyConnected: !!evmWallet || !!solanaWallet,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// Helper to format address
export function formatAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
