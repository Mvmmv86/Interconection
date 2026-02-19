'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ExchangeTransactionData } from '@/types/positions';

interface UseExchangeTransactionsOptions {
  exchangeId?: string;
  limit?: number;
}

interface UseExchangeTransactionsReturn {
  transactions: ExchangeTransactionData[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useExchangeTransactions(
  options?: UseExchangeTransactionsOptions
): UseExchangeTransactionsReturn {
  const { exchangeId, limit = 50 } = options || {};
  const [transactions, setTransactions] = useState<ExchangeTransactionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('limit', String(limit));
      if (exchangeId) {
        params.append('exchange_id', exchangeId);
      }

      const url = `/api/v1/exchanges/transactions?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.statusText}`);
      }

      const data = await response.json();
      const rawTransactions = data.transactions || [];

      // Transform snake_case API response to camelCase
      const transformed: ExchangeTransactionData[] = rawTransactions.map(
        (tx: Record<string, unknown>) => ({
          id: tx.id as string,
          exchangeId: tx.exchange_id as string,
          exchange: tx.exchange as string,
          exchangeName: tx.exchange_name as string,
          exchangeLabel: tx.exchange_label as string,
          type: tx.type as ExchangeTransactionData['type'],
          coin: tx.coin as string,
          amount: Number(tx.amount),
          fee: Number(tx.fee),
          valueUsd: Number(tx.value_usd),
          status: tx.status as ExchangeTransactionData['status'],
          txId: tx.tx_id as string | undefined,
          fromAccount: tx.from_account as string | undefined,
          toAccount: tx.to_account as string | undefined,
          chain: tx.chain as string | undefined,
          address: tx.address as string | undefined,
          timestamp: tx.timestamp as string,
        })
      );

      setTransactions(transformed);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch exchange transactions'));
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [exchangeId, limit]);

  // Fetch on mount
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchTransactions, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  return {
    transactions,
    isLoading,
    isError,
    error,
    refetch: fetchTransactions,
  };
}
