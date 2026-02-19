'use client';

import { TrendingUp, TrendingDown, Wallet, PiggyBank, Coins, BarChart3, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

export interface PortfolioSummaryProps {
  totalAum: number;
  aumChange24h?: number;
  unrealizedPnl: number;
  unrealizedPnlPercent?: number;
  realizedPnl: number | null; // null = not available yet
  yieldEarnings: number;
  avgApy?: number;
  activePositions: number;
  isLoading?: boolean;
}

interface SummaryCardProps {
  label: string;
  value: string;
  change?: number;
  subValue?: string;
  icon: React.ReactNode;
  accentColor: 'blue' | 'green' | 'purple' | 'cyan' | 'orange';
  muted?: boolean;
}

const accentColors = {
  blue: 'from-accent-blue/20 to-accent-blue/5',
  green: 'from-status-success/20 to-status-success/5',
  purple: 'from-accent-purple/20 to-accent-purple/5',
  cyan: 'from-accent-cyan/20 to-accent-cyan/5',
  orange: 'from-accent-orange/20 to-accent-orange/5',
};

const iconBgColors = {
  blue: 'bg-accent-blue/10 text-accent-blue',
  green: 'bg-status-success/10 text-status-success',
  purple: 'bg-accent-purple/10 text-accent-purple',
  cyan: 'bg-accent-cyan/10 text-accent-cyan',
  orange: 'bg-accent-orange/10 text-accent-orange',
};

/**
 * Format a USD value for display
 */
function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
  return `$${value.toFixed(2)}`;
}

function SummaryCard({ label, value, change, subValue, icon, accentColor, muted }: SummaryCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isPositive = change !== undefined && change >= 0;

  return (
    <div
      className="relative backdrop-blur-sm rounded-xl p-4 overflow-hidden group hover:scale-[1.02] transition-all duration-300"
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

      {/* Gradient accent */}
      <div
        className={cn(
          'absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-40 group-hover:opacity-50 transition-opacity',
          `bg-gradient-to-br ${accentColors[accentColor]}`
        )}
      />

      <div className="relative flex items-start justify-between">
        <div className="space-y-1">
          <p className={cn(
            'text-[10px] font-medium uppercase tracking-wider',
            isDark ? 'text-white/40' : 'text-gray-500'
          )}>
            {label}
          </p>
          <p className={cn(
            'text-xl font-semibold tabular-nums',
            muted
              ? (isDark ? 'text-white/30' : 'text-gray-400')
              : (isDark ? 'text-white' : 'text-gray-900')
          )}>
            {value}
          </p>
          {change !== undefined && (
            <div className="flex items-center gap-1">
              {isPositive ? (
                <TrendingUp className="w-3 h-3 text-status-success" />
              ) : (
                <TrendingDown className="w-3 h-3 text-status-error" />
              )}
              <span
                className={cn(
                  'text-[10px] font-medium tabular-nums',
                  isPositive ? 'text-status-success' : 'text-status-error'
                )}
              >
                {isPositive ? '+' : ''}{change.toFixed(2)}%
              </span>
              {subValue && (
                <span className={cn(
                  'text-[10px] ml-1',
                  isDark ? 'text-white/30' : 'text-gray-500'
                )}>
                  {subValue}
                </span>
              )}
            </div>
          )}
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconBgColors[accentColor])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function PortfolioSummary({
  totalAum,
  aumChange24h,
  unrealizedPnl,
  unrealizedPnlPercent,
  realizedPnl,
  yieldEarnings,
  avgApy,
  activePositions,
  isLoading,
}: PortfolioSummaryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="backdrop-blur-sm rounded-xl p-4 flex items-center justify-center h-[88px]"
            style={{
              background: 'rgba(22, 25, 35, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <Loader2 className="w-5 h-5 animate-spin text-white/20" />
          </div>
        ))}
      </div>
    );
  }

  const summaryData: (SummaryCardProps)[] = [
    {
      label: 'Total AUM',
      value: formatUsd(totalAum),
      change: aumChange24h,
      subValue: '24h',
      icon: <Wallet className="w-5 h-5" />,
      accentColor: 'blue' as const,
    },
    {
      label: 'Unrealized P&L',
      value: `${unrealizedPnl >= 0 ? '+' : ''}${formatUsd(unrealizedPnl)}`,
      change: unrealizedPnlPercent,
      subValue: '24h',
      icon: unrealizedPnl >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />,
      accentColor: 'green' as const,
    },
    {
      label: 'Realized P&L (YTD)',
      value: realizedPnl !== null ? formatUsd(realizedPnl) : '--',
      change: realizedPnl !== null ? undefined : undefined,
      subValue: realizedPnl === null ? 'Coming Soon' : undefined,
      icon: <BarChart3 className="w-5 h-5" />,
      accentColor: 'purple' as const,
      muted: realizedPnl === null,
    },
    {
      label: 'Yield Earnings',
      value: formatUsd(yieldEarnings),
      change: avgApy,
      subValue: 'APY avg',
      icon: <PiggyBank className="w-5 h-5" />,
      accentColor: 'cyan' as const,
    },
    {
      label: 'Active Positions',
      value: String(activePositions),
      icon: <Coins className="w-5 h-5" />,
      accentColor: 'orange' as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {summaryData.map((item) => (
        <SummaryCard key={item.label} {...item} />
      ))}
    </div>
  );
}
