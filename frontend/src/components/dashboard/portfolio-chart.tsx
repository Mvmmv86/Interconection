'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { ThemedCard, useThemedText } from '@/components/ui/themed-card';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const generateMockData = (days: number) => {
  const data = [];
  const baseValue = 2000000;
  let currentValue = baseValue;

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    currentValue += (Math.random() - 0.45) * 50000;
    currentValue = Math.max(currentValue, baseValue * 0.8);
    data.push({ x: date.getTime(), y: Math.round(currentValue) });
  }
  return data;
};

const periodData = {
  '24h': generateMockData(1),
  '7d': generateMockData(7),
  '30d': generateMockData(30),
  '90d': generateMockData(90),
  '1y': generateMockData(365),
};

type Period = keyof typeof periodData;

const periods: Period[] = ['24h', '7d', '30d', '90d', '1y'];

export function PortfolioChart() {
  const [period, setPeriod] = useState<Period>('30d');
  const { isDark, label } = useThemedText();

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
        formatter: (value: number) => `$${(value / 1000000).toFixed(2)}M`,
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

  const chartSeries = [{ name: 'Portfolio', data: periodData[period] }];

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
        <Chart options={chartOptions} series={chartSeries} type="area" height="100%" width="100%" />
      </div>
    </ThemedCard>
  );
}
