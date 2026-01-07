'use client';

import { Wallet, TrendingUp, TrendingDown, Building2, Layers, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {summaryData.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="backdrop-blur-md rounded-xl border border-white/[0.06] p-4"
            style={{
              background: 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
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
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{card.label}</p>
            <p className="text-[18px] font-semibold text-text-primary tabular-nums">{card.value}</p>
            {card.subValue && (
              <p className="text-[10px] text-text-secondary mt-0.5">{card.subValue}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
