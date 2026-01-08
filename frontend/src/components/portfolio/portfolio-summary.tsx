'use client';

import { TrendingUp, TrendingDown, Wallet, PiggyBank, Coins, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

interface SummaryCardProps {
  label: string;
  value: string;
  change?: number;
  subValue?: string;
  icon: React.ReactNode;
  accentColor: 'blue' | 'green' | 'purple' | 'cyan' | 'orange';
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

function SummaryCard({ label, value, change, subValue, icon, accentColor }: SummaryCardProps) {
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
            isDark ? 'text-white' : 'text-gray-900'
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

export function PortfolioSummary() {
  const summaryData = [
    {
      label: 'Total AUM',
      value: '$2,456,789',
      change: 12.5,
      subValue: '24h',
      icon: <Wallet className="w-5 h-5" />,
      accentColor: 'blue' as const,
    },
    {
      label: 'Unrealized P&L',
      value: '$345,678',
      change: 8.7,
      subValue: 'all time',
      icon: <TrendingUp className="w-5 h-5" />,
      accentColor: 'green' as const,
    },
    {
      label: 'Realized P&L (YTD)',
      value: '$123,456',
      change: 15.2,
      icon: <BarChart3 className="w-5 h-5" />,
      accentColor: 'purple' as const,
    },
    {
      label: 'Yield Earnings',
      value: '$45,678',
      change: 4.8,
      subValue: 'APY avg',
      icon: <PiggyBank className="w-5 h-5" />,
      accentColor: 'cyan' as const,
    },
    {
      label: 'Active Positions',
      value: '47',
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
