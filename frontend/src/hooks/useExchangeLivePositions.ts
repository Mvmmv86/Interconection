'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ExchangeAccount } from './useExchangePositions';
import type {
  ExchangeLiveData,
} from './useExchangeDetail';

export interface ExchangeLivePositionsData {
  /** All live data keyed by exchange ID */
  liveDataByExchange: Map<string, ExchangeLiveData>;
  /** Whether any exchange is still loading */
  isLoading: boolean;
  /** Refresh all exchange live data */
  refresh: () => void;
}

// Transform API response (snake_case) to frontend format (camelCase)
function transformLiveResponse(apiData: Record<string, unknown>): ExchangeLiveData {
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

  const marginBalances = (apiData.margin_balances as Array<Record<string, unknown>> || []).map((bal) => ({
    asset: bal.asset as string,
    free: Number(bal.free),
    locked: Number(bal.locked),
    total: Number(bal.total),
    valueUsd: Number(bal.value_usd),
    priceUsd: Number(bal.price_usd),
    change24h: Number(bal.change_24h || 0),
    borrowed: Number(bal.borrowed || 0),
    interest: Number(bal.interest || 0),
    netAsset: Number(bal.net_asset || bal.total),
  }));

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

  const loansWithBorrowed = marginBalances.filter(b => b.borrowed > 0);

  return {
    exchangeId: apiData.exchange_id as string,
    exchangeName: apiData.exchange_name as string,
    exchangeLabel: (apiData.exchange_label as string) || (apiData.exchange_name as string),
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
    subaccounts,
    totalSubaccountsValue: Number(apiData.total_subaccounts_value || 0),
    loanSummary: {
      totalBorrowedUsd: loansWithBorrowed.reduce((sum, b) => sum + (b.borrowed * b.priceUsd), 0),
      totalInterestUsd: loansWithBorrowed.reduce((sum, b) => sum + (b.interest * b.priceUsd), 0),
      loans: loansWithBorrowed.map(b => ({
        asset: b.asset,
        borrowed: b.borrowed,
        interest: b.interest,
        valueUsd: b.borrowed * b.priceUsd,
      })),
    },
  };
}

/**
 * Hook that fetches live position data for all connected exchanges.
 * Returns detailed positions (futures with P&L, spot with quantities, etc.)
 */
export function useExchangeLivePositions(
  exchangeAccounts: ExchangeAccount[]
): ExchangeLivePositionsData {
  const [liveDataByExchange, setLiveDataByExchange] = useState<Map<string, ExchangeLiveData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const fetchingRef = useRef(false);

  const fetchAllLiveData = useCallback(async () => {
    // Only fetch for connected exchanges with value
    const connectedExchanges = exchangeAccounts.filter(
      (ex) => ex.status === 'connected' && ex.totalValue > 0
    );

    if (connectedExchanges.length === 0) {
      setLiveDataByExchange(new Map());
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);

    try {
      const results = await Promise.allSettled(
        connectedExchanges.map(async (ex) => {
          const response = await fetch(`/api/v1/exchanges/${ex.id}/live`);
          if (!response.ok) throw new Error(`Failed to fetch ${ex.name}`);
          const apiData = await response.json();
          return { id: ex.id, data: transformLiveResponse(apiData) };
        })
      );

      const newMap = new Map<string, ExchangeLiveData>();
      for (const result of results) {
        if (result.status === 'fulfilled') {
          newMap.set(result.value.id, result.value.data);
        }
      }

      setLiveDataByExchange(newMap);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [exchangeAccounts]);

  // Fetch on mount and when exchanges change
  useEffect(() => {
    if (exchangeAccounts.length > 0) {
      fetchAllLiveData();
    }
  }, [fetchAllLiveData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (exchangeAccounts.length === 0) return;
    const interval = setInterval(fetchAllLiveData, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllLiveData, exchangeAccounts.length]);

  return {
    liveDataByExchange,
    isLoading,
    refresh: fetchAllLiveData,
  };
}
