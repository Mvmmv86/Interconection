'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  Client,
  ClientWallet,
  ClientExchange,
  ManualAsset,
  DetectedStakingPosition,
  ClientPortfolio,
  ClientPortfolioSummary,
  getRandomClientColor,
} from '@/types/client-portfolio';

// Mock data for demonstration
const MOCK_CLIENTS: Client[] = [
  {
    id: 'client-1',
    name: 'Fundo Alpha',
    email: 'alpha@fund.com',
    notes: 'Principal cliente - foco em ETH staking',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-12-01T10:00:00Z',
    color: '#4ECDC4',
  },
  {
    id: 'client-2',
    name: 'Carteira Beta',
    email: 'beta@invest.com',
    notes: 'Diversificado entre SOL e ETH',
    createdAt: '2024-03-20T10:00:00Z',
    updatedAt: '2024-11-28T10:00:00Z',
    color: '#FF6B6B',
  },
  {
    id: 'client-3',
    name: 'Treasury Gamma',
    notes: 'Treasury corporativo - conservador',
    createdAt: '2024-06-10T10:00:00Z',
    updatedAt: '2024-11-15T10:00:00Z',
    color: '#45B7D1',
  },
];

const MOCK_WALLETS: ClientWallet[] = [
  {
    id: 'wallet-1',
    clientId: 'client-1',
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28',
    network: 'evm',
    chain: 'ethereum',
    label: 'Main ETH Wallet',
    isActive: true,
    addedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'wallet-2',
    clientId: 'client-1',
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    network: 'solana',
    label: 'SOL Holdings',
    isActive: true,
    addedAt: '2024-02-20T10:00:00Z',
  },
  {
    id: 'wallet-3',
    clientId: 'client-2',
    address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
    network: 'solana',
    label: 'Staking Wallet',
    isActive: true,
    addedAt: '2024-03-20T10:00:00Z',
  },
];

const MOCK_EXCHANGES: ClientExchange[] = [
  {
    id: 'exchange-1',
    clientId: 'client-1',
    exchange: 'binance',
    label: 'Binance Principal',
    apiKeyMasked: '****7a2f',
    isActive: true,
    addedAt: '2024-01-15T10:00:00Z',
    lastSync: '2024-12-01T08:00:00Z',
  },
  {
    id: 'exchange-2',
    clientId: 'client-3',
    exchange: 'coinbase',
    label: 'Coinbase Treasury',
    apiKeyMasked: '****9b3c',
    isActive: true,
    addedAt: '2024-06-10T10:00:00Z',
    lastSync: '2024-11-30T12:00:00Z',
  },
];

const MOCK_MANUAL_ASSETS: ManualAsset[] = [
  {
    id: 'asset-1',
    clientId: 'client-1',
    token: 'ETH',
    tokenName: 'Ethereum',
    network: 'evm',
    quantity: 45.5,
    purchasePrice: 2800,
    purchaseDate: '2024-01-20T10:00:00Z',
    currentPrice: 3500,
    type: 'staking',
    stakingProvider: 'Lido',
    apy: 4.2,
    addedAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-12-01T10:00:00Z',
  },
  {
    id: 'asset-2',
    clientId: 'client-1',
    token: 'SOL',
    tokenName: 'Solana',
    network: 'solana',
    quantity: 850,
    purchasePrice: 95,
    purchaseDate: '2024-02-15T10:00:00Z',
    currentPrice: 150,
    type: 'staking',
    stakingProvider: 'Marinade',
    apy: 7.8,
    addedAt: '2024-02-15T10:00:00Z',
    updatedAt: '2024-12-01T10:00:00Z',
  },
  {
    id: 'asset-3',
    clientId: 'client-2',
    token: 'SOL',
    tokenName: 'Solana',
    network: 'solana',
    quantity: 1200,
    purchasePrice: 120,
    purchaseDate: '2024-03-25T10:00:00Z',
    currentPrice: 150,
    type: 'staking',
    stakingProvider: 'Jito',
    apy: 8.5,
    addedAt: '2024-03-25T10:00:00Z',
    updatedAt: '2024-12-01T10:00:00Z',
  },
  {
    id: 'asset-4',
    clientId: 'client-2',
    token: 'ETH',
    tokenName: 'Ethereum',
    network: 'evm',
    quantity: 25,
    purchasePrice: 3200,
    purchaseDate: '2024-04-10T10:00:00Z',
    currentPrice: 3500,
    type: 'holding',
    addedAt: '2024-04-10T10:00:00Z',
    updatedAt: '2024-12-01T10:00:00Z',
  },
  {
    id: 'asset-5',
    clientId: 'client-3',
    token: 'ATOM',
    tokenName: 'Cosmos',
    network: 'other',
    quantity: 5000,
    purchasePrice: 8,
    purchaseDate: '2024-06-15T10:00:00Z',
    currentPrice: 9,
    type: 'staking',
    stakingProvider: 'Stride',
    apy: 18.5,
    addedAt: '2024-06-15T10:00:00Z',
    updatedAt: '2024-12-01T10:00:00Z',
  },
  {
    id: 'asset-6',
    clientId: 'client-3',
    token: 'BTC',
    tokenName: 'Bitcoin',
    network: 'bitcoin',
    quantity: 2.5,
    purchasePrice: 42000,
    purchaseDate: '2024-07-01T10:00:00Z',
    currentPrice: 98000,
    type: 'holding',
    addedAt: '2024-07-01T10:00:00Z',
    updatedAt: '2024-12-01T10:00:00Z',
  },
];

const MOCK_DETECTED_POSITIONS: DetectedStakingPosition[] = [
  {
    id: 'detected-1',
    clientId: 'client-1',
    walletId: 'wallet-1',
    protocol: 'Lido',
    token: 'ETH',
    stakedToken: 'stETH',
    amount: 45.5,
    valueUsd: 159250,
    apy: 4.2,
    rewards: {
      pending: 1.92,
      pendingUsd: 6720,
      claimed: 3.5,
    },
    type: 'liquid',
    autoCompound: true,
    detectedAt: '2024-01-20T10:00:00Z',
    lastUpdated: '2024-12-01T10:00:00Z',
  },
  {
    id: 'detected-2',
    clientId: 'client-1',
    walletId: 'wallet-2',
    protocol: 'Marinade',
    token: 'SOL',
    stakedToken: 'mSOL',
    amount: 850,
    valueUsd: 127500,
    apy: 7.8,
    rewards: {
      pending: 66.3,
      pendingUsd: 9945,
      claimed: 45,
    },
    type: 'liquid',
    autoCompound: true,
    detectedAt: '2024-02-20T10:00:00Z',
    lastUpdated: '2024-12-01T10:00:00Z',
  },
  {
    id: 'detected-3',
    clientId: 'client-2',
    walletId: 'wallet-3',
    protocol: 'Jito',
    token: 'SOL',
    stakedToken: 'JitoSOL',
    amount: 1200,
    valueUsd: 180000,
    apy: 8.5,
    rewards: {
      pending: 102,
      pendingUsd: 15300,
      claimed: 80,
    },
    type: 'liquid',
    autoCompound: true,
    detectedAt: '2024-03-25T10:00:00Z',
    lastUpdated: '2024-12-01T10:00:00Z',
  },
];

interface ClientContextType {
  // Data
  clients: Client[];
  selectedClientId: string | null;
  selectedClient: ClientPortfolio | null;
  isLoading: boolean;

  // Actions
  selectClient: (clientId: string | null) => void;
  createClient: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'color'>) => Promise<Client>;
  updateClient: (clientId: string, data: Partial<Client>) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;

  // Wallet actions
  addWallet: (clientId: string, wallet: Omit<ClientWallet, 'id' | 'clientId' | 'addedAt'>) => Promise<void>;
  removeWallet: (walletId: string) => Promise<void>;

  // Exchange actions
  addExchange: (clientId: string, exchange: Omit<ClientExchange, 'id' | 'clientId' | 'addedAt'>) => Promise<void>;
  removeExchange: (exchangeId: string) => Promise<void>;

  // Asset actions
  addManualAsset: (clientId: string, asset: Omit<ManualAsset, 'id' | 'clientId' | 'addedAt' | 'updatedAt'>) => Promise<void>;
  updateManualAsset: (assetId: string, data: Partial<ManualAsset>) => Promise<void>;
  removeManualAsset: (assetId: string) => Promise<void>;

  // Portfolio data
  getClientPortfolio: (clientId: string) => ClientPortfolio | null;
  getAllPortfoliosSummary: () => ClientPortfolioSummary[];

  // Refresh
  refreshClientData: (clientId: string) => Promise<void>;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

function calculateSummary(
  clientId: string,
  assets: ManualAsset[],
  positions: DetectedStakingPosition[],
  wallets: ClientWallet[],
  exchanges: ClientExchange[]
): ClientPortfolioSummary {
  const clientAssets = assets.filter(a => a.clientId === clientId);
  const clientPositions = positions.filter(p => p.clientId === clientId);
  const clientWallets = wallets.filter(w => w.clientId === clientId);
  const clientExchanges = exchanges.filter(e => e.clientId === clientId);

  let totalStakedUsd = 0;
  let totalHoldingUsd = 0;
  let totalLpUsd = 0;
  let totalPnlUsd = 0;
  let totalCost = 0;
  let pendingRewardsUsd = 0;
  let weightedApy = 0;
  let totalWeightedValue = 0;

  // Calculate from manual assets
  clientAssets.forEach(asset => {
    const currentValue = asset.quantity * (asset.currentPrice || asset.purchasePrice);
    const costBasis = asset.quantity * asset.purchasePrice;

    totalCost += costBasis;
    totalPnlUsd += currentValue - costBasis;

    if (asset.type === 'staking') {
      totalStakedUsd += currentValue;
      if (asset.apy) {
        weightedApy += asset.apy * currentValue;
        totalWeightedValue += currentValue;
      }
    } else if (asset.type === 'lp') {
      totalLpUsd += currentValue;
    } else {
      totalHoldingUsd += currentValue;
    }
  });

  // Calculate from detected positions
  clientPositions.forEach(pos => {
    totalStakedUsd += pos.valueUsd;
    pendingRewardsUsd += pos.rewards.pendingUsd;
    weightedApy += pos.apy * pos.valueUsd;
    totalWeightedValue += pos.valueUsd;
  });

  const totalValueUsd = totalStakedUsd + totalHoldingUsd + totalLpUsd;
  const averageApy = totalWeightedValue > 0 ? weightedApy / totalWeightedValue : 0;
  const totalPnlPercent = totalCost > 0 ? (totalPnlUsd / totalCost) * 100 : 0;

  return {
    clientId,
    totalValueUsd,
    totalStakedUsd,
    totalHoldingUsd,
    totalLpUsd,
    totalPnlUsd,
    totalPnlPercent,
    pendingRewardsUsd,
    averageApy,
    assetCount: clientAssets.length + clientPositions.length,
    walletCount: clientWallets.length,
    exchangeCount: clientExchanges.length,
  };
}

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
  const [wallets, setWallets] = useState<ClientWallet[]>(MOCK_WALLETS);
  const [exchanges, setExchanges] = useState<ClientExchange[]>(MOCK_EXCHANGES);
  const [manualAssets, setManualAssets] = useState<ManualAsset[]>(MOCK_MANUAL_ASSETS);
  const [detectedPositions, setDetectedPositions] = useState<DetectedStakingPosition[]>(MOCK_DETECTED_POSITIONS);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectClient = useCallback((clientId: string | null) => {
    setSelectedClientId(clientId);
  }, []);

  const getClientPortfolio = useCallback((clientId: string): ClientPortfolio | null => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;

    return {
      client,
      wallets: wallets.filter(w => w.clientId === clientId),
      exchanges: exchanges.filter(e => e.clientId === clientId),
      manualAssets: manualAssets.filter(a => a.clientId === clientId),
      detectedPositions: detectedPositions.filter(p => p.clientId === clientId),
      summary: calculateSummary(clientId, manualAssets, detectedPositions, wallets, exchanges),
    };
  }, [clients, wallets, exchanges, manualAssets, detectedPositions]);

  const selectedClient = selectedClientId ? getClientPortfolio(selectedClientId) : null;

  const createClient = useCallback(async (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'color'>): Promise<Client> => {
    await new Promise(r => setTimeout(r, 500)); // Simulate API call

    const newClient: Client = {
      ...data,
      id: `client-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      color: getRandomClientColor(),
    };

    setClients(prev => [...prev, newClient]);
    return newClient;
  }, []);

  const updateClient = useCallback(async (clientId: string, data: Partial<Client>): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));

    setClients(prev => prev.map(c =>
      c.id === clientId
        ? { ...c, ...data, updatedAt: new Date().toISOString() }
        : c
    ));
  }, []);

  const deleteClient = useCallback(async (clientId: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));

    setClients(prev => prev.filter(c => c.id !== clientId));
    setWallets(prev => prev.filter(w => w.clientId !== clientId));
    setExchanges(prev => prev.filter(e => e.clientId !== clientId));
    setManualAssets(prev => prev.filter(a => a.clientId !== clientId));
    setDetectedPositions(prev => prev.filter(p => p.clientId !== clientId));

    if (selectedClientId === clientId) {
      setSelectedClientId(null);
    }
  }, [selectedClientId]);

  const addWallet = useCallback(async (clientId: string, wallet: Omit<ClientWallet, 'id' | 'clientId' | 'addedAt'>): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));

    const newWallet: ClientWallet = {
      ...wallet,
      id: `wallet-${Date.now()}`,
      clientId,
      addedAt: new Date().toISOString(),
    };

    setWallets(prev => [...prev, newWallet]);
  }, []);

  const removeWallet = useCallback(async (walletId: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));
    setWallets(prev => prev.filter(w => w.id !== walletId));
  }, []);

  const addExchange = useCallback(async (clientId: string, exchange: Omit<ClientExchange, 'id' | 'clientId' | 'addedAt'>): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));

    const newExchange: ClientExchange = {
      ...exchange,
      id: `exchange-${Date.now()}`,
      clientId,
      addedAt: new Date().toISOString(),
    };

    setExchanges(prev => [...prev, newExchange]);
  }, []);

  const removeExchange = useCallback(async (exchangeId: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));
    setExchanges(prev => prev.filter(e => e.id !== exchangeId));
  }, []);

  const addManualAsset = useCallback(async (clientId: string, asset: Omit<ManualAsset, 'id' | 'clientId' | 'addedAt' | 'updatedAt'>): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));

    const newAsset: ManualAsset = {
      ...asset,
      id: `asset-${Date.now()}`,
      clientId,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setManualAssets(prev => [...prev, newAsset]);
  }, []);

  const updateManualAsset = useCallback(async (assetId: string, data: Partial<ManualAsset>): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));

    setManualAssets(prev => prev.map(a =>
      a.id === assetId
        ? { ...a, ...data, updatedAt: new Date().toISOString() }
        : a
    ));
  }, []);

  const removeManualAsset = useCallback(async (assetId: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));
    setManualAssets(prev => prev.filter(a => a.id !== assetId));
  }, []);

  const getAllPortfoliosSummary = useCallback((): ClientPortfolioSummary[] => {
    return clients.map(client =>
      calculateSummary(client.id, manualAssets, detectedPositions, wallets, exchanges)
    );
  }, [clients, manualAssets, detectedPositions, wallets, exchanges]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const refreshClientData = useCallback(async (clientId: string): Promise<void> => {
    setIsLoading(true);
    // Simulate fetching fresh data from wallets and exchanges
    await new Promise(r => setTimeout(r, 2000));
    setIsLoading(false);
  }, []);

  const value: ClientContextType = {
    clients,
    selectedClientId,
    selectedClient,
    isLoading,
    selectClient,
    createClient,
    updateClient,
    deleteClient,
    addWallet,
    removeWallet,
    addExchange,
    removeExchange,
    addManualAsset,
    updateManualAsset,
    removeManualAsset,
    getClientPortfolio,
    getAllPortfoliosSummary,
    refreshClientData,
  };

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}

export function useClients() {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error('useClients must be used within a ClientProvider');
  }
  return context;
}
