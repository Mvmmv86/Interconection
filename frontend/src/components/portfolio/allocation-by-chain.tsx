'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface ChainData {
  chain: string;
  value: number;
  percentage: number;
  color: string;
  logo: string;
}

const chainData: ChainData[] = [
  { chain: 'Ethereum', value: 1200000, percentage: 49, color: '#627eea', logo: 'ETH' },
  { chain: 'Bitcoin', value: 600000, percentage: 24, color: '#f7931a', logo: 'BTC' },
  { chain: 'Solana', value: 300000, percentage: 12, color: '#00ffa3', logo: 'SOL' },
  { chain: 'Arbitrum', value: 180000, percentage: 7, color: '#28a0f0', logo: 'ARB' },
  { chain: 'Polygon', value: 120000, percentage: 5, color: '#8247e5', logo: 'MATIC' },
  { chain: 'Others', value: 56789, percentage: 3, color: '#64748b', logo: '...' },
];

export function AllocationByChain() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'bar',
      background: 'transparent',
      toolbar: { show: false },
    },
    colors: chainData.map((c) => c.color),
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
      categories: chainData.map((c) => c.chain),
      labels: {
        style: {
          colors: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.4)',
          fontSize: '10px',
          fontFamily: 'Inter'
        },
        formatter: (val) => `$${(Number(val) / 1000000).toFixed(1)}M`,
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

  const chartSeries = [{ name: 'Value', data: chainData.map((c) => c.value) }];

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
        )}>6 networks</span>
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
          <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>Ethereum</p>
        </div>
        <div className="text-center">
          <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>L2 Exposure</p>
          <p className="text-[11px] font-medium text-accent-blue">12%</p>
        </div>
        <div className="text-center">
          <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>Networks</p>
          <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>6</p>
        </div>
      </div>
    </div>
  );
}
