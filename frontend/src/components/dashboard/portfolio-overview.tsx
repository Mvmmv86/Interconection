'use client';

import { Wallet, TrendingUp, BarChart3, Percent } from 'lucide-react';
import { StatCard } from '@/components/cards/stat-card';

const stats = [
  {
    label: 'Total Portfolio',
    value: 2450000,
    change: 12.5,
    icon: <Wallet className="w-4 h-4" />,
    accentColor: 'blue' as const,
  },
  {
    label: 'P&L Today',
    value: 34500,
    change: 2.3,
    icon: <TrendingUp className="w-4 h-4" />,
    accentColor: 'green' as const,
  },
  {
    label: 'P&L This Month',
    value: 156000,
    change: 8.7,
    icon: <BarChart3 className="w-4 h-4" />,
    accentColor: 'cyan' as const,
  },
  {
    label: 'Avg. Yield (APY)',
    value: 12.4,
    change: 0.5,
    icon: <Percent className="w-4 h-4" />,
    accentColor: 'purple' as const,
  },
];

export function PortfolioOverview() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          change={stat.change}
          icon={stat.icon}
          accentColor={stat.accentColor}
        />
      ))}
    </div>
  );
}
