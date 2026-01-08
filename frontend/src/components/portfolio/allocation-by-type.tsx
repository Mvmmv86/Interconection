'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const allocationData = {
  series: [30, 25, 18, 12, 10, 5],
  labels: ['Exchanges', 'DeFi Lending', 'Staking', 'Liquidity Pools', 'Derivatives', 'Cold Wallets'],
};

export function AllocationByType() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'donut',
      background: 'transparent',
    },
    colors: ['#3b82f6', '#8b5cf6', '#22c55e', '#06b6d4', '#f97316', '#64748b'],
    labels: allocationData.labels,
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
              formatter: (val) => `${val}%`,
            },
            total: {
              show: true,
              label: 'By Type',
              fontSize: '10px',
              fontFamily: 'Inter',
              color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.4)',
              formatter: () => '$2.45M',
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
      y: { formatter: (val: number) => `${val}%` },
      style: { fontSize: '10px', fontFamily: 'Inter' },
    },
  };

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
            series={allocationData.series}
            type="donut"
            height="100%"
          />
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {allocationData.labels.map((label, index) => {
            const colors = ['#3b82f6', '#8b5cf6', '#22c55e', '#06b6d4', '#f97316', '#64748b'];
            const values = ['$735K', '$612K', '$441K', '$294K', '$245K', '$122K'];
            return (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: colors[index] }}
                  />
                  <span className={cn(
                    'text-[10px]',
                    isDark ? 'text-white/70' : 'text-gray-700'
                  )}>{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-[10px] font-medium tabular-nums',
                    isDark ? 'text-white' : 'text-gray-900'
                  )}>
                    {values[index]}
                  </span>
                  <span className={cn(
                    'text-[9px] tabular-nums',
                    isDark ? 'text-white/30' : 'text-gray-500'
                  )}>
                    {allocationData.series[index]}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
