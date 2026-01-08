'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { ThemedCard, useThemedText } from '@/components/ui/themed-card';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const allocationData = {
  series: [35, 25, 20, 12, 8],
  labels: ['Bitcoin', 'Ethereum', 'Stablecoins', 'DeFi', 'Other'],
  colors: ['#3b82f6', '#8b5cf6', '#22c55e', '#06b6d4', '#f97316'],
};

export function AssetAllocation() {
  const { isDark, label } = useThemedText();

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
              formatter: () => '$2.45M',
            },
            total: {
              show: true,
              label: 'Total Value',
              fontSize: '10px',
              fontFamily: 'Inter',
              color: isDark ? 'rgba(255, 255, 255, 0.4)' : '#64748b',
              formatter: () => '$2.45M',
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

  return (
    <ThemedCard className="h-[480px] flex flex-col">
      <span className={cn('text-[11px] font-semibold uppercase tracking-wider relative z-10 flex-shrink-0', label)}>
        Asset Allocation
      </span>

      {/* Chart */}
      <div className="flex-1 mt-2 relative z-10 min-h-0">
        <Chart
          options={chartOptions}
          series={allocationData.series}
          type="donut"
          height="100%"
        />
      </div>

      {/* Custom Legend */}
      <div className="mt-3 space-y-1.5 relative z-10 flex-shrink-0">
        {allocationData.labels.map((label, index) => (
          <div
            key={label}
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
                {label}
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
