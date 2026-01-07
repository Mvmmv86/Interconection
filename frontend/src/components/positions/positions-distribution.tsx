'use client';

import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface DistributionData {
  label: string;
  value: number;
  color: string;
}

const byTypeData: DistributionData[] = [
  { label: 'Spot Holdings', value: 45, color: '#3b82f6' },
  { label: 'DeFi/Lending', value: 25, color: '#a855f7' },
  { label: 'Staking', value: 15, color: '#22c55e' },
  { label: 'Liquidity Pools', value: 10, color: '#00d4ff' },
  { label: 'Derivatives', value: 5, color: '#f97316' },
];

const byChainData: DistributionData[] = [
  { label: 'Ethereum', value: 52, color: '#627eea' },
  { label: 'Bitcoin', value: 24, color: '#f7931a' },
  { label: 'Solana', value: 12, color: '#00ffa3' },
  { label: 'Arbitrum', value: 7, color: '#28a0f0' },
  { label: 'Others', value: 5, color: '#64748b' },
];

export function PositionsDistribution() {
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
              color: 'rgba(255, 255, 255, 0.5)',
              offsetY: -5,
            },
            value: {
              show: true,
              fontSize: '16px',
              fontWeight: 600,
              color: '#ffffff',
              offsetY: 5,
              formatter: (val) => `${val}%`,
            },
            total: {
              show: true,
              label: 'By Type',
              fontSize: '9px',
              color: 'rgba(255, 255, 255, 0.4)',
              formatter: () => '$2.46M',
            },
          },
        },
      },
    },
    tooltip: {
      enabled: true,
      theme: 'dark',
      y: { formatter: (val: number) => `${val}%` },
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
              color: 'rgba(255, 255, 255, 0.5)',
              offsetY: -5,
            },
            value: {
              show: true,
              fontSize: '16px',
              fontWeight: 600,
              color: '#ffffff',
              offsetY: 5,
              formatter: (val) => `${val}%`,
            },
            total: {
              show: true,
              label: 'By Chain',
              fontSize: '9px',
              color: 'rgba(255, 255, 255, 0.4)',
              formatter: () => '5 chains',
            },
          },
        },
      },
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* By Type */}
      <div
        className="backdrop-blur-md rounded-xl border border-white/[0.06] p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        }}
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
          <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">
            Distribution by Type
          </h3>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-[140px] h-[140px]">
            <Chart
              options={typeChartOptions}
              series={byTypeData.map((d) => d.value)}
              type="donut"
              height="100%"
            />
          </div>
          <div className="flex-1 space-y-2">
            {byTypeData.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[10px] text-text-secondary">{item.label}</span>
                </div>
                <span className="text-[10px] font-medium text-text-primary tabular-nums">
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By Chain */}
      <div
        className="backdrop-blur-md rounded-xl border border-white/[0.06] p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        }}
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
          <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">
            Distribution by Chain
          </h3>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-[140px] h-[140px]">
            <Chart
              options={chainChartOptions}
              series={byChainData.map((d) => d.value)}
              type="donut"
              height="100%"
            />
          </div>
          <div className="flex-1 space-y-2">
            {byChainData.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[10px] text-text-secondary">{item.label}</span>
                </div>
                <span className="text-[10px] font-medium text-text-primary tabular-nums">
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
