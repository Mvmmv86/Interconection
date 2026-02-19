/**
 * Hook for API interactions
 */
import { useState, useEffect, useCallback } from 'react';
import { api, WalletData, ClientListItem } from '@/lib/api/client';

export function useApi() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if already authenticated
    setIsAuthenticated(api.isAuthenticated());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    if (result.success) {
      setIsAuthenticated(true);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setIsAuthenticated(false);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    login,
    logout,
    api,
  };
}

export function useClients() {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await api.getClients();
    if (result.success && result.data) {
      setClients(result.data);
    } else {
      setError(result.error || 'Failed to fetch clients');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (api.isAuthenticated()) {
      fetchClients();
    } else {
      setIsLoading(false);
    }
  }, [fetchClients]);

  return { clients, isLoading, error, refetch: fetchClients };
}

export function useWallets(clientId: string | null) {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWallets = useCallback(async () => {
    if (!clientId) return;

    setIsLoading(true);
    setError(null);
    const result = await api.getWallets(clientId);
    if (result.success && result.data) {
      setWallets(result.data);
    } else {
      setError(result.error || 'Failed to fetch wallets');
    }
    setIsLoading(false);
  }, [clientId]);

  useEffect(() => {
    if (clientId && api.isAuthenticated()) {
      fetchWallets();
    }
  }, [clientId, fetchWallets]);

  const addWallet = useCallback(async (
    address: string,
    chain: string,
    label: string,
    network: 'evm' | 'solana' | 'bitcoin' = 'evm'
  ) => {
    if (!clientId) return { success: false, error: 'No client selected' };

    const result = await api.createWallet(clientId, address, chain, label, network);
    if (result.success) {
      await fetchWallets();
    }
    return result;
  }, [clientId, fetchWallets]);

  const removeWallet = useCallback(async (walletId: string) => {
    if (!clientId) return { success: false, error: 'No client selected' };

    const result = await api.deleteWallet(clientId, walletId);
    if (result.success) {
      await fetchWallets();
    }
    return result;
  }, [clientId, fetchWallets]);

  return { wallets, isLoading, error, refetch: fetchWallets, addWallet, removeWallet };
}
