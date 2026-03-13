'use client';

import { useState, useEffect, useCallback } from 'react';

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

// Futures position interface
export interface FuturesPosition {
  symbol: string;
  side: 'Buy' | 'Sell'; // Buy = Long, Sell = Short
  size: number;
  entryPrice: number;
  markPrice: number;
  positionValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedPnl: number;
  leverage: number;
  margin: number;
  liquidationPrice: number;
  category: 'linear' | 'inverse';
  settleCoin: string;
}

// Spot balance interface
export interface SpotBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  valueUsd: number;
  priceUsd: number;
  change24h: number;
}

// Margin balance interface
export interface MarginBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  valueUsd: number;
  priceUsd: number;
  change24h: number;
  borrowed: number;
  interest: number;
  netAsset: number;
}

// Earn position interface
export interface EarnPosition {
  productId: string;
  productType: string;
  coin: string;
  amount: number;
  valueUsd: number;
  totalPnl: number;
  claimableYield: number;
  apy: number;
  status: string;
}

// Funding balance interface
export interface FundingBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  valueUsd: number;
  priceUsd: number;
  transferable: number;
}

// Sub-account balance interface
export interface SubAccountBalance {
  asset: string;
  total: number;
  valueUsd: number;
  priceUsd: number;
  change24h: number;
}

// Sub-account interface
export interface SubAccount {
  uid: string;
  username: string;
  totalValueUsd: number;
  balancesCount: number;
  balances: SubAccountBalance[];
}

// Loan summary interface
export interface LoanSummary {
  totalBorrowedUsd: number;
  totalInterestUsd: number;
  loans: Array<{
    asset: string;
    borrowed: number;
    interest: number;
    valueUsd: number;
  }>;
}

// Complete exchange live data
export interface ExchangeLiveData {
  exchangeId: string;
  exchangeName: string;
  exchangeLabel: string;
  status: 'connected' | 'syncing' | 'error';
  lastSync: string;

  // Totals
  totalValueUsd: number;
  totalSpotUsd: number;
  totalFundingUsd: number;
  totalMarginUsd: number;
  totalFuturesUsd: number;
  totalEarnUsd: number;

  // Position counts
  spotCount: number;
  fundingCount: number;
  marginCount: number;
  futuresCount: number;
  earnCount: number;

  // Detailed positions
  futuresPositions: FuturesPosition[];
  spotBalances: SpotBalance[];
  fundingBalances: FundingBalance[];
  marginBalances: MarginBalance[];
  earnPositions: EarnPosition[];

  // Sub-accounts
  subaccounts: SubAccount[];
  totalSubaccountsValue: number;

  // Loan summary (calculated from marginBalances)
  loanSummary: LoanSummary;
}

export interface UseExchangeDetailReturn {
  data: ExchangeLiveData | null;
  status: FetchStatus;
  error: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

// Transform API response (snake_case) to frontend format (camelCase)
function transformApiResponse(apiData: Record<string, unknown>): ExchangeLiveData {
  const futuresPositions = (apiData.futures_positions as Array<Record<string, unknown>> || []).map((pos) => ({
    symbol: pos.symbol as string,
    side: pos.side as 'Buy' | 'Sell',
    size: Number(pos.size),
    entryPrice: Number(pos.entry_price),
    markPrice: Number(pos.mark_price),
    positionValue: Number(pos.position_value),
    unrealizedPnl: Number(pos.unrealized_pnl),
    unrealizedPnlPercent: Number(pos.unrealized_pnl_percent),
    realizedPnl: Number(pos.realized_pnl),
    leverage: Number(pos.leverage),
    margin: Number(pos.margin),
    liquidationPrice: Number(pos.liquidation_price),
    category: pos.category as 'linear' | 'inverse',
    settleCoin: pos.settle_coin as string,
  }));

  const spotBalances = (apiData.spot_balances as Array<Record<string, unknown>> || []).map((bal) => ({
    asset: bal.asset as string,
    free: Number(bal.free),
    locked: Number(bal.locked),
    total: Number(bal.total),
    valueUsd: Number(bal.value_usd),
    priceUsd: Number(bal.price_usd),
    change24h: Number(bal.change_24h || 0),
  }));

  const fundingBalances = (apiData.funding_balances as Array<Record<string, unknown>> || []).map((bal) => ({
    asset: bal.asset as string,
    free: Number(bal.free),
    locked: Number(bal.locked),
    total: Number(bal.total),
    valueUsd: Number(bal.value_usd),
    priceUsd: Number(bal.price_usd),
    transferable: Number(bal.transferable || 0),
  }));

  const marginBalances = (apiData.margin_balances as Array<Record<string, unknown>> || []).map((bal) => {
    const borrowed = Number(bal.borrowed || 0);
    const valueUsd = Number(bal.value_usd || 0);
    // Derive price_usd: use API value, or calculate from value/total, or default 1 for stablecoins
    const total = Number(bal.total || 0);
    let priceUsd = Number(bal.price_usd || 0);
    if (!priceUsd && total !== 0) {
      priceUsd = Math.abs(valueUsd / total);
    }
    if (!priceUsd && borrowed > 0) {
      priceUsd = 1; // fallback for stablecoins
    }
    return {
      asset: bal.asset as string,
      free: Number(bal.free || 0),
      locked: Number(bal.locked || 0),
      total,
      valueUsd,
      priceUsd,
      change24h: Number(bal.change_24h || 0),
      borrowed,
      interest: Number(bal.interest || 0),
      netAsset: Number(bal.net_asset || bal.total || 0),
    };
  });

  const earnPositions = (apiData.earn_positions as Array<Record<string, unknown>> || []).map((pos) => ({
    productId: pos.product_id as string,
    productType: pos.product_type as string,
    coin: pos.coin as string,
    amount: Number(pos.amount),
    valueUsd: Number(pos.value_usd || 0),
    totalPnl: Number(pos.total_pnl || 0),
    claimableYield: Number(pos.claimable_yield || 0),
    apy: Number(pos.apy || 0),
    status: pos.status as string,
  }));

  // Process sub-accounts with balances
  const subaccounts = (apiData.subaccounts as Array<Record<string, unknown>> || []).map((sub) => ({
    uid: sub.uid as string,
    username: sub.username as string,
    totalValueUsd: Number(sub.total_value_usd || 0),
    balancesCount: Number(sub.balances_count || 0),
    balances: ((sub.balances as Array<Record<string, unknown>>) || []).map((bal) => ({
      asset: bal.asset as string,
      total: Number(bal.total || 0),
      valueUsd: Number(bal.value_usd || 0),
      priceUsd: Number(bal.price_usd || 0),
      change24h: Number(bal.change_24h || 0),
    })),
  }));

  // Calculate loan summary from margin balances
  const loansWithBorrowed = marginBalances.filter(b => b.borrowed > 0);
  const loanSummary: LoanSummary = {
    totalBorrowedUsd: loansWithBorrowed.reduce((sum, b) => sum + (b.borrowed * b.priceUsd), 0),
    totalInterestUsd: loansWithBorrowed.reduce((sum, b) => sum + (b.interest * b.priceUsd), 0),
    loans: loansWithBorrowed.map(b => ({
      asset: b.asset,
      borrowed: b.borrowed,
      interest: b.interest,
      valueUsd: b.borrowed * b.priceUsd,
    })),
  };

  return {
    exchangeId: (apiData.exchange_id || apiData.id) as string,
    exchangeName: (apiData.exchange_name || apiData.name) as string,
    exchangeLabel: (apiData.exchange_label || apiData.exchange_name || apiData.name) as string,
    status: 'connected',
    lastSync: 'Just now',

    totalValueUsd: Number(apiData.total_value_usd || 0),
    totalSpotUsd: Number(apiData.total_spot_usd || 0),
    totalFundingUsd: Number(apiData.total_funding_usd || 0),
    totalMarginUsd: Number(apiData.total_margin_usd || 0),
    totalFuturesUsd: Number(apiData.total_futures_usd || 0),
    totalEarnUsd: Number(apiData.total_earn_usd || 0),

    spotCount: spotBalances.length,
    fundingCount: fundingBalances.length,
    marginCount: marginBalances.length,
    futuresCount: futuresPositions.length,
    earnCount: earnPositions.length,

    futuresPositions,
    spotBalances,
    fundingBalances,
    marginBalances,
    earnPositions,

    // Sub-accounts
    subaccounts,
    totalSubaccountsValue: Number(apiData.total_subaccounts_value || 0),

    // Loan summary
    loanSummary,
  };
}

export function useExchangeDetail(exchangeId: string): UseExchangeDetailReturn {
  const [data, setData] = useState<ExchangeLiveData | null>(null);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!exchangeId) return;

    setStatus('loading');
    setError(null);

    try {
      const response = await fetch(`/api/v1/exchanges/${exchangeId}/live`);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const apiData = await response.json();

      if (!apiData) {
        throw new Error('No data returned from exchange API');
      }

      const transformed = transformApiResponse(apiData);

      setData(transformed);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch exchange details');
      setStatus('error');
    }
  }, [exchangeId]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchDetail, 30 * 1000);
    return () => clearInterval(interval);
  }, [fetchDetail]);

  return {
    data,
    status,
    error,
    isLoading: status === 'loading',
    refresh: fetchDetail,
  };
}

// Mock data for development without backend
export const mockExchangeDetail: ExchangeLiveData = {
  exchangeId: 'mock-1',
  exchangeName: 'Bybit',
  exchangeLabel: 'Main Account',
  status: 'connected',
  lastSync: '2 min ago',

  totalValueUsd: 635167.12,
  totalSpotUsd: 169000,
  totalFundingUsd: 0,
  totalMarginUsd: 0,
  totalFuturesUsd: 466000,
  totalEarnUsd: 0,

  spotCount: 3,
  fundingCount: 0,
  marginCount: 0,
  futuresCount: 4,
  earnCount: 0,

  futuresPositions: [
    {
      symbol: 'BTCUSDT',
      side: 'Buy',
      size: 0.5,
      entryPrice: 95000,
      markPrice: 98000,
      positionValue: 49000,
      unrealizedPnl: 1500,
      unrealizedPnlPercent: 3.15,
      realizedPnl: 200,
      leverage: 20,
      margin: 2450,
      liquidationPrice: 85000,
      category: 'linear',
      settleCoin: 'USDT',
    },
    {
      symbol: 'ETHUSDT',
      side: 'Buy',
      size: 5,
      entryPrice: 3200,
      markPrice: 3350,
      positionValue: 16750,
      unrealizedPnl: 750,
      unrealizedPnlPercent: 4.68,
      realizedPnl: 100,
      leverage: 10,
      margin: 1675,
      liquidationPrice: 2800,
      category: 'linear',
      settleCoin: 'USDT',
    },
    {
      symbol: 'SOLUSDT',
      side: 'Sell',
      size: 100,
      entryPrice: 180,
      markPrice: 175,
      positionValue: 17500,
      unrealizedPnl: 500,
      unrealizedPnlPercent: 2.78,
      realizedPnl: 50,
      leverage: 5,
      margin: 3500,
      liquidationPrice: 200,
      category: 'linear',
      settleCoin: 'USDT',
    },
  ],

  spotBalances: [
    {
      asset: 'BTC',
      free: 1.5,
      locked: 0.2,
      total: 1.7,
      valueUsd: 166600,
      priceUsd: 98000,
      change24h: 2.3,
    },
    {
      asset: 'ETH',
      free: 15,
      locked: 0,
      total: 15,
      valueUsd: 50250,
      priceUsd: 3350,
      change24h: 4.5,
    },
    {
      asset: 'USDT',
      free: 10000,
      locked: 5000,
      total: 15000,
      valueUsd: 15000,
      priceUsd: 1,
      change24h: 0,
    },
  ],

  fundingBalances: [],
  marginBalances: [
    {
      asset: 'USDT',
      free: 5000,
      locked: 0,
      total: 5000,
      valueUsd: 5000,
      priceUsd: 1,
      change24h: 0,
      borrowed: 2000,
      interest: 1.5,
      netAsset: 3000,
    },
  ],
  earnPositions: [],

  // Sub-accounts mock with balances
  subaccounts: [
    {
      uid: 'sub-001',
      username: 'Trading Bot',
      totalValueUsd: 25000,
      balancesCount: 5,
      balances: [
        { asset: 'BTC', total: 0.15, valueUsd: 14700, priceUsd: 98000, change24h: 2.3 },
        { asset: 'ETH', total: 2.5, valueUsd: 8375, priceUsd: 3350, change24h: 4.5 },
        { asset: 'USDT', total: 1925, valueUsd: 1925, priceUsd: 1, change24h: 0 },
      ],
    },
    {
      uid: 'sub-002',
      username: 'DCA Account',
      totalValueUsd: 15000,
      balancesCount: 3,
      balances: [
        { asset: 'BTC', total: 0.1, valueUsd: 9800, priceUsd: 98000, change24h: 2.3 },
        { asset: 'SOL', total: 25, valueUsd: 4375, priceUsd: 175, change24h: -1.2 },
        { asset: 'USDC', total: 825, valueUsd: 825, priceUsd: 1, change24h: 0 },
      ],
    },
  ],
  totalSubaccountsValue: 40000,

  // Loan summary mock
  loanSummary: {
    totalBorrowedUsd: 2000,
    totalInterestUsd: 1.5,
    loans: [
      {
        asset: 'USDT',
        borrowed: 2000,
        interest: 1.5,
        valueUsd: 2000,
      },
    ],
  },
};
