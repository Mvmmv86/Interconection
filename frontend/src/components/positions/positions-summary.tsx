'use client';

import { Wallet, TrendingUp, TrendingDown, Building2, Layers, Coins, Snowflake, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { useAllPositions } from '@/hooks/useAllPositions';

interface SummaryCard {
  label: string;
  value: string;
  subValue?: string;
  change?: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(2)}`;
}

export function PositionsSummary() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { summary, isLoading } = useAllPositions();

  const summaryData: SummaryCard[] = [
    {
      label: 'Total Positions',
      value: formatCurrency(summary.totalValue),
      subValue: `${summary.totalPositionCount} positions`,
      change: summary.totalChangePercent24h,
      icon: Wallet,
      iconBg: 'bg-accent-purple/10',
      iconColor: 'text-accent-purple',
    },
    {
      label: 'Exchange Holdings',
      value: formatCurrency(summary.exchangeHoldings),
      subValue: summary.exchangeCount > 0
        ? `${summary.exchangeCount} exchange${summary.exchangeCount > 1 ? 's' : ''}`
        : 'No exchanges connected',
      change: undefined, // TODO: calculate from exchange data
      icon: Building2,
      iconBg: 'bg-accent-blue/10',
      iconColor: 'text-accent-blue',
    },
    {
      label: 'DeFi Positions',
      value: formatCurrency(summary.defiPositions),
      subValue: `${summary.protocolCount} protocol${summary.protocolCount !== 1 ? 's' : ''}`,
      change: undefined, // TODO: calculate 24h change
      icon: Layers,
      iconBg: 'bg-accent-cyan/10',
      iconColor: 'text-accent-cyan',
    },
    {
      label: 'Staking & Yield',
      value: formatCurrency(summary.stakingAndYield),
      subValue: summary.avgApy && summary.avgApy > 0
        ? `${summary.avgApy.toFixed(1)}% avg APY`
        : 'No yield data',
      change: undefined,
      icon: Coins,
      iconBg: 'bg-status-success/10',
      iconColor: 'text-status-success',
    },
    {
      label: 'Cold Wallets',
      value: formatCurrency(summary.coldWallets),
      subValue: summary.walletCount > 0
        ? `${summary.walletCount} wallet${summary.walletCount > 1 ? 's' : ''}`
        : 'Not configured',
      change: 0,
      icon: Snowflake,
      iconBg: 'bg-accent-orange/10',
      iconColor: 'text-accent-orange',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, index) => (
          <div
            key={index}
            className="backdrop-blur-sm rounded-xl p-4 animate-pulse"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
                : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
              border: isDark
                ? '1px solid rgba(255, 255, 255, 0.08)'
                : '1px solid rgba(203, 213, 225, 0.6)',
            }}
          >
            <div className="flex items-center justify-center h-[80px]">
              <Loader2 className={cn('w-5 h-5 animate-spin', isDark ? 'text-white/30' : 'text-gray-400')} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {summaryData.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="backdrop-blur-sm rounded-xl p-4"
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
            <div className="flex items-start justify-between mb-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', card.iconBg)}>
                <Icon className={cn('w-5 h-5', card.iconColor)} />
              </div>
              {card.change !== undefined && card.change !== 0 && (
                <div
                  className={cn(
                    'flex items-center gap-0.5 text-[10px] font-medium',
                    (card.change ?? 0) > 0 ? 'text-status-success' : 'text-status-error'
                  )}
                >
                  {(card.change ?? 0) > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {(card.change ?? 0) > 0 ? '+' : ''}{(card.change ?? 0).toFixed(1)}%
                </div>
              )}
            </div>
            <p className={cn('text-[10px] uppercase tracking-wider mb-1', isDark ? 'text-white/30' : 'text-gray-500')}>{card.label}</p>
            <p className={cn('text-[18px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>{card.value}</p>
            {card.subValue && (
              <p className={cn('text-[10px] mt-0.5', isDark ? 'text-white/70' : 'text-gray-700')}>{card.subValue}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
