'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export interface AllocationByTypeProps {
  data: Array<{ label: string; value: number; amount: number; color: string }>;
  totalValue: number;
  isLoading?: boolean;
}

function formatCompactUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function AllocationByType({ data, totalValue, isLoading }: AllocationByTypeProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const series = data.map(d => Math.round(d.value * 100) / 100);
  const labels = data.map(d => d.label);
  const colors = data.map(d => d.color);
  const totalFormatted = formatCompactUsd(totalValue);

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'donut',
      background: 'transparent',
    },
    colors,
    labels,
    stroke: { show: false },
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
              color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.5)',
              offsetY: -6,
            },
            value: {
              show: true,
              fontSize: '18px',
              fontFamily: 'Inter',
              fontWeight: 600,
              color: isDark ? '#ffffff' : '#1a1d23',
              offsetY: 4,
              formatter: (val) => `${parseFloat(val as string).toFixed(1)}%`,
            },
            total: {
              show: true,
              label: 'By Type',
              fontSize: '10px',
              fontFamily: 'Inter',
              color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.4)',
              formatter: () => totalFormatted,
            },
          },
        },
      },
    },
    legend: {
      show: false,
    },
    dataLabels: { enabled: false },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (val: number) => `${val.toFixed(1)}%` },
      style: { fontSize: '10px', fontFamily: 'Inter' },
    },
  };

  if (isLoading) {
    return (
      <div
        className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden flex items-center justify-center h-[260px]"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
            : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
        }}
      >
        <Loader2 className="w-6 h-6 animate-spin text-white/20" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden flex flex-col items-center justify-center h-[260px]"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
            : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
        }}
      >
        <p className={cn('text-xs', isDark ? 'text-white/30' : 'text-gray-400')}>
          No positions found
        </p>
        <p className={cn('text-[10px] mt-1', isDark ? 'text-white/20' : 'text-gray-300')}>
          Connect a wallet or exchange to see allocations
        </p>
      </div>
    );
  }

  return (
    <div
      className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden"
      style={{
        background: isDark
          ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
          : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
        border: isDark
          ? '1px solid rgba(255, 255, 255, 0.08)'
          : '1px solid rgba(203, 213, 225, 0.6)',
        boxShadow: isDark
          ? '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      }}
    >
      {/* Top shine effect */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{
          background: isDark
            ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)'
            : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
        }}
      />

      {/* Header */}
      <div className={cn(
        'pb-3 mb-3 border-b relative z-10',
        isDark ? 'border-white/[0.06]' : 'border-gray-200'
      )}>
        <h3 className={cn(
          'text-[12px] font-semibold uppercase tracking-wider',
          isDark ? 'text-white' : 'text-gray-900'
        )}>
          Allocation by Type
        </h3>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-[180px] h-[180px]">
          <Chart
            options={chartOptions}
            series={series}
            type="donut"
            height="100%"
          />
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {data.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className={cn(
                  'text-[10px]',
                  isDark ? 'text-white/70' : 'text-gray-700'
                )}>{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-[10px] font-medium tabular-nums',
                  isDark ? 'text-white' : 'text-gray-900'
                )}>
                  {formatCompactUsd(item.amount)}
                </span>
                <span className={cn(
                  'text-[9px] tabular-nums',
                  isDark ? 'text-white/30' : 'text-gray-500'
                )}>
                  {item.value.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
