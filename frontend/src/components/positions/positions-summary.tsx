'use client';

import { Wallet, TrendingUp, TrendingDown, Building2, Layers, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

interface SummaryCard {
  label: string;
  value: string;
  subValue?: string;
  change?: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

const summaryData: SummaryCard[] = [
  {
    label: 'Total Positions',
    value: '$2.46M',
    subValue: '127 positions',
    change: 3.2,
    icon: Wallet,
    iconBg: 'bg-accent-purple/10',
    iconColor: 'text-accent-purple',
  },
  {
    label: 'Exchange Holdings',
    value: '$824K',
    subValue: '4 exchanges',
    change: 2.1,
    icon: Building2,
    iconBg: 'bg-accent-blue/10',
    iconColor: 'text-accent-blue',
  },
  {
    label: 'DeFi Positions',
    value: '$605K',
    subValue: '12 protocols',
    change: 4.5,
    icon: Layers,
    iconBg: 'bg-accent-cyan/10',
    iconColor: 'text-accent-cyan',
  },
  {
    label: 'Staking & Yield',
    value: '$556K',
    subValue: '5.8% avg APY',
    change: 1.8,
    icon: Coins,
    iconBg: 'bg-status-success/10',
    iconColor: 'text-status-success',
  },
  {
    label: 'Cold Wallets',
    value: '$475K',
    subValue: '8 wallets',
    change: 0,
    icon: Wallet,
    iconBg: 'bg-accent-orange/10',
    iconColor: 'text-accent-orange',
  },
];

export function PositionsSummary() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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
                  {(card.change ?? 0) > 0 ? '+' : ''}{card.change}%
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
