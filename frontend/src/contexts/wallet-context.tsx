'use client';

import { createContext, useContext, useCallback, ReactNode, useEffect, useState, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId, Connector } from 'wagmi';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { chainMetadata } from '@/lib/wallet/wagmi-config';
import { SOLANA_WALLETS_METADATA } from '@/lib/wallet/solana-config';
import { api } from '@/lib/api/client';

// Wallet types
export type EVMWalletType = 'metamask' | 'walletconnect' | 'coinbase' | 'rabby' | 'injected';
export type SolanaWalletType = 'phantom' | 'solflare' | 'backpack' | 'glow' | 'torus' | 'ledger';
export type WalletType = EVMWalletType | SolanaWalletType;

export interface ConnectedWallet {
  type: WalletType;
  address: string;
  network: 'evm' | 'solana';
  chainId?: number;
  chainName?: string;
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
  connectEVMWallet: (connectorId?: string) => Promise<void>;
  connectSolanaWallet: () => Promise<void>;
  disconnectEVMWallet: () => void;
  disconnectSolanaWallet: () => void;
  disconnectAll: () => void;

  // Helpers
  isEVMConnected: boolean;
  isSolanaConnected: boolean;
  isAnyConnected: boolean;

  // Raw access for advanced usage
  evmChainId: number | undefined;
  availableEVMConnectors: readonly Connector[];
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Wallet configurations
export const EVM_WALLETS: Record<string, { name: string; icon: string; color: string }> = {
  injected: { name: 'Browser Wallet', icon: '🌐', color: '#4F46E5' },
  'io.metamask': { name: 'MetaMask', icon: '🦊', color: '#E2761B' },
  metamask: { name: 'MetaMask', icon: '🦊', color: '#E2761B' },
  walletConnect: { name: 'WalletConnect', icon: '🔗', color: '#3B99FC' },
  coinbaseWallet: { name: 'Coinbase Wallet', icon: '🔵', color: '#0052FF' },
  'io.rabby': { name: 'Rabby', icon: '🐰', color: '#8697FF' },
  rabby: { name: 'Rabby', icon: '🐰', color: '#8697FF' },
};

export const SOLANA_WALLETS: Record<string, { name: string; icon: string; color: string }> = {
  phantom: { name: 'Phantom', icon: '👻', color: '#AB9FF2' },
  solflare: { name: 'Solflare', icon: '🔥', color: '#FC822B' },
  backpack: { name: 'Backpack', icon: '🎒', color: '#E33E3F' },
  glow: { name: 'Glow', icon: '✨', color: '#00FFA3' },
  torus: { name: 'Torus', icon: '🔷', color: '#0364FF' },
  ledger: { name: 'Ledger', icon: '🔐', color: '#000000' },
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isManualConnecting, setIsManualConnecting] = useState(false);

  // EVM wallet state (wagmi)
  const { address: evmAddress, isConnected: isEVMConnectedWagmi, connector } = useAccount();
  const evmChainId = useChainId();
  const { connect, connectors, isPending: isEVMConnecting, error: connectError } = useConnect();
  const { disconnect: disconnectWagmi } = useDisconnect();

  // Solana wallet state (solana-wallet-adapter)
  const {
    publicKey: solanaPublicKey,
    connected: isSolanaConnectedAdapter,
    wallet: solanaWalletAdapter,
    connect: connectSolana,
    disconnect: disconnectSolana,
    select: selectSolanaWallet,
    wallets: availableSolanaWallets,
  } = useSolanaWallet();

  // Ref to track pending Solana connection (after select, before connect)
  const pendingSolanaConnectRef = useRef(false);

  // Handle connect errors
  useEffect(() => {
    if (connectError) {
      setConnectionError(connectError.message);
      setIsManualConnecting(false);
    }
  }, [connectError]);

  // Derived EVM wallet info
  const evmWallet: ConnectedWallet | null = isEVMConnectedWagmi && evmAddress
    ? {
        type: (connector?.id || 'injected') as EVMWalletType,
        address: evmAddress,
        network: 'evm',
        chainId: evmChainId,
        chainName: evmChainId ? chainMetadata[evmChainId]?.name : undefined,
        label: connector?.name || EVM_WALLETS[connector?.id || 'injected']?.name || 'EVM Wallet',
        icon: EVM_WALLETS[connector?.id || 'injected']?.icon || '🌐',
      }
    : null;

  // Derived Solana wallet info
  const solanaWallet: ConnectedWallet | null = isSolanaConnectedAdapter && solanaPublicKey
    ? {
        type: (solanaWalletAdapter?.adapter.name.toLowerCase() || 'phantom') as SolanaWalletType,
        address: solanaPublicKey.toBase58(),
        network: 'solana',
        chainName: 'Solana',
        label: solanaWalletAdapter?.adapter.name || 'Solana Wallet',
        icon: SOLANA_WALLETS_METADATA[solanaWalletAdapter?.adapter.name.toLowerCase() as keyof typeof SOLANA_WALLETS_METADATA]?.icon || '👻',
      }
    : null;

  // Connect EVM wallet
  const connectEVMWallet = useCallback(
    async (connectorId?: string) => {
      setConnectionError(null);
      setIsManualConnecting(true);

      try {
        // If connectors are available from wagmi, use them
        if (connectors.length > 0) {
          let selectedConnector = connectors[0];

          if (connectorId) {
            const found = connectors.find(
              (c) => c.id === connectorId || c.id.toLowerCase().includes(connectorId.toLowerCase())
            );
            if (found) selectedConnector = found;
          }

          connect({ connector: selectedConnector });
        } else {
          // Fallback: Try to connect directly via window.ethereum
          if (typeof window !== 'undefined' && (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum) {
            const ethereum = (window as unknown as { ethereum: { request: (args: { method: string }) => Promise<string[]> } }).ethereum;
            await ethereum.request({ method: 'eth_requestAccounts' });
          } else {
            throw new Error('No Ethereum wallet found. Please install MetaMask or another wallet.');
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to connect EVM wallet';
        setConnectionError(errorMessage);
        console.error('EVM wallet connection error:', error);
      } finally {
        setIsManualConnecting(false);
      }
    },
    [connect, connectors]
  );

  // Connect Solana wallet
  const connectSolanaWallet = useCallback(async () => {
    setConnectionError(null);
    setIsManualConnecting(true);

    try {
      const installedWallets = availableSolanaWallets.filter(
        (w) => w.readyState === 'Installed' || w.readyState === 'Loadable'
      );

      console.log('[Solana] Installed wallets:', installedWallets.map(w => w.adapter.name));

      if (installedWallets.length === 0) {
        throw new Error('No Solana wallet found. Please install Phantom or Solflare.');
      }

      const phantomWallet = installedWallets.find(
        (w) => w.adapter.name.toLowerCase() === 'phantom'
      );
      const solflareWallet = installedWallets.find(
        (w) => w.adapter.name.toLowerCase() === 'solflare'
      );
      const walletToUse = phantomWallet || solflareWallet || installedWallets[0];

      // If this wallet is already selected in the provider, connect directly
      if (solanaWalletAdapter?.adapter.name === walletToUse.adapter.name) {
        console.log('[Solana] Wallet already selected, connecting directly');
        await connectSolana();
        return;
      }

      // Otherwise, select the wallet first — useEffect below will call connect()
      // after React processes the state update
      console.log('[Solana] Selecting wallet:', walletToUse.adapter.name);
      pendingSolanaConnectRef.current = true;
      selectSolanaWallet(walletToUse.adapter.name);
      // Don't reset isManualConnecting — the useEffect or success handler will do it
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect Solana wallet';
      setConnectionError(errorMessage);
      setIsManualConnecting(false);
      console.error('[Solana] Connection error:', error);
    }
  }, [availableSolanaWallets, selectSolanaWallet, solanaWalletAdapter, connectSolana]);

  // Effect: once a wallet is selected after pending connect, call connect()
  useEffect(() => {
    if (pendingSolanaConnectRef.current && solanaWalletAdapter) {
      pendingSolanaConnectRef.current = false;
      console.log('[Solana] Wallet selected, now connecting:', solanaWalletAdapter.adapter.name);
      connectSolana().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : 'Failed to connect Solana wallet';
        setConnectionError(errorMessage);
        setIsManualConnecting(false);
        console.error('[Solana] Connection error after select:', error);
      });
    }
  }, [solanaWalletAdapter, connectSolana]);

  // Disconnect functions
  const disconnectEVMWallet = useCallback(() => {
    disconnectWagmi();
  }, [disconnectWagmi]);

  const disconnectSolanaWallet = useCallback(() => {
    disconnectSolana();
  }, [disconnectSolana]);

  const disconnectAll = useCallback(() => {
    disconnectWagmi();
    disconnectSolana();
  }, [disconnectWagmi, disconnectSolana]);

  // Track if we've already saved this wallet to avoid duplicates
  const savedEVMWalletRef = useRef<string | null>(null);
  const savedSolanaWalletRef = useRef<string | null>(null);

  // Clear errors on successful EVM connection and save wallet to backend
  useEffect(() => {
    if (isEVMConnectedWagmi && evmAddress) {
      setConnectionError(null);
      setIsManualConnecting(false);

      // Save wallet to backend if authenticated and not already saved
      if (api.isAuthenticated() && savedEVMWalletRef.current !== evmAddress) {
        savedEVMWalletRef.current = evmAddress;

        // Get the first client and save wallet
        api.getClients().then(async (result) => {
          if (result.success && result.data && result.data.length > 0) {
            const clientId = result.data[0].id;
            const chainName = evmChainId ? (chainMetadata[evmChainId]?.name?.toLowerCase() || 'ethereum') : 'ethereum';
            const walletLabel = connector?.name || 'Connected Wallet';

            // Try to save wallet (will fail silently if already exists)
            await api.createWallet(clientId, evmAddress, chainName, walletLabel, 'evm');
            console.log('[Wallet] EVM saved to backend:', evmAddress);
          }
        }).catch((err) => {
          console.error('[Wallet] Failed to save EVM to backend:', err);
        });
      }
    }
  }, [isEVMConnectedWagmi, evmAddress, evmChainId, connector]);

  // Clear errors on successful Solana connection and save wallet to backend
  useEffect(() => {
    if (isSolanaConnectedAdapter && solanaPublicKey) {
      const solanaAddress = solanaPublicKey.toBase58();
      setConnectionError(null);
      setIsManualConnecting(false);

      // Save wallet to backend if authenticated and not already saved
      if (api.isAuthenticated() && savedSolanaWalletRef.current !== solanaAddress) {
        savedSolanaWalletRef.current = solanaAddress;

        // Get the first client and save wallet
        api.getClients().then(async (result) => {
          if (result.success && result.data && result.data.length > 0) {
            const clientId = result.data[0].id;
            const walletLabel = solanaWalletAdapter?.adapter.name || 'Solana Wallet';

            // Try to save wallet (will fail silently if already exists)
            await api.createWallet(clientId, solanaAddress, 'solana', walletLabel, 'solana');
            console.log('[Wallet] Solana saved to backend:', solanaAddress);
          }
        }).catch((err) => {
          console.error('[Wallet] Failed to save Solana to backend:', err);
        });
      }
    }
  }, [isSolanaConnectedAdapter, solanaPublicKey, solanaWalletAdapter]);

  const value: WalletContextType = {
    evmWallet,
    solanaWallet,
    isConnecting: isEVMConnecting || isManualConnecting,
    connectionError,
    connectEVMWallet,
    connectSolanaWallet,
    disconnectEVMWallet,
    disconnectSolanaWallet,
    disconnectAll,
    isEVMConnected: !!evmWallet,
    isSolanaConnected: !!solanaWallet,
    isAnyConnected: !!evmWallet || !!solanaWallet,
    evmChainId,
    availableEVMConnectors: connectors,
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
