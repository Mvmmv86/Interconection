'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { ThemedCard, useThemedText } from '@/components/ui/themed-card';
import type { DistributionByType } from '@/types/positions';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface AssetAllocationProps {
  data: DistributionByType[];
  totalValue: number;
  isLoading: boolean;
}

export function AssetAllocation({ data, totalValue, isLoading }: AssetAllocationProps) {
  const { isDark, label } = useThemedText();

  const allocationData = useMemo(() => {
    if (!data || data.length === 0) {
      return { series: [], labels: [], colors: [] };
    }
    return {
      series: data.map(d => d.value), // percentage values
      labels: data.map(d => d.label),
      colors: data.map(d => d.color),
    };
  }, [data]);

  const formattedTotal = useMemo(() => {
    if (totalValue >= 1000000) return `$${(totalValue / 1000000).toFixed(2)}M`;
    if (totalValue >= 1000) return `$${(totalValue / 1000).toFixed(1)}K`;
    return `$${totalValue.toFixed(0)}`;
  }, [totalValue]);

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'donut',
      background: 'transparent',
    },
    colors: allocationData.colors,
    labels: allocationData.labels,
    stroke: {
      show: true,
      width: 2,
      colors: [isDark ? '#1a1a24' : '#ffffff'],
    },
    plotOptions: {
      pie: {
        donut: {
          size: '75%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '10px',
              fontFamily: 'Inter',
              color: isDark ? 'rgba(255, 255, 255, 0.5)' : '#64748b',
              offsetY: -8,
            },
            value: {
              show: true,
              fontSize: '20px',
              fontFamily: 'Inter',
              fontWeight: 700,
              color: isDark ? '#ffffff' : '#0f172a',
              offsetY: 4,
              formatter: () => formattedTotal,
            },
            total: {
              show: true,
              label: 'Total Value',
              fontSize: '10px',
              fontFamily: 'Inter',
              color: isDark ? 'rgba(255, 255, 255, 0.4)' : '#64748b',
              formatter: () => formattedTotal,
            },
          },
        },
      },
    },
    legend: { show: false },
    dataLabels: { enabled: false },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (val: number) => `${val}%` },
      style: { fontSize: '11px', fontFamily: 'Inter' },
    },
  };

  const hasData = allocationData.series.length > 0 && !isLoading;

  return (
    <ThemedCard className="h-[480px] flex flex-col">
      <span className={cn('text-[11px] font-semibold uppercase tracking-wider relative z-10 flex-shrink-0', label)}>
        Asset Allocation
      </span>

      {/* Chart */}
      <div className="flex-1 mt-2 relative z-10 min-h-0">
        {hasData ? (
          <Chart
            options={chartOptions}
            series={allocationData.series}
            type="donut"
            height="100%"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className={cn(
              'text-[11px]',
              isDark ? 'text-white/30' : 'text-slate-400'
            )}>
              {isLoading ? 'Loading allocation data...' : 'No allocation data'}
            </div>
          </div>
        )}
      </div>

      {/* Custom Legend */}
      <div className="mt-3 space-y-1.5 relative z-10 flex-shrink-0">
        {allocationData.labels.map((labelText, index) => (
          <div
            key={labelText}
            className="flex items-center justify-between p-2 rounded-lg transition-all"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%)'
                : '#f8fafc',
              border: isDark
                ? '1px solid rgba(255, 255, 255, 0.03)'
                : '1px solid #e2e8f0',
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: allocationData.colors[index],
                  boxShadow: `0 0 6px ${allocationData.colors[index]}60`,
                }}
              />
              <span className={cn(
                'text-[11px] font-medium',
                isDark ? 'text-white/80' : 'text-slate-700'
              )}>
                {labelText}
              </span>
            </div>
            <span
              className="text-[11px] font-bold tabular-nums"
              style={{ color: allocationData.colors[index] }}
            >
              {allocationData.series[index]}%
            </span>
          </div>
        ))}
      </div>
    </ThemedCard>
  );
}
