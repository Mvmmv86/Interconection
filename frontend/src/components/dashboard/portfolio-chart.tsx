'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

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

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'area',
      background: 'transparent',
      toolbar: { show: false },
      animations: { enabled: true, speed: 500 },
      zoom: { enabled: false },
    },
    colors: ['#3b82f6'],
    stroke: { curve: 'smooth', width: 1.5 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.25,
        opacityTo: 0,
        stops: [0, 100],
        colorStops: [
          { offset: 0, color: '#3b82f6', opacity: 0.25 },
          { offset: 100, color: '#3b82f6', opacity: 0 },
        ],
      },
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.03)',
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { left: 0, right: 0 },
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: { colors: 'rgba(255, 255, 255, 0.25)', fontSize: '10px', fontFamily: 'Inter' },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: 'rgba(255, 255, 255, 0.25)', fontSize: '10px', fontFamily: 'Inter' },
        formatter: (value: number) => `$${(value / 1000000).toFixed(2)}M`,
      },
    },
    tooltip: {
      theme: 'dark',
      x: { format: 'MMM dd, yyyy' },
      y: { formatter: (value: number) => `$${value.toLocaleString()}` },
      style: { fontSize: '11px', fontFamily: 'Inter' },
    },
    dataLabels: { enabled: false },
  };

  const chartSeries = [{ name: 'Portfolio', data: periodData[period] }];

  return (
    <div
      className="col-span-2 rounded-xl p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: `
          0 4px 24px rgba(0, 0, 0, 0.3),
          0 1px 2px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.05)
        `,
      }}
    >
      {/* Top shine effect */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Portfolio Evolution</span>
        <div
          className="flex items-center gap-0.5 p-0.5 rounded-md"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-2.5 py-1 text-[10px] font-medium rounded transition-all',
                period === p
                  ? 'bg-accent-blue text-white'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[260px]">
        <Chart options={chartOptions} series={chartSeries} type="area" height="100%" />
      </div>
    </div>
  );
}
