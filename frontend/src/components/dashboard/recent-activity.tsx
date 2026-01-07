'use client';

import { ArrowDownRight, ArrowUpRight, RefreshCw, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  buy: { icon: ArrowDownRight, color: 'text-status-success' },
  sell: { icon: ArrowUpRight, color: 'text-status-error' },
  transfer: { icon: RefreshCw, color: 'text-accent-blue' },
  reward: { icon: Gift, color: 'text-accent-cyan' },
};

export function RecentActivity() {
  return (
    <div
      className="rounded-xl p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: `
          0 4px 24px rgba(0, 0, 0, 0.3),
          0 1px 2px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.05)
        `,
      }}
    >
      {/* Top shine effect */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Recent Activity</span>
        <button className="text-[10px] text-accent-blue hover:underline">View all</button>
      </div>

      {/* List */}
      <div className="space-y-1">
        {mockActivities.map((activity) => {
          const config = activityConfig[activity.type];
          const Icon = config.icon;

          return (
            <div
              key={activity.id}
              className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors"
            >
              <div className={cn('w-7 h-7 rounded-md bg-white/[0.03] flex items-center justify-center', config.color)}>
                <Icon className="w-3.5 h-3.5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-text-primary capitalize">{activity.type}</span>
                  <span className="text-[11px] text-text-muted">{activity.amount} {activity.asset}</span>
                </div>
                <span className="text-[10px] text-text-muted">{activity.time}</span>
              </div>

              <div className="text-right">
                <p className="text-[11px] font-medium text-text-primary tabular-nums">
                  ${activity.value.toLocaleString()}
                </p>
                <span className={cn(
                  'text-[9px] font-medium uppercase tracking-wide',
                  activity.status === 'confirmed' ? 'text-status-success' : 'text-accent-yellow'
                )}>
                  {activity.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
