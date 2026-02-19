'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export interface AllocationByChainProps {
  data: Array<{ label: string; value: number; amount: number; color: string }>;
  totalValue: number;
  isLoading?: boolean;
}

export function AllocationByChain({ data, totalValue, isLoading }: AllocationByChainProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Derive chart data from props
  const categories = data.map(d => d.label);
  const chartColors = data.map(d => d.color);
  const chartValues = data.map(d => d.amount);

  // Compute quick stats
  const mainChain = data.length > 0 ? data[0].label : '--';
  const l2Chains = ['Arbitrum', 'Optimism', 'Base', 'Polygon', 'Scroll', 'Linea', 'zkSync Era'];
  const l2Exposure = totalValue > 0
    ? data.filter(d => l2Chains.some(l2 => d.label.toLowerCase().includes(l2.toLowerCase())))
        .reduce((sum, d) => sum + d.value, 0)
    : 0;
  const networkCount = data.length;

  // Determine xaxis formatter based on max value
  const maxVal = Math.max(...chartValues, 0);
  const xFormatter = (val: string | number) => {
    const num = Number(val);
    if (maxVal >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
    if (maxVal >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
    return `$${num.toFixed(0)}`;
  };

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'bar',
      background: 'transparent',
      toolbar: { show: false },
    },
    colors: chartColors,
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        barHeight: '60%',
        distributed: true,
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: {
        style: {
          colors: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.4)',
          fontSize: '10px',
          fontFamily: 'Inter'
        },
        formatter: xFormatter,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: {
          colors: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.6)',
          fontSize: '10px',
          fontFamily: 'Inter'
        },
      },
    },
    grid: {
      borderColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.06)',
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    legend: { show: false },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (val: number) => `$${val.toLocaleString()}` },
      style: { fontSize: '10px', fontFamily: 'Inter' },
    },
  };

  const chartSeries = [{ name: 'Value', data: chartValues }];

  if (isLoading) {
    return (
      <div
        className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden flex items-center justify-center h-[300px]"
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
        className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden flex flex-col items-center justify-center h-[300px]"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
            : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(203, 213, 225, 0.6)',
        }}
      >
        <p className={cn('text-xs', isDark ? 'text-white/30' : 'text-gray-400')}>
          No chain data available
        </p>
        <p className={cn('text-[10px] mt-1', isDark ? 'text-white/20' : 'text-gray-300')}>
          Connect a wallet or exchange to see chain allocation
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
        'flex items-center justify-between pb-3 mb-3 border-b relative z-10',
        isDark ? 'border-white/[0.06]' : 'border-gray-200'
      )}>
        <h3 className={cn(
          'text-[12px] font-semibold uppercase tracking-wider',
          isDark ? 'text-white' : 'text-gray-900'
        )}>
          Allocation by Chain
        </h3>
        <span className={cn(
          'text-[10px]',
          isDark ? 'text-white/30' : 'text-gray-500'
        )}>{networkCount} network{networkCount !== 1 ? 's' : ''}</span>
      </div>

      <div className="h-[180px]">
        <Chart options={chartOptions} series={chartSeries} type="bar" height="100%" />
      </div>

      {/* Quick Stats */}
      <div className={cn(
        'grid grid-cols-3 gap-2 mt-3 pt-3 border-t',
        isDark ? 'border-white/[0.03]' : 'border-gray-100'
      )}>
        <div className="text-center">
          <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>Main Chain</p>
          <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>{mainChain}</p>
        </div>
        <div className="text-center">
          <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>L2 Exposure</p>
          <p className="text-[11px] font-medium text-accent-blue">{l2Exposure.toFixed(1)}%</p>
        </div>
        <div className="text-center">
          <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>Networks</p>
          <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>{networkCount}</p>
        </div>
      </div>
    </div>
  );
}
