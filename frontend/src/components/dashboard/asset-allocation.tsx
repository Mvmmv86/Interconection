'use client';

import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const allocationData = {
  series: [35, 25, 20, 12, 8],
  labels: ['Bitcoin', 'Ethereum', 'Stablecoins', 'DeFi', 'Other'],
};

export function AssetAllocation() {
  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'donut',
      background: 'transparent',
    },
    colors: ['#3b82f6', '#8b5cf6', '#22c55e', '#06b6d4', '#f97316'],
    labels: allocationData.labels,
    stroke: { show: false },
    plotOptions: {
      pie: {
        donut: {
          size: '80%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '10px',
              fontFamily: 'Inter',
              color: 'rgba(255, 255, 255, 0.4)',
              offsetY: -6,
            },
            value: {
              show: true,
              fontSize: '16px',
              fontFamily: 'Inter',
              fontWeight: 600,
              color: '#ffffff',
              offsetY: 2,
              formatter: () => '$2.45M',
            },
            total: {
              show: true,
              label: 'Total',
              fontSize: '10px',
              fontFamily: 'Inter',
              color: 'rgba(255, 255, 255, 0.3)',
              formatter: () => '$2.45M',
            },
          },
        },
      },
    },
    legend: {
      position: 'bottom',
      labels: { colors: 'rgba(255, 255, 255, 0.5)' },
      fontSize: '10px',
      fontFamily: 'Inter',
      markers: { offsetX: -2 },
      itemMargin: { horizontal: 6, vertical: 2 },
    },
    dataLabels: { enabled: false },
    tooltip: {
      theme: 'dark',
      y: { formatter: (val: number) => `${val}%` },
      style: { fontSize: '10px', fontFamily: 'Inter' },
    },
  };

  return (
    <div
      className="rounded-xl p-4 relative overflow-hidden"
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
      <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider relative z-10">Asset Allocation</span>
      <div className="h-[260px] mt-2 relative z-10">
        <Chart
          options={chartOptions}
          series={allocationData.series}
          type="donut"
          height="100%"
        />
      </div>
    </div>
  );
}
