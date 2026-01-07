'use client';

import dynamic from 'next/dynamic';

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
        style: { colors: 'rgba(255, 255, 255, 0.3)', fontSize: '10px', fontFamily: 'Inter' },
        formatter: (val) => `$${(Number(val) / 1000000).toFixed(1)}M`,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: 'rgba(255, 255, 255, 0.5)', fontSize: '10px', fontFamily: 'Inter' },
      },
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.03)',
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    legend: { show: false },
    tooltip: {
      theme: 'dark',
      y: { formatter: (val: number) => `$${val.toLocaleString()}` },
      style: { fontSize: '10px', fontFamily: 'Inter' },
    },
  };

  const chartSeries = [{ name: 'Value', data: chainData.map((c) => c.value) }];

  return (
    <div
      className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden"
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
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06] relative z-10">
        <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">
          Allocation by Chain
        </h3>
        <span className="text-[10px] text-text-muted">6 networks</span>
      </div>

      <div className="h-[180px]">
        <Chart options={chartOptions} series={chartSeries} type="bar" height="100%" />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/[0.03]">
        <div className="text-center">
          <p className="text-[10px] text-text-muted">Main Chain</p>
          <p className="text-[11px] font-medium text-text-primary">Ethereum</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-text-muted">L2 Exposure</p>
          <p className="text-[11px] font-medium text-accent-blue">12%</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-text-muted">Networks</p>
          <p className="text-[11px] font-medium text-text-primary">6</p>
        </div>
      </div>
    </div>
  );
}
