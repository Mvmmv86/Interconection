'use client';

import { ArrowDownRight, ArrowUpRight, RefreshCw, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemedCard, useThemedText } from '@/components/ui/themed-card';

interface Activity {
  id: string;
  type: 'buy' | 'sell' | 'transfer' | 'reward';
  asset: string;
  amount: number;
  value: number;
  time: string;
  status: 'confirmed' | 'pending';
}

const mockActivities: Activity[] = [
  { id: '1', type: 'buy', asset: 'BTC', amount: 0.5, value: 50000, time: '2 min ago', status: 'confirmed' },
  { id: '2', type: 'reward', asset: 'ETH', amount: 0.12, value: 480, time: '15 min ago', status: 'confirmed' },
  { id: '3', type: 'sell', asset: 'SOL', amount: 100, value: 22000, time: '1h ago', status: 'confirmed' },
  { id: '4', type: 'transfer', asset: 'USDC', amount: 10000, value: 10000, time: '2h ago', status: 'pending' },
];

const activityConfig = {
  buy: {
    icon: ArrowDownRight,
    color: 'text-status-success',
    bgDark: 'rgba(34, 197, 94, 0.15)',
    bgLight: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(34, 197, 94, 0.04) 100%)',
    borderLight: 'rgba(34, 197, 94, 0.2)',
    shadowLight: 'rgba(34, 197, 94, 0.1)',
  },
  sell: {
    icon: ArrowUpRight,
    color: 'text-status-error',
    bgDark: 'rgba(239, 68, 68, 0.15)',
    bgLight: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.04) 100%)',
    borderLight: 'rgba(239, 68, 68, 0.2)',
    shadowLight: 'rgba(239, 68, 68, 0.1)',
  },
  transfer: {
    icon: RefreshCw,
    color: 'text-accent-blue',
    bgDark: 'rgba(59, 130, 246, 0.15)',
    bgLight: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.04) 100%)',
    borderLight: 'rgba(59, 130, 246, 0.2)',
    shadowLight: 'rgba(59, 130, 246, 0.1)',
  },
  reward: {
    icon: Gift,
    color: 'text-accent-cyan',
    bgDark: 'rgba(6, 182, 212, 0.15)',
    bgLight: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(6, 182, 212, 0.04) 100%)',
    borderLight: 'rgba(6, 182, 212, 0.2)',
    shadowLight: 'rgba(6, 182, 212, 0.1)',
  },
};

export function RecentActivity() {
  const { isDark, label } = useThemedText();

  return (
    <ThemedCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <span className={cn('text-[11px] font-semibold uppercase tracking-wider', label)}>
          Recent Activity
        </span>
        <button className="text-[10px] font-medium text-accent-blue hover:underline">View all</button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {mockActivities.map((activity) => {
          const config = activityConfig[activity.type];
          const Icon = config.icon;

          return (
            <div
              key={activity.id}
              className="rounded-lg transition-all duration-200"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)'
                  : '#f8fafc',
                border: isDark
                  ? '1px solid rgba(255, 255, 255, 0.05)'
                  : '1px solid #e2e8f0',
              }}
            >
              <div className="flex items-center gap-3 p-2.5">
                {/* Icon with gradient background */}
                <div
                  className={cn('w-9 h-9 rounded-lg flex items-center justify-center', config.color)}
                  style={{
                    background: isDark ? config.bgDark : config.bgLight,
                    border: isDark ? 'none' : `1px solid ${config.borderLight}`,
                    boxShadow: isDark ? 'none' : `0 2px 6px ${config.shadowLight}`,
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[11px] font-semibold capitalize',
                      isDark ? 'text-white' : 'text-slate-900'
                    )}>
                      {activity.type}
                    </span>
                    <span className={cn(
                      'text-[11px] font-medium',
                      isDark ? 'text-white/60' : 'text-slate-600'
                    )}>
                      {activity.amount} {activity.asset}
                    </span>
                  </div>
                  <span className={cn(
                    'text-[10px]',
                    isDark ? 'text-white/40' : 'text-slate-500'
                  )}>
                    {activity.time}
                  </span>
                </div>

                {/* Value & Status */}
                <div className="text-right">
                  <p className={cn(
                    'text-[12px] font-bold tabular-nums',
                    isDark ? 'text-white' : 'text-slate-900'
                  )}>
                    ${activity.value.toLocaleString()}
                  </p>
                  <span
                    className={cn(
                      'inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide',
                      activity.status === 'confirmed'
                        ? 'bg-status-success/15 text-status-success'
                        : 'bg-accent-yellow/15 text-accent-yellow'
                    )}
                  >
                    {activity.status}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ThemedCard>
  );
}
