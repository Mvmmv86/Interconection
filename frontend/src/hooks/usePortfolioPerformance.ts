'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SYMBOL_TO_COINGECKO } from '@/lib/risk/risk-types';
import type { UnifiedPosition } from '@/types/positions';

export type PortfolioPeriod = '24h' | '7d' | '30d' | '90d' | '1y';

export interface PortfolioSeriesPoint {
  x: number;
  y: number;
}

interface TrackableAsset {
  symbol: string;
  quantity: number;
  value: number;
}

interface CoinHistory {
  prices?: [number, number][];
}

interface PriceHistoryResponse {
  data?: Record<string, CoinHistory>;
}

export const portfolioPeriodToDays: Record<PortfolioPeriod, string> = {
  '24h': '1',
  '7d': '7',
  '30d': '30',
  '90d': '90',
  '1y': '365',
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getTrackableAssets(positions: UnifiedPosition[]): TrackableAsset[] {
  return positions
    .filter((position) => position.category !== 'futures')
    .filter((position) => toFiniteNumber(position.value) > 0)
    .filter((position) => {
      const symbol = position.symbol?.toUpperCase();
      return Boolean(symbol && SYMBOL_TO_COINGECKO[symbol]);
    })
    .sort((a, b) => toFiniteNumber(b.value) - toFiniteNumber(a.value))
    .slice(0, 15)
    .map((position) => ({
      symbol: position.symbol.toUpperCase(),
      quantity: Math.max(0, toFiniteNumber(position.quantity)),
      value: Math.max(0, toFiniteNumber(position.value)),
    }));
}

function getLatestPrice(prices: [number, number][] | undefined): number | null {
  if (!prices?.length) return null;
  for (let index = prices.length - 1; index >= 0; index -= 1) {
    const price = toFiniteNumber(prices[index][1]);
    if (price > 0) return price;
  }
  return null;
}

function getNearestPrice(prices: [number, number][] | undefined, timestamp: number): number | null {
  if (!prices?.length) return null;

  let left = 0;
  let right = prices.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTimestamp = prices[mid][0];

    if (midTimestamp === timestamp) {
      const exact = toFiniteNumber(prices[mid][1]);
      return exact > 0 ? exact : null;
    }

    if (midTimestamp < timestamp) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  const before = prices[Math.max(0, right)];
  const after = prices[Math.min(prices.length - 1, left)];

  if (!before && !after) return null;
  if (!before) {
    const price = toFiniteNumber(after[1]);
    return price > 0 ? price : null;
  }
  if (!after) {
    const price = toFiniteNumber(before[1]);
    return price > 0 ? price : null;
  }

  const nearest = Math.abs(after[0] - timestamp) < Math.abs(timestamp - before[0])
    ? after
    : before;
  const price = toFiniteNumber(nearest[1]);
  return price > 0 ? price : null;
}

function selectTimeline(historyData: Record<string, CoinHistory> | undefined): number[] {
  if (!historyData) return [];

  let longestPrices: [number, number][] = [];
  for (const coinHistory of Object.values(historyData)) {
    const prices = coinHistory.prices || [];
    if (prices.length > longestPrices.length) {
      longestPrices = prices;
    }
  }

  return Array.from(new Set(longestPrices.map((point) => point[0])))
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((a, b) => a - b);
}

export function buildPortfolioSeries(
  historyData: Record<string, CoinHistory> | undefined,
  assets: TrackableAsset[],
  totalValue: number
): PortfolioSeriesPoint[] {
  const currentTotal = Math.max(0, toFiniteNumber(totalValue));
  if (currentTotal <= 0) return [];

  const timeline = selectTimeline(historyData);
  if (!historyData || assets.length === 0 || timeline.length === 0) {
    return [{ x: Date.now(), y: Math.round(currentTotal) }];
  }

  const assetsWithQuantity = assets.map((asset) => {
    const coinId = SYMBOL_TO_COINGECKO[asset.symbol];
    const latestPrice = getLatestPrice(historyData[coinId]?.prices);
    const derivedQuantity = latestPrice && latestPrice > 0
      ? asset.value / latestPrice
      : 0;

    return {
      ...asset,
      quantity: asset.quantity > 0 ? asset.quantity : derivedQuantity,
    };
  });

  const trackedCurrentValue = assetsWithQuantity
    .filter((asset) => asset.quantity > 0)
    .reduce((sum, asset) => sum + asset.value, 0);
  const untrackedCurrentValue = Math.max(0, currentTotal - trackedCurrentValue);

  const rawSeries = timeline
    .map((timestamp) => {
      let portfolioValue = untrackedCurrentValue;

      for (const asset of assetsWithQuantity) {
        if (asset.quantity <= 0) continue;

        const coinId = SYMBOL_TO_COINGECKO[asset.symbol];
        const price = getNearestPrice(historyData[coinId]?.prices, timestamp);
        if (!price) continue;

        portfolioValue += price * asset.quantity;
      }

      return {
        x: timestamp,
        y: portfolioValue,
      };
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.y > 0);

  if (rawSeries.length === 0) {
    return [{ x: Date.now(), y: Math.round(currentTotal) }];
  }

  const latestRawValue = rawSeries[rawSeries.length - 1].y;
  const scale = latestRawValue > 0 ? currentTotal / latestRawValue : 1;
  const series = rawSeries.map((point) => ({
    x: point.x,
    y: Math.round(point.y * scale),
  }));

  const now = Date.now();
  const lastIndex = series.length - 1;
  const lastPoint = series[lastIndex];
  const oneHourMs = 60 * 60 * 1000;

  if (!lastPoint || now - lastPoint.x > oneHourMs) {
    series.push({ x: now, y: Math.round(currentTotal) });
  } else {
    series[lastIndex] = { x: now, y: Math.round(currentTotal) };
  }

  return series;
}

export function usePortfolioPerformance(
  positions: UnifiedPosition[],
  totalValue: number,
  period: PortfolioPeriod
) {
  const assets = useMemo(() => getTrackableAssets(positions), [positions]);
  const symbolsKey = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.symbol))).join(','),
    [assets]
  );

  const { data, isLoading, isFetching, isError } = useQuery<PriceHistoryResponse | null>({
    queryKey: ['portfolio-performance', symbolsKey, period],
    queryFn: async () => {
      if (!symbolsKey) return null;

      const days = portfolioPeriodToDays[period];
      const response = await fetch(`/api/prices/history?symbols=${symbolsKey}&days=${days}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: symbolsKey.length > 0 && totalValue > 0,
    staleTime: period === '24h' ? 5 * 60 * 1000 : 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const series = useMemo(
    () => buildPortfolioSeries(data?.data, assets, totalValue),
    [data, assets, totalValue]
  );

  const startValue = series[0]?.y ?? Math.round(Math.max(0, totalValue));
  const currentValue = Math.round(Math.max(0, totalValue));
  const changeUsd = series.length > 1 ? currentValue - startValue : 0;
  const changePercent = startValue > 0 ? (changeUsd / startValue) * 100 : 0;

  return {
    series,
    changeUsd,
    changePercent,
    isLoading,
    isFetching,
    isError,
    hasHistory: series.length > 1,
  };
}
