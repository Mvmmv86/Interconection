'use client';

import dynamic from 'next/dynamic';
import {
  Droplets,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Percent,
  Activity,
  PieChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { PoolPosition, PROTOCOL_CONFIG, CHAIN_CONFIG } from './types';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface PoolsSummaryProps {
  positions: PoolPosition[];
}

export function PoolsSummary({ positions }: PoolsSummaryProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Calculate aggregate metrics
  const totalValue = positions.reduce((sum, p) => sum + p.totalValueUsd, 0);
  const totalFeesEarned = positions.reduce((sum, p) => sum + p.feesEarned.totalUsd, 0);
  const totalFeesUnclaimed = positions.reduce((sum, p) => sum + p.feesUnclaimed.totalUsd, 0);
  const totalRewardsUnclaimed = positions.reduce(
    (sum, p) => sum + (p.rewards?.reduce((r, reward) => r + reward.valueUsd, 0) || 0),
    0
  );
  const totalPnl = positions.reduce((sum, p) => sum + p.pnlUsd, 0);
  const totalIL = positions.reduce((sum, p) => sum + p.impermanentLossUsd, 0);

  const avgApr =
    positions.length > 0
      ? positions.reduce((sum, p) => sum + p.totalApr * p.totalValueUsd, 0) / totalValue
      : 0;

  const inRangePositions = positions.filter((p) => p.status === 'in-range').length;
  const outOfRangePositions = positions.filter((p) => p.status === 'out-of-range').length;

  // Distribution by protocol
  const protocolDistribution = positions.reduce((acc, p) => {
    const protocol = PROTOCOL_CONFIG[p.protocol].name;
    acc[protocol] = (acc[protocol] || 0) + p.totalValueUsd;
    return acc;
  }, {} as Record<string, number>);

  // Distribution by chain
  const chainDistribution = positions.reduce((acc, p) => {
    const chain = CHAIN_CONFIG[p.chain].name;
    acc[chain] = (acc[chain] || 0) + p.totalValueUsd;
    return acc;
  }, {} as Record<string, number>);

  // Distribution by network type
  const networkDistribution = positions.reduce((acc, p) => {
    const network = p.networkType === 'solana' ? 'Solana' : 'EVM';
    acc[network] = (acc[network] || 0) + p.totalValueUsd;
    return acc;
  }, {} as Record<string, number>);

  const evmPositions = positions.filter(p => p.networkType === 'evm').length;
  const solanaPositions = positions.filter(p => p.networkType === 'solana').length;

  const protocolChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'donut',
      background: 'transparent',
    },
    labels: Object.keys(protocolDistribution),
    colors: ['#ff007a', '#fa52a0', '#ff6b6b', '#1fc7d4', '#ffaf1d', '#0052ff'],
    dataLabels: { enabled: false },
    legend: { show: false },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: { show: true, fontSize: '10px', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(107,114,128,1)' },
            value: {
              show: true,
              fontSize: '14px',
              fontWeight: 600,
              color: isDark ? '#fff' : '#111827',
              formatter: (val) => `$${(Number(val) / 1000).toFixed(0)}K`,
            },
            total: {
              show: true,
              label: 'Total',
              fontSize: '10px',
              color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(107,114,128,1)',
              formatter: () => `$${(totalValue / 1000).toFixed(0)}K`,
            },
          },
        },
      },
    },
    stroke: { show: false },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (val) => `$${val.toLocaleString()}` },
    },
  };

  const chainChartOptions: ApexCharts.ApexOptions = {
    ...protocolChartOptions,
    labels: Object.keys(chainDistribution),
    colors: Object.keys(chainDistribution).map(
      (chain) =>
        Object.values(CHAIN_CONFIG).find((c) => c.name === chain)?.color || '#627eea'
    ),
  };

  const formatNumber = (num: number, decimals = 2) => {
    if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(decimals)}M`;
    if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(decimals)}K`;
    return `$${num.toFixed(decimals)}`;
  };

  return (
    <div className="space-y-4">
      {/* Main Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          className={cn(
            "backdrop-blur-md rounded-xl p-4",
            isDark ? "border border-white/[0.06]" : "border border-gray-200/60"
          )}
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)'
              : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
            boxShadow: isDark
              ? '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
              : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          }}
        >
          <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center mb-2">
            <Droplets className="w-4 h-4 text-accent-purple" />
          </div>
          <p className={cn("text-[10px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>Total Liquidity</p>
          <p className={cn("text-[20px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
            {formatNumber(totalValue)}
          </p>
          <p className={cn("text-[10px] mt-0.5", isDark ? "text-white/30" : "text-gray-500")}>{positions.length} positions</p>
        </div>

        <div
          className={cn(
            "backdrop-blur-md rounded-xl p-4",
            isDark ? "border border-white/[0.06]" : "border border-gray-200/60"
          )}
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)'
              : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
            boxShadow: isDark
              ? '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
              : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          }}
        >
          <div className="w-8 h-8 rounded-lg bg-status-success/10 flex items-center justify-center mb-2">
            <DollarSign className="w-4 h-4 text-status-success" />
          </div>
          <p className={cn("text-[10px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>Total Fees Earned</p>
          <p className="text-[20px] font-semibold text-status-success tabular-nums">
            {formatNumber(totalFeesEarned)}
          </p>
          <p className="text-[10px] text-accent-cyan mt-0.5">
            +{formatNumber(totalFeesUnclaimed)} unclaimed
          </p>
        </div>

        <div
          className={cn(
            "backdrop-blur-md rounded-xl p-4",
            isDark ? "border border-white/[0.06]" : "border border-gray-200/60"
          )}
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)'
              : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
            boxShadow: isDark
              ? '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
              : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          }}
        >
          <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 flex items-center justify-center mb-2">
            <Percent className="w-4 h-4 text-accent-cyan" />
          </div>
          <p className={cn("text-[10px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>Avg APR</p>
          <p className={cn("text-[20px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
            {avgApr.toFixed(1)}%
          </p>
          <p className={cn("text-[10px] mt-0.5", isDark ? "text-white/30" : "text-gray-500")}>weighted by value</p>
        </div>

        <div
          className={cn(
            "backdrop-blur-md rounded-xl p-4",
            isDark ? "border border-white/[0.06]" : "border border-gray-200/60"
          )}
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)'
              : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
            boxShadow: isDark
              ? '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
              : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          }}
        >
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center mb-2',
              totalPnl >= 0 ? 'bg-status-success/10' : 'bg-status-error/10'
            )}
          >
            {totalPnl >= 0 ? (
              <TrendingUp className="w-4 h-4 text-status-success" />
            ) : (
              <TrendingDown className="w-4 h-4 text-status-error" />
            )}
          </div>
          <p className={cn("text-[10px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>Total PnL</p>
          <p
            className={cn(
              'text-[20px] font-semibold tabular-nums',
              totalPnl >= 0 ? 'text-status-success' : 'text-status-error'
            )}
          >
            {totalPnl >= 0 ? '+' : ''}
            {formatNumber(totalPnl)}
          </p>
          <p className="text-[10px] text-status-error mt-0.5">
            IL: {formatNumber(totalIL)}
          </p>
        </div>
      </div>

      {/* Secondary Stats & Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Position Health */}
        <div
          className={cn(
            "backdrop-blur-md rounded-xl p-4",
            isDark ? "border border-white/[0.06]" : "border border-gray-200/60"
          )}
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)'
              : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
            boxShadow: isDark
              ? '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
              : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          }}
        >
          <div className={cn("flex items-center justify-between pb-3 mb-3 border-b", isDark ? "border-white/[0.06]" : "border-gray-200")}>
            <h3 className={cn("text-[12px] font-semibold uppercase tracking-wider", isDark ? "text-white" : "text-gray-900")}>
              Position Health
            </h3>
            <Activity className={cn("w-4 h-4", isDark ? "text-white/30" : "text-gray-500")} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-success" />
                <span className={cn("text-[11px]", isDark ? "text-white/70" : "text-gray-600")}>In Range</span>
              </div>
              <span className={cn("text-[12px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                {inRangePositions} positions
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-error" />
                <span className={cn("text-[11px]", isDark ? "text-white/70" : "text-gray-600")}>Out of Range</span>
              </div>
              <span className={cn("text-[12px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                {outOfRangePositions} positions
              </span>
            </div>

            {/* Network Distribution */}
            <div className={cn("pt-2 mt-2 border-t", isDark ? "border-white/[0.03]" : "border-gray-100")}>
              <p className={cn("text-[9px] uppercase tracking-wider mb-2", isDark ? "text-white/30" : "text-gray-500")}>By Network</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#627eea]" />
                  <span className={cn("text-[10px]", isDark ? "text-white/70" : "text-gray-600")}>EVM</span>
                  <span className={cn("text-[10px] font-medium", isDark ? "text-white" : "text-gray-900")}>{evmPositions}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#9945ff]" />
                  <span className={cn("text-[10px]", isDark ? "text-white/70" : "text-gray-600")}>Solana</span>
                  <span className={cn("text-[10px] font-medium", isDark ? "text-white" : "text-gray-900")}>{solanaPositions}</span>
                </div>
              </div>
              {/* Network Value Bar */}
              <div className={cn("flex h-1.5 rounded-full overflow-hidden mt-2", isDark ? "bg-white/[0.05]" : "bg-gray-100")}>
                {networkDistribution['EVM'] && (
                  <div
                    className="bg-[#627eea]"
                    style={{ width: `${(networkDistribution['EVM'] / totalValue) * 100}%` }}
                  />
                )}
                {networkDistribution['Solana'] && (
                  <div
                    className="bg-[#9945ff]"
                    style={{ width: `${(networkDistribution['Solana'] / totalValue) * 100}%` }}
                  />
                )}
              </div>
            </div>

            {outOfRangePositions > 0 && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-status-error/5 border border-status-error/10">
                <AlertTriangle className="w-4 h-4 text-status-error shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-medium text-status-error">Action Required</p>
                  <p className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
                    {outOfRangePositions} position{outOfRangePositions > 1 ? 's' : ''} not earning
                    fees
                  </p>
                </div>
              </div>
            )}

            {/* Unclaimed Summary */}
            <div className={cn("pt-2 border-t", isDark ? "border-white/[0.03]" : "border-gray-100")}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>Unclaimed Fees</span>
                <span className="text-[11px] font-medium text-status-success tabular-nums">
                  {formatNumber(totalFeesUnclaimed)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>Unclaimed Rewards</span>
                <span className="text-[11px] font-medium text-accent-purple tabular-nums">
                  {formatNumber(totalRewardsUnclaimed)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Protocol Distribution */}
        <div
          className={cn(
            "backdrop-blur-md rounded-xl p-4",
            isDark ? "border border-white/[0.06]" : "border border-gray-200/60"
          )}
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)'
              : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
            boxShadow: isDark
              ? '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
              : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          }}
        >
          <div className={cn("flex items-center justify-between pb-3 mb-3 border-b", isDark ? "border-white/[0.06]" : "border-gray-200")}>
            <h3 className={cn("text-[12px] font-semibold uppercase tracking-wider", isDark ? "text-white" : "text-gray-900")}>
              By Protocol
            </h3>
            <PieChart className={cn("w-4 h-4", isDark ? "text-white/30" : "text-gray-500")} />
          </div>

          <div className="h-[120px]">
            <Chart
              options={protocolChartOptions}
              series={Object.values(protocolDistribution)}
              type="donut"
              height="100%"
            />
          </div>

          <div className="space-y-1.5 mt-2">
            {Object.entries(protocolDistribution).map(([protocol, value], idx) => (
              <div key={protocol} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: ['#ff007a', '#fa52a0', '#ff6b6b', '#1fc7d4', '#ffaf1d', '#0052ff'][idx % 6],
                    }}
                  />
                  <span className={cn("text-[10px]", isDark ? "text-white/70" : "text-gray-600")}>{protocol}</span>
                </div>
                <span className={cn("text-[10px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                  {formatNumber(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chain Distribution */}
        <div
          className={cn(
            "backdrop-blur-md rounded-xl p-4",
            isDark ? "border border-white/[0.06]" : "border border-gray-200/60"
          )}
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)'
              : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
            boxShadow: isDark
              ? '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
              : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          }}
        >
          <div className={cn("flex items-center justify-between pb-3 mb-3 border-b", isDark ? "border-white/[0.06]" : "border-gray-200")}>
            <h3 className={cn("text-[12px] font-semibold uppercase tracking-wider", isDark ? "text-white" : "text-gray-900")}>
              By Chain
            </h3>
            <PieChart className={cn("w-4 h-4", isDark ? "text-white/30" : "text-gray-500")} />
          </div>

          <div className="h-[120px]">
            <Chart
              options={chainChartOptions}
              series={Object.values(chainDistribution)}
              type="donut"
              height="100%"
            />
          </div>

          <div className="space-y-1.5 mt-2">
            {Object.entries(chainDistribution).map(([chain, value]) => {
              const chainConfig = Object.values(CHAIN_CONFIG).find((c) => c.name === chain);
              return (
                <div key={chain} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: chainConfig?.color || '#627eea' }}
                    />
                    <span className={cn("text-[10px]", isDark ? "text-white/70" : "text-gray-600")}>{chain}</span>
                  </div>
                  <span className={cn("text-[10px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                    {formatNumber(value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
