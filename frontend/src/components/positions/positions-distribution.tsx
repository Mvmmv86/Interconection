'use client';

import dynamic from 'next/dynamic';
import { useTheme } from '@/contexts/theme-context';
import { useAllPositions } from '@/hooks/useAllPositions';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(2)}`;
}

export function PositionsDistribution() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const {
    distributionByType,
    distributionByChain,
    summary,
    isLoading,
  } = useAllPositions();

  // Default data when loading or empty
  const defaultTypeData = [
    { label: 'Spot Holdings', value: 0, color: '#3b82f6' },
    { label: 'DeFi/Lending', value: 0, color: '#a855f7' },
    { label: 'Staking', value: 0, color: '#22c55e' },
    { label: 'Liquidity Pools', value: 0, color: '#00d4ff' },
    { label: 'Others', value: 0, color: '#f97316' },
  ];

  const defaultChainData = [
    { label: 'No Data', value: 100, color: '#64748b' },
  ];

  const byTypeData = distributionByType.length > 0 ? distributionByType : defaultTypeData;
  const byChainData = distributionByChain.length > 0 ? distributionByChain : defaultChainData;

  const typeChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'donut',
      background: 'transparent',
    },
    labels: byTypeData.map((d) => d.label),
    colors: byTypeData.map((d) => d.color),
    stroke: { show: false },
    dataLabels: { enabled: false },
    legend: { show: false },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '10px',
              color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
              offsetY: -5,
            },
            value: {
              show: true,
              fontSize: '16px',
              fontWeight: 600,
              color: isDark ? '#ffffff' : '#111827',
              offsetY: 5,
              formatter: (val) => `${Number(val).toFixed(1)}%`,
            },
            total: {
              show: true,
              label: 'By Type',
              fontSize: '9px',
              color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
              formatter: () => formatCurrency(summary.totalValue),
            },
          },
        },
      },
    },
    tooltip: {
      enabled: true,
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (val: number) => `${val.toFixed(1)}%` },
    },
  };

  const chainChartOptions: ApexCharts.ApexOptions = {
    ...typeChartOptions,
    labels: byChainData.map((d) => d.label),
    colors: byChainData.map((d) => d.color),
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '10px',
              color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
              offsetY: -5,
            },
            value: {
              show: true,
              fontSize: '16px',
              fontWeight: 600,
              color: isDark ? '#ffffff' : '#111827',
              offsetY: 5,
              formatter: (val) => `${Number(val).toFixed(1)}%`,
            },
            total: {
              show: true,
              label: 'By Chain',
              fontSize: '9px',
              color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
              formatter: () => `${byChainData.length} chain${byChainData.length !== 1 ? 's' : ''}`,
            },
          },
        },
      },
    },
  };

  const cardStyle = {
    background: isDark
      ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
      : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
    border: isDark
      ? '1px solid rgba(255, 255, 255, 0.08)'
      : '1px solid rgba(203, 213, 225, 0.6)',
    boxShadow: isDark
      ? '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="backdrop-blur-sm rounded-xl p-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-center h-[180px]">
              <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-white/30' : 'text-gray-400')} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* By Type */}
      <div
        className="backdrop-blur-sm rounded-xl p-4"
        style={cardStyle}
      >
        <div className={`flex items-center justify-between pb-3 mb-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
          <h3 className={`text-[12px] font-semibold uppercase tracking-wider ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Distribution by Type
          </h3>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-[140px] h-[140px]">
            {byTypeData.length > 0 && byTypeData.some(d => d.value > 0) ? (
              <Chart
                options={typeChartOptions}
                series={byTypeData.map((d) => d.value)}
                type="donut"
                height="100%"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className={cn(
                  'w-[100px] h-[100px] rounded-full border-4 flex items-center justify-center',
                  isDark ? 'border-white/10 text-white/30' : 'border-gray-200 text-gray-400'
                )}>
                  <span className="text-[10px]">No data</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            {byTypeData.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className={`text-[10px] ${isDark ? 'text-white/70' : 'text-gray-700'}`}>{item.label}</span>
                </div>
                <span className={`text-[10px] font-medium tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {item.value.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By Chain */}
      <div
        className="backdrop-blur-sm rounded-xl p-4"
        style={cardStyle}
      >
        <div className={`flex items-center justify-between pb-3 mb-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
          <h3 className={`text-[12px] font-semibold uppercase tracking-wider ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Distribution by Chain
          </h3>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-[140px] h-[140px]">
            {byChainData.length > 0 && byChainData.some(d => d.value > 0) ? (
              <Chart
                options={chainChartOptions}
                series={byChainData.map((d) => d.value)}
                type="donut"
                height="100%"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className={cn(
                  'w-[100px] h-[100px] rounded-full border-4 flex items-center justify-center',
                  isDark ? 'border-white/10 text-white/30' : 'border-gray-200 text-gray-400'
                )}>
                  <span className="text-[10px]">No data</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            {byChainData.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className={`text-[10px] ${isDark ? 'text-white/70' : 'text-gray-700'}`}>{item.label}</span>
                </div>
                <span className={`text-[10px] font-medium tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {item.value.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
