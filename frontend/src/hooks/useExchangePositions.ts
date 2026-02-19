'use client';

import { useState, useEffect, useCallback } from 'react';

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface TopAsset {
  symbol: string;
  value: number;
  change: number;
}

export interface ExchangeAccount {
  id: string;
  name: string;
  logo: string;
  status: 'connected' | 'syncing' | 'error' | 'pending';
  lastSync: string;
  totalValue: number;
  spotValue: number;
  marginValue: number;
  futuresValue: number;
  pnl24h: number;
  positions: number;
  topAssets: TopAsset[];
}

export interface ExchangePositionsSummary {
  totalValue: number;
  spotHoldings: number;
  marginPositions: number;
  futuresPositions: number;
  exchanges: ExchangeAccount[];
}

export interface UseExchangePositionsReturn {
  // Data
  data: ExchangePositionsSummary | null;
  exchanges: ExchangeAccount[];

  // Status
  status: FetchStatus;
  error: string | null;
  lastFetched: Date | null;

  // Computed totals
  totalValue: number;
  spotHoldings: number;
  marginPositions: number;
  futuresPositions: number;

  // Loading state
  isLoading: boolean;

  // Actions
  refresh: () => Promise<void>;
  syncExchange: (exchangeId: string) => Promise<boolean>;
  syncAllAndRefresh: () => Promise<void>;
}

// Transform API response to frontend format
function transformApiResponse(apiData: {
  total_value: string | number;
  spot_holdings: string | number;
  margin_positions: string | number;
  futures_positions: string | number;
  exchanges: Array<{
    id: string;
    name: string;
    logo: string;
    status: string;
    last_sync: string;
    total_value: string | number;
    spot_value: string | number;
    margin_value: string | number;
    futures_value: string | number;
    pnl_24h: string | number;
    positions: number;
    top_assets: Array<{
      symbol: string;
      value: string | number;
      change: string | number;
    }>;
  }>;
}): ExchangePositionsSummary {
  return {
    totalValue: Number(apiData.total_value),
    spotHoldings: Number(apiData.spot_holdings),
    marginPositions: Number(apiData.margin_positions),
    futuresPositions: Number(apiData.futures_positions),
    exchanges: apiData.exchanges.map((ex) => ({
      id: ex.id,
      name: ex.name,
      logo: ex.logo,
      status: ex.status as ExchangeAccount['status'],
      lastSync: ex.last_sync,
      totalValue: Number(ex.total_value),
      spotValue: Number(ex.spot_value),
      marginValue: Number(ex.margin_value),
      futuresValue: Number(ex.futures_value),
      pnl24h: Number(ex.pnl_24h),
      positions: ex.positions,
      topAssets: ex.top_assets.map((asset) => ({
        symbol: asset.symbol,
        value: Number(asset.value),
        change: Number(asset.change),
      })),
    })),
  };
}

export function useExchangePositions(clientId?: string): UseExchangePositionsReturn {
  const [data, setData] = useState<ExchangePositionsSummary | null>(null);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchPositions = useCallback(async (): Promise<ExchangePositionsSummary | null> => {
    setStatus('loading');
    setError(null);

    try {
      const params = new URLSearchParams();
      if (clientId) {
        params.append('client_id', clientId);
      }

      const url = `/api/v1/exchanges/positions${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const apiData = await response.json();
      const transformed = transformApiResponse(apiData);

      setData(transformed);
      setStatus('success');
      setLastFetched(new Date());
      return transformed;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch exchange positions');
      setStatus('error');
      return null;
    }
  }, [clientId]);

  const syncExchange = useCallback(async (exchangeId: string): Promise<boolean> => {
    try {
      const cid = clientId || '00000000-0000-0000-0000-000000000001';
      const response = await fetch(`/api/v1/clients/${cid}/exchanges/${exchangeId}/sync`, {
        method: 'POST',
      });
      return response.ok;
    } catch (err) {
      console.error('Failed to sync exchange:', err);
      return false;
    }
  }, [clientId]);

  // Sync all exchanges then refresh from DB
  const syncAllAndRefresh = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      // Fetch current state to get exchange list
      const params = new URLSearchParams();
      if (clientId) {
        params.append('client_id', clientId);
      }
      const url = `/api/v1/exchanges/positions${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

      const apiData = await response.json();
      const transformed = transformApiResponse(apiData);

      // Sync each exchange
      const cid = clientId || '00000000-0000-0000-0000-000000000001';
      for (const ex of transformed.exchanges) {
        try {
          await fetch(`/api/v1/clients/${cid}/exchanges/${ex.id}/sync`, { method: 'POST' });
        } catch {
          // Continue syncing others even if one fails
        }
      }

      // Refresh data from DB after all syncs
      await fetchPositions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync exchanges');
      setStatus('error');
    }
  }, [clientId, fetchPositions]);

  // Auto-fetch on mount and auto-sync pending exchanges
  useEffect(() => {
    const init = async () => {
      const result = await fetchPositions();
      if (result) {
        // Auto-sync any exchange that has never been synced
        const pending = result.exchanges.filter(
          (ex) => ex.status === 'pending' || ex.lastSync === 'never'
        );
        if (pending.length > 0) {
          const cid = clientId || '00000000-0000-0000-0000-000000000001';
          for (const ex of pending) {
            try {
              await fetch(`/api/v1/clients/${cid}/exchanges/${ex.id}/sync`, { method: 'POST' });
            } catch {
              // ignore
            }
          }
          // Re-fetch after syncing
          await fetchPositions();
        }
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchPositions, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPositions]);

  return {
    data,
    exchanges: data?.exchanges || [],
    status,
    error,
    lastFetched,
    totalValue: data?.totalValue || 0,
    spotHoldings: data?.spotHoldings || 0,
    marginPositions: data?.marginPositions || 0,
    futuresPositions: data?.futuresPositions || 0,
    isLoading: status === 'loading',
    refresh: (async () => { await fetchPositions(); }) as () => Promise<void>,
    syncExchange,
    syncAllAndRefresh,
  };
}

// Mock data for development without backend
export const mockExchangeData: ExchangePositionsSummary = {
  totalValue: 919000,
  spotHoldings: 734000,
  marginPositions: 105000,
  futuresPositions: 80000,
  exchanges: [
    {
      id: '1',
      name: 'Binance',
      logo: 'BN',
      status: 'connected',
      lastSync: '2 min ago',
      totalValue: 456000,
      spotValue: 350000,
      marginValue: 50000,
      futuresValue: 56000,
      pnl24h: 2.3,
      positions: 12,
      topAssets: [
        { symbol: 'BTC', value: 200000, change: 3.2 },
        { symbol: 'ETH', value: 100000, change: 2.8 },
        { symbol: 'UNI', value: 50000, change: -1.2 },
      ],
    },
    {
      id: '2',
      name: 'Coinbase',
      logo: 'CB',
      status: 'connected',
      lastSync: '5 min ago',
      totalValue: 234000,
      spotValue: 234000,
      marginValue: 0,
      futuresValue: 0,
      pnl24h: 1.8,
      positions: 8,
      topAssets: [
        { symbol: 'SOL', value: 80000, change: 4.5 },
        { symbol: 'ETH', value: 60000, change: 2.8 },
        { symbol: 'BTC', value: 50000, change: 3.2 },
      ],
    },
    {
      id: '3',
      name: 'Kraken',
      logo: 'KR',
      status: 'syncing',
      lastSync: 'syncing...',
      totalValue: 140000,
      spotValue: 100000,
      marginValue: 40000,
      futuresValue: 0,
      pnl24h: -0.5,
      positions: 5,
      topAssets: [
        { symbol: 'ETH', value: 60000, change: 2.8 },
        { symbol: 'DOT', value: 25000, change: -2.1 },
        { symbol: 'XRP', value: 15000, change: 1.5 },
      ],
    },
    {
      id: '4',
      name: 'OKX',
      logo: 'OK',
      status: 'connected',
      lastSync: '10 min ago',
      totalValue: 89000,
      spotValue: 50000,
      marginValue: 15000,
      futuresValue: 24000,
      pnl24h: 3.2,
      positions: 6,
      topAssets: [
        { symbol: 'BTC', value: 30000, change: 3.2 },
        { symbol: 'ETH', value: 25000, change: 2.8 },
        { symbol: 'SOL', value: 15000, change: 4.5 },
      ],
    },
  ],
};
