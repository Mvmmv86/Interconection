'use client';

import dynamic from 'next/dynamic';
import { Shield, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface RiskMetric {
  label: string;
  value: number;
  maxValue: number;
  status: 'safe' | 'warning' | 'danger';
  description: string;
}

const riskMetrics: RiskMetric[] = [
  { label: 'Portfolio VaR (95%)', value: 4.2, maxValue: 10, status: 'safe', description: 'Daily Value at Risk' },
  { label: 'Max Drawdown', value: 12.5, maxValue: 30, status: 'warning', description: 'From ATH' },
  { label: 'Leverage Ratio', value: 1.8, maxValue: 5, status: 'safe', description: 'Total exposure/equity' },
  { label: 'Concentration Risk', value: 35, maxValue: 50, status: 'warning', description: 'Top asset %' },
];

const statusColors = {
  safe: { bg: 'bg-status-success', text: 'text-status-success', fill: '#22c55e' },
  warning: { bg: 'bg-accent-yellow', text: 'text-accent-yellow', fill: '#eab308' },
  danger: { bg: 'bg-status-error', text: 'text-status-error', fill: '#ef4444' },
};

export function RiskExposure() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Correlation data for heatmap
  const correlationData = [
    { name: 'BTC', data: [1.0, 0.85, 0.72, 0.45, 0.12] },
    { name: 'ETH', data: [0.85, 1.0, 0.78, 0.52, 0.18] },
    { name: 'SOL', data: [0.72, 0.78, 1.0, 0.38, 0.22] },
    { name: 'DeFi', data: [0.45, 0.52, 0.38, 1.0, 0.15] },
    { name: 'Stables', data: [0.12, 0.18, 0.22, 0.15, 1.0] },
  ];

  const heatmapOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'heatmap',
      background: 'transparent',
      toolbar: { show: false },
    },
    dataLabels: {
      enabled: true,
      style: { fontSize: '9px', fontFamily: 'Inter', colors: ['#fff'] },
    },
    colors: ['#3b82f6'],
    xaxis: {
      categories: ['BTC', 'ETH', 'SOL', 'DeFi', 'Stables'],
      labels: {
        style: {
          colors: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.5)',
          fontSize: '9px',
          fontFamily: 'Inter'
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.5)',
          fontSize: '9px',
          fontFamily: 'Inter'
        },
      },
    },
    grid: { show: false },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      style: { fontSize: '10px', fontFamily: 'Inter' },
    },
    plotOptions: {
      heatmap: {
        radius: 4,
        colorScale: {
          ranges: [
            { from: -1, to: 0.3, color: '#22c55e', name: 'Low' },
            { from: 0.3, to: 0.6, color: '#eab308', name: 'Medium' },
            { from: 0.6, to: 1, color: '#ef4444', name: 'High' },
          ],
        },
      },
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
        'flex items-center justify-between pb-3 mb-3 border-b relative z-10',
        isDark ? 'border-white/[0.06]' : 'border-gray-200'
      )}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-status-error/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-status-error" />
          </div>
          <div>
            <h3 className={cn(
              'text-[12px] font-semibold uppercase tracking-wider',
              isDark ? 'text-white' : 'text-gray-900'
            )}>
              Risk Exposure
            </h3>
            <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>Portfolio health metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-status-success/10">
          <Shield className="w-3 h-3 text-status-success" />
          <span className="text-[10px] font-medium text-status-success">Healthy</span>
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="space-y-3 mb-4">
        {riskMetrics.map((metric) => {
          const percentage = (metric.value / metric.maxValue) * 100;
          return (
            <div key={metric.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-[10px]', isDark ? 'text-white/70' : 'text-gray-700')}>{metric.label}</span>
                  {metric.status !== 'safe' && (
                    <AlertTriangle className={cn('w-3 h-3', statusColors[metric.status].text)} />
                  )}
                </div>
                <span className={cn('text-[11px] font-medium tabular-nums', statusColors[metric.status].text)}>
                  {metric.label.includes('%') || metric.label.includes('Ratio')
                    ? `${metric.value}${metric.label.includes('Ratio') ? 'x' : '%'}`
                    : `${metric.value}%`}
                </span>
              </div>
              <div className={cn(
                'h-1.5 rounded-full overflow-hidden',
                isDark ? 'bg-white/[0.05]' : 'bg-gray-200'
              )}>
                <div
                  className={cn('h-full rounded-full transition-all', statusColors[metric.status].bg)}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <p className={cn('text-[9px] mt-0.5', isDark ? 'text-white/30' : 'text-gray-500')}>{metric.description}</p>
            </div>
          );
        })}
      </div>

      {/* Correlation Heatmap */}
      <div className={cn(
        'pt-3.5 border-t',
        isDark ? 'border-white/[0.03]' : 'border-gray-100'
      )}>
        <div className="flex items-center justify-between mb-2.5">
          <span className={cn(
            'text-[10px] font-medium uppercase tracking-wider',
            isDark ? 'text-white/70' : 'text-gray-700'
          )}>
            Asset Correlation
          </span>
          <span className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>30 days</span>
        </div>
        <div className="h-[165px]">
          <Chart options={heatmapOptions} series={correlationData} type="heatmap" height="100%" />
        </div>
      </div>

      {/* Risk Alerts */}
      <div className={cn(
        'mt-3 pt-3 border-t',
        isDark ? 'border-white/[0.03]' : 'border-gray-100'
      )}>
        <div className="flex items-start gap-2 p-2 rounded-lg bg-accent-yellow/5 border border-accent-yellow/10">
          <AlertTriangle className="w-4 h-4 text-accent-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-medium text-accent-yellow">Concentration Alert</p>
            <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
              BTC allocation (35%) exceeds recommended 30% single-asset limit
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
