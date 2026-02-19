'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ThemedCard, useThemedText } from '@/components/ui/themed-card';
import { SYMBOL_TO_COINGECKO } from '@/lib/risk/risk-types';
import type { UnifiedPosition } from '@/types/positions';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

type Period = '24h' | '7d' | '30d' | '90d' | '1y';
const periods: Period[] = ['24h', '7d', '30d', '90d', '1y'];

const periodToDays: Record<Period, string> = {
  '24h': '1',
  '7d': '7',
  '30d': '30',
  '90d': '90',
  '1y': '365',
};

interface PortfolioChartProps {
  positions: UnifiedPosition[];
  totalValue: number;
  isLoading: boolean;
}

export function PortfolioChart({ positions, totalValue, isLoading: isLoadingPositions }: PortfolioChartProps) {
  const [period, setPeriod] = useState<Period>('30d');
  const { isDark, label } = useThemedText();

  // Get top spot positions with known symbols for price history
  const topAssets = useMemo(() => {
    if (!positions || positions.length === 0) return [];
    const spotPositions = positions
      .filter(p => p.symbol && SYMBOL_TO_COINGECKO[p.symbol.toUpperCase()])
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return spotPositions.map(p => ({
      symbol: p.symbol.toUpperCase(),
      quantity: p.quantity,
      value: p.value,
    }));
  }, [positions]);

  const symbolsKey = topAssets.map(a => a.symbol).join(',');

  // Fetch price history from CoinGecko via our API route
  const { data: chartData, isLoading: isLoadingChart } = useQuery({
    queryKey: ['portfolio-chart', symbolsKey, period],
    queryFn: async () => {
      if (!symbolsKey) return null;
      const days = periodToDays[period];
      const response = await fetch(`/api/prices/history?symbols=${symbolsKey}&days=${days}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: topAssets.length > 0,
    staleTime: 60 * 60 * 1000, // 1h cache
    refetchOnWindowFocus: false,
  });

  // Build portfolio time series from price history
  const seriesData = useMemo(() => {
    if (!chartData?.data || topAssets.length === 0) return [];

    // Get all timestamps from the first coin that has data
    const firstCoinId = Object.keys(chartData.data)[0];
    if (!firstCoinId) return [];
    const timestamps: number[] = chartData.data[firstCoinId]?.prices?.map((p: [number, number]) => p[0]) || [];

    // Value of assets without price history (stablecoins, DeFi, etc.)
    const trackedValue = topAssets.reduce((sum, a) => sum + a.value, 0);
    const untrackedValue = Math.max(0, totalValue - trackedValue);

    // For each timestamp, calculate total portfolio value
    return timestamps.map((ts: number) => {
      let portfolioValue = untrackedValue; // Add untracked value as constant

      for (const asset of topAssets) {
        const coinId = SYMBOL_TO_COINGECKO[asset.symbol];
        const coinData = chartData.data[coinId];
        if (!coinData?.prices) continue;

        // Find closest price point to this timestamp
        const pricePoint = coinData.prices.find((p: [number, number]) => p[0] === ts);
        if (pricePoint) {
          portfolioValue += pricePoint[1] * asset.quantity;
        }
      }

      return { x: ts, y: Math.round(portfolioValue) };
    });
  }, [chartData, topAssets, totalValue]);

  // Format Y axis based on portfolio size
  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'area',
      background: 'transparent',
      toolbar: { show: false },
      animations: { enabled: true, speed: 500 },
      zoom: { enabled: false },
      parentHeightOffset: 0,
      sparkline: { enabled: false },
    },
    colors: ['#3b82f6'],
    stroke: { curve: 'smooth', width: 2 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: isDark ? 0.3 : 0.4,
        opacityTo: 0,
        stops: [0, 100],
        colorStops: [
          { offset: 0, color: '#3b82f6', opacity: isDark ? 0.3 : 0.4 },
          { offset: 100, color: '#3b82f6', opacity: 0 },
        ],
      },
    },
    grid: {
      borderColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.06)',
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { left: 10, right: 10, top: 0, bottom: 0 },
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: {
          colors: isDark ? 'rgba(255, 255, 255, 0.4)' : '#64748b',
          fontSize: '10px',
          fontFamily: 'Inter',
          fontWeight: 500,
        },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: {
          colors: isDark ? 'rgba(255, 255, 255, 0.4)' : '#64748b',
          fontSize: '10px',
          fontFamily: 'Inter',
          fontWeight: 500,
        },
        formatter: formatYAxis,
      },
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      x: { format: 'MMM dd, yyyy' },
      y: { formatter: (value: number) => `$${value.toLocaleString()}` },
      style: { fontSize: '11px', fontFamily: 'Inter' },
    },
    dataLabels: { enabled: false },
  };

  const chartSeries = [{ name: 'Portfolio', data: seriesData }];

  return (
    <ThemedCard className="col-span-2 flex flex-col h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 relative z-10 flex-shrink-0">
        <span className={cn('text-[11px] font-semibold uppercase tracking-wider', label)}>
          Portfolio Evolution
        </span>
        <div
          className="flex items-center gap-0.5 p-0.5 rounded-lg"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)'
              : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)',
            border: isDark
              ? '1px solid rgba(255, 255, 255, 0.06)'
              : '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: isDark ? 'none' : 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
          }}
        >
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all',
                period === p
                  ? 'text-white'
                  : isDark
                    ? 'text-white/30 hover:text-white/70'
                    : 'text-slate-500 hover:text-slate-900'
              )}
              style={period === p ? {
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
              } : undefined}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart - fills remaining vertical space */}
      <div className="flex-1 min-h-0 -mx-2 -mb-2">
        {(isLoadingPositions || isLoadingChart) && seriesData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className={cn(
              'text-[11px]',
              isDark ? 'text-white/30' : 'text-slate-400'
            )}>
              Loading chart data...
            </div>
          </div>
        ) : (
          <Chart options={chartOptions} series={chartSeries} type="area" height="100%" width="100%" />
        )}
      </div>
    </ThemedCard>
  );
}
