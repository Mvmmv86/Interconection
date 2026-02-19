'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  Client,
  ClientWallet,
  ClientExchange,
  ManualAsset,
  ClientPortfolio,
  ClientPortfolioSummary,
  getRandomClientColor,
} from '@/types/client-portfolio';
import { api, ClientListItem, ClientPortfolioData } from '@/lib/api/client';
import { useAuth } from '@/contexts/auth-context';

// ========================
// Transform API responses → frontend types
// ========================

function transformClientListItem(item: ClientListItem): Client {
  return {
    id: item.id,
    name: item.name,
    email: item.email || undefined,
    color: item.color,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function transformClientListItemToSummary(item: ClientListItem): ClientPortfolioSummary {
  return {
    clientId: item.id,
    totalValueUsd: Number(item.total_value_usd),
    totalStakedUsd: 0,
    totalHoldingUsd: Number(item.total_value_usd),
    totalLpUsd: 0,
    totalPnlUsd: 0,
    totalPnlPercent: Number(item.pnl_24h_percent),
    pendingRewardsUsd: Number(item.pending_rewards_usd),
    averageApy: Number(item.average_apy),
    assetCount: item.position_count,
    walletCount: item.wallet_count,
    exchangeCount: item.exchange_count,
  };
}

function transformPortfolio(data: ClientPortfolioData): ClientPortfolio {
  const client: Client = {
    id: data.client.id,
    name: data.client.name,
    email: data.client.email || undefined,
    notes: data.client.notes || undefined,
    color: data.client.color,
    createdAt: data.client.created_at,
    updatedAt: data.client.updated_at,
  };

  const wallets: ClientWallet[] = data.wallets.map((w) => ({
    id: w.id,
    clientId: w.client_id,
    address: w.address,
    network: w.network as 'evm' | 'solana',
    chain: w.chain,
    label: w.label,
    isActive: w.is_active,
    addedAt: w.added_at,
    totalValueUsd: Number(w.total_value_usd),
    tokenCount: w.token_count,
    tokens: w.tokens.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      contractAddress: t.contract_address,
      balance: Number(t.balance),
      balanceUsd: Number(t.balance_usd),
      priceUsd: Number(t.price_usd),
      priceChange24h: Number(t.price_change_24h),
      logoUrl: t.logo_url,
    })),
  }));

  const exchanges: ClientExchange[] = data.exchanges.map((e) => ({
    id: e.id,
    clientId: e.client_id,
    exchange: e.exchange,
    label: e.label,
    apiKeyMasked: e.api_key_masked,
    isActive: e.is_active,
    addedAt: e.added_at,
    lastSync: e.last_sync_at || undefined,
    syncError: e.sync_error || undefined,
    totalValueUsd: Number(e.total_value_usd),
    assetCount: e.asset_count,
    balances: e.balances.map((b) => ({
      asset: b.asset,
      free: Number(b.free),
      locked: Number(b.locked),
      total: Number(b.total),
      valueUsd: Number(b.value_usd),
      priceUsd: Number(b.price_usd),
      change24h: Number(b.change_24h),
      entryPrice: b.entry_price ? Number(b.entry_price) : null,
      costBasis: b.cost_basis ? Number(b.cost_basis) : null,
      unrealizedPnl: Number(b.unrealized_pnl || 0),
      unrealizedPnlPercent: Number(b.unrealized_pnl_percent || 0),
      apy: b.apy ? Number(b.apy) : null,
      positionType: b.position_type || 'spot',
    })),
  }));

  const manualAssets: ManualAsset[] = data.manual_assets.map((a) => ({
    id: a.id,
    clientId: a.client_id,
    token: a.token,
    tokenName: a.token_name,
    network: a.network as 'evm' | 'solana' | 'bitcoin' | 'other',
    quantity: Number(a.quantity),
    purchasePrice: Number(a.purchase_price),
    purchaseDate: a.purchase_date,
    currentPrice: a.current_price ? Number(a.current_price) : undefined,
    type: a.type as 'holding' | 'staking' | 'lending' | 'lp',
    stakingProvider: a.staking_provider || undefined,
    apy: a.apy ? Number(a.apy) : undefined,
    notes: a.notes || undefined,
    addedAt: a.created_at,
    updatedAt: a.updated_at,
  }));

  const s = data.summary;
  const summary: ClientPortfolioSummary = {
    clientId: data.client.id,
    totalValueUsd: Number(s.total_value_usd),
    totalStakedUsd: Number(s.total_staking_usd),
    totalHoldingUsd: Number(s.total_holding_usd),
    totalLpUsd: Number(s.total_lp_usd),
    totalPnlUsd: Number(s.total_pnl_usd),
    totalPnlPercent: Number(s.total_pnl_percent),
    pendingRewardsUsd: Number(s.pending_rewards_usd),
    averageApy: Number(s.average_apy),
    assetCount: s.asset_count,
    walletCount: s.wallet_count,
    exchangeCount: s.exchange_count,
  };

  return {
    client,
    wallets,
    exchanges,
    manualAssets,
    detectedPositions: [],
    summary,
  };
}

// ========================
// Context
// ========================

interface ClientContextType {
  // Data
  clients: Client[];
  clientSummaries: ClientPortfolioSummary[];
  selectedClientId: string | null;
  selectedClient: ClientPortfolio | null;
  isLoading: boolean;
  isLoadingPortfolio: boolean;
  error: string | null;

  // Actions
  selectClient: (clientId: string | null) => void;
  createClient: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'color'>) => Promise<Client>;
  updateClient: (clientId: string, data: Partial<Client>) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;

  // Wallet actions
  addWallet: (clientId: string, wallet: Omit<ClientWallet, 'id' | 'clientId' | 'addedAt'>) => Promise<void>;
  removeWallet: (walletId: string) => Promise<void>;
  scanWallet: (clientId: string, walletId: string) => Promise<void>;

  // Exchange actions
  addExchange: (clientId: string, exchange: { exchange: string; label: string; apiKey: string; apiSecret: string }) => Promise<void>;
  removeExchange: (exchangeId: string) => Promise<void>;
  syncExchange: (clientId: string, exchangeId: string) => Promise<void>;

  // Asset actions
  addManualAsset: (clientId: string, asset: Omit<ManualAsset, 'id' | 'clientId' | 'addedAt' | 'updatedAt'>) => Promise<void>;
  updateManualAsset: (assetId: string, data: Partial<ManualAsset>) => Promise<void>;
  removeManualAsset: (assetId: string) => Promise<void>;

  // Portfolio data
  getClientPortfolio: (clientId: string) => ClientPortfolio | null;
  getAllPortfoliosSummary: () => ClientPortfolioSummary[];

  // Refresh
  refreshClients: () => Promise<void>;
  refreshClientData: (clientId: string) => Promise<void>;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated: isAuthed, isLoading: isAuthLoading } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSummaries, setClientSummaries] = useState<ClientPortfolioSummary[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientPortfolio, setSelectedClientPortfolio] = useState<ClientPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients list from API
  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await api.getClients();
    if (result.success && result.data) {
      setClients(result.data.map(transformClientListItem));
      setClientSummaries(result.data.map(transformClientListItemToSummary));
    } else {
      setError(result.error || 'Failed to fetch clients');
    }

    setIsLoading(false);
  }, []);

  // Fetch portfolio for selected client
  const fetchPortfolio = useCallback(async (clientId: string) => {
    setIsLoadingPortfolio(true);
    setError(null);

    const result = await api.getClientPortfolio(clientId);
    if (result.success && result.data) {
      setSelectedClientPortfolio(transformPortfolio(result.data));
    } else {
      console.error('Failed to fetch portfolio:', result.error);
      setError(result.error || 'Failed to fetch portfolio');
      setSelectedClientPortfolio(null);
    }

    setIsLoadingPortfolio(false);
  }, []);

  // Auto-fetch clients when auth is verified
  useEffect(() => {
    // Wait for auth verification to complete
    if (isAuthLoading) {
      return;
    }

    if (isAuthed && api.isAuthenticated()) {
      fetchClients();
    } else {
      setIsLoading(false);
      setClients([]);
      setClientSummaries([]);
    }
  }, [isAuthed, isAuthLoading, fetchClients]);

  // Auto-fetch portfolio when client is selected (only when authenticated)
  useEffect(() => {
    // Wait for auth verification to complete
    if (isAuthLoading) {
      return;
    }

    if (selectedClientId && isAuthed) {
      fetchPortfolio(selectedClientId);
    } else {
      setSelectedClientPortfolio(null);
    }
  }, [selectedClientId, isAuthed, isAuthLoading, fetchPortfolio]);

  const selectClient = useCallback((clientId: string | null) => {
    setSelectedClientId(clientId);
  }, []);

  const getClientPortfolio = useCallback((clientId: string): ClientPortfolio | null => {
    if (selectedClientPortfolio && selectedClientPortfolio.client.id === clientId) {
      return selectedClientPortfolio;
    }
    return null;
  }, [selectedClientPortfolio]);

  const getAllPortfoliosSummary = useCallback((): ClientPortfolioSummary[] => {
    return clientSummaries;
  }, [clientSummaries]);

  // ========================
  // CRUD Actions
  // ========================

  const createClient = useCallback(async (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'color'>): Promise<Client> => {
    const color = getRandomClientColor();
    const result = await api.createClient(data.name, data.email, data.notes, color);

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to create client');
    }

    await fetchClients();

    return {
      id: result.data.id,
      name: result.data.name,
      email: result.data.email || undefined,
      color: result.data.color || color,
      createdAt: result.data.created_at,
      updatedAt: result.data.created_at,
    };
  }, [fetchClients]);

  const updateClient = useCallback(async (clientId: string, data: Partial<Client>): Promise<void> => {
    const result = await api.updateClient(clientId, {
      name: data.name,
      email: data.email,
      notes: data.notes,
      color: data.color,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to update client');
    }

    await fetchClients();
  }, [fetchClients]);

  const deleteClient = useCallback(async (clientId: string): Promise<void> => {
    const result = await api.deleteClient(clientId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete client');
    }

    if (selectedClientId === clientId) {
      setSelectedClientId(null);
      setSelectedClientPortfolio(null);
    }

    await fetchClients();
  }, [selectedClientId, fetchClients]);

  // ========================
  // Wallet Actions
  // ========================

  const addWallet = useCallback(async (clientId: string, wallet: Omit<ClientWallet, 'id' | 'clientId' | 'addedAt'>): Promise<void> => {
    const result = await api.createWallet(
      clientId,
      wallet.address,
      wallet.chain || 'ethereum',
      wallet.label,
      wallet.network,
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to add wallet');
    }

    // Auto-scan the new wallet
    if (result.data) {
      try {
        await api.scanWallet(clientId, result.data.id);
      } catch {
        // Don't fail wallet creation if scan fails
      }
    }

    if (selectedClientId === clientId) {
      await fetchPortfolio(clientId);
    }
    await fetchClients();
  }, [selectedClientId, fetchPortfolio, fetchClients]);

  const removeWallet = useCallback(async (walletId: string): Promise<void> => {
    if (!selectedClientId) return;

    const result = await api.deleteWallet(selectedClientId, walletId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete wallet');
    }

    await fetchPortfolio(selectedClientId);
    await fetchClients();
  }, [selectedClientId, fetchPortfolio, fetchClients]);

  const scanWalletAction = useCallback(async (clientId: string, walletId: string): Promise<void> => {
    await api.scanWallet(clientId, walletId);

    if (selectedClientId === clientId) {
      await fetchPortfolio(clientId);
    }
    await fetchClients();
  }, [selectedClientId, fetchPortfolio, fetchClients]);

  // ========================
  // Exchange Actions
  // ========================

  const addExchange = useCallback(async (
    clientId: string,
    exchange: { exchange: string; label: string; apiKey: string; apiSecret: string }
  ): Promise<void> => {
    const result = await api.createClientExchange(clientId, {
      exchange: exchange.exchange,
      label: exchange.label,
      api_key: exchange.apiKey,
      api_secret: exchange.apiSecret,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to add exchange');
    }

    if (selectedClientId === clientId) {
      await fetchPortfolio(clientId);
    }
    await fetchClients();
  }, [selectedClientId, fetchPortfolio, fetchClients]);

  const removeExchange = useCallback(async (exchangeId: string): Promise<void> => {
    if (!selectedClientId) return;

    const result = await api.deleteClientExchange(selectedClientId, exchangeId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete exchange');
    }

    await fetchPortfolio(selectedClientId);
    await fetchClients();
  }, [selectedClientId, fetchPortfolio, fetchClients]);

  const syncExchange = useCallback(async (clientId: string, exchangeId: string): Promise<void> => {
    await api.syncClientExchange(clientId, exchangeId);

    if (selectedClientId === clientId) {
      await fetchPortfolio(clientId);
    }
    await fetchClients();
  }, [selectedClientId, fetchPortfolio, fetchClients]);

  // ========================
  // Manual Asset Actions
  // ========================

  const addManualAsset = useCallback(async (clientId: string, asset: Omit<ManualAsset, 'id' | 'clientId' | 'addedAt' | 'updatedAt'>): Promise<void> => {
    const result = await api.createManualAsset(clientId, {
      token: asset.token,
      token_name: asset.tokenName,
      network: asset.network,
      quantity: asset.quantity,
      purchase_price: asset.purchasePrice,
      purchase_date: asset.purchaseDate,
      current_price: asset.currentPrice,
      type: asset.type,
      staking_provider: asset.stakingProvider,
      apy: asset.apy,
      notes: asset.notes,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to add manual asset');
    }

    if (selectedClientId === clientId) {
      await fetchPortfolio(clientId);
    }
    await fetchClients();
  }, [selectedClientId, fetchPortfolio, fetchClients]);

  const updateManualAsset = useCallback(async (assetId: string, data: Partial<ManualAsset>): Promise<void> => {
    if (!selectedClientId) return;

    const result = await api.updateManualAsset(selectedClientId, assetId, {
      token: data.token,
      token_name: data.tokenName,
      network: data.network,
      quantity: data.quantity,
      purchase_price: data.purchasePrice,
      purchase_date: data.purchaseDate,
      current_price: data.currentPrice,
      type: data.type,
      staking_provider: data.stakingProvider,
      apy: data.apy,
      notes: data.notes,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to update manual asset');
    }

    await fetchPortfolio(selectedClientId);
    await fetchClients();
  }, [selectedClientId, fetchPortfolio, fetchClients]);

  const removeManualAsset = useCallback(async (assetId: string): Promise<void> => {
    if (!selectedClientId) return;

    const result = await api.deleteManualAsset(selectedClientId, assetId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete manual asset');
    }

    await fetchPortfolio(selectedClientId);
    await fetchClients();
  }, [selectedClientId, fetchPortfolio, fetchClients]);

  // ========================
  // Refresh
  // ========================

  const refreshClients = useCallback(async (): Promise<void> => {
    await fetchClients();
  }, [fetchClients]);

  const refreshClientData = useCallback(async (clientId: string): Promise<void> => {
    setIsLoadingPortfolio(true);

    try {
      // First, get the current portfolio to know what to sync
      const portfolioResult = await api.getClientPortfolio(clientId);

      if (portfolioResult.success && portfolioResult.data) {
        const portfolio = portfolioResult.data;

        // Sync all exchanges for this client (this recalculates PNL from trade history)
        console.log(`Syncing ${portfolio.exchanges.length} exchanges...`);
        for (const exchange of portfolio.exchanges) {
          try {
            console.log(`Syncing exchange: ${exchange.label || exchange.exchange}`);
            const syncResult = await api.syncClientExchange(clientId, exchange.id);
            if (syncResult.success) {
              console.log(`Exchange synced: ${syncResult.data?.assets_synced} assets, $${syncResult.data?.total_value_usd}`);
            }
          } catch (err) {
            console.error(`Failed to sync exchange ${exchange.id}:`, err);
            // Continue syncing others
          }
        }

        // Scan all wallets
        console.log(`Scanning ${portfolio.wallets.length} wallets...`);
        for (const wallet of portfolio.wallets) {
          try {
            await api.scanWallet(clientId, wallet.id);
          } catch {
            // Continue scanning others
          }
        }
      }

      // Re-fetch portfolio data with updated PNL values
      await fetchPortfolio(clientId);
      await fetchClients();
    } catch (err) {
      console.error('Error refreshing client data:', err);
    } finally {
      setIsLoadingPortfolio(false);
    }
  }, [fetchPortfolio, fetchClients]);

  const value: ClientContextType = {
    clients,
    clientSummaries,
    selectedClientId,
    selectedClient: selectedClientPortfolio,
    isLoading,
    isLoadingPortfolio,
    error,
    selectClient,
    createClient,
    updateClient,
    deleteClient,
    addWallet,
    removeWallet,
    scanWallet: scanWalletAction,
    addExchange,
    removeExchange,
    syncExchange,
    addManualAsset,
    updateManualAsset,
    removeManualAsset,
    getClientPortfolio,
    getAllPortfoliosSummary,
    refreshClients,
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
