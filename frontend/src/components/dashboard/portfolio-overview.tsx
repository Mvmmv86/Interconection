'use client';

import { Wallet, TrendingUp, BarChart3, Percent } from 'lucide-react';
import { StatCard } from '@/components/cards/stat-card';

interface PortfolioOverviewProps {
  totalValue: number;
  pnlToday: number;
  pnlTodayPercent: number;
  pnlMonth: number;
  pnlMonthPercent: number;
  avgApy: number;
  isLoading: boolean;
}

export function PortfolioOverview({
  totalValue,
  pnlToday,
  pnlTodayPercent,
  pnlMonth,
  pnlMonthPercent,
  avgApy,
  isLoading,
}: PortfolioOverviewProps) {
  const stats = [
    {
      label: 'Total Portfolio',
      value: isLoading ? 0 : totalValue,
      change: isLoading ? undefined : pnlTodayPercent,
      icon: <Wallet className="w-4 h-4" />,
      accentColor: 'blue' as const,
    },
    {
      label: 'P&L Today',
      value: isLoading ? 0 : pnlToday,
      change: isLoading ? undefined : pnlTodayPercent,
      icon: <TrendingUp className="w-4 h-4" />,
      accentColor: 'green' as const,
    },
    {
      label: 'P&L This Month',
      value: isLoading ? 0 : pnlMonth,
      change: isLoading ? undefined : pnlMonthPercent,
      icon: <BarChart3 className="w-4 h-4" />,
      accentColor: 'cyan' as const,
    },
    {
      label: 'Avg. Yield (APY)',
      value: isLoading ? 0 : avgApy,
      change: undefined,
      icon: <Percent className="w-4 h-4" />,
      accentColor: 'purple' as const,
    },
  ];

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
