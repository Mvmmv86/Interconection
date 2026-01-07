'use client';

import { AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  type: 'price_high' | 'price_low' | 'health_factor' | 'yield';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

const mockAlerts: Alert[] = [
  { id: '1', type: 'health_factor', title: 'Health Factor Warning', message: 'Aave position HF dropped to 1.3', priority: 'high' },
  { id: '2', type: 'price_high', title: 'BTC Price Target', message: 'Bitcoin reached $105,000', priority: 'medium' },
  { id: '3', type: 'yield', title: 'Yield Drop Alert', message: 'Curve pool APY dropped below 5%', priority: 'low' },
];

const alertIcons = {
  price_high: TrendingUp,
  price_low: TrendingUp,
  health_factor: AlertTriangle,
  yield: Activity,
};

const priorityConfig = {
  high: { border: 'border-l-status-error', dot: 'bg-status-error' },
  medium: { border: 'border-l-accent-yellow', dot: 'bg-accent-yellow' },
  low: { border: 'border-l-accent-blue', dot: 'bg-accent-blue' },
};

export function PendingAlerts() {
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
        <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Pending Alerts</span>
        <span className="text-[10px] text-status-error">{mockAlerts.length} active</span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {mockAlerts.map((alert) => {
          const Icon = alertIcons[alert.type];
          const config = priorityConfig[alert.priority];

          return (
            <div
              key={alert.id}
              className={cn(
                'p-2.5 rounded-lg bg-white/[0.02] border-l-2',
                config.border
              )}
            >
              <div className="flex items-start gap-2.5">
                <Icon className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-medium text-text-primary">{alert.title}</span>
                    <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
                  </div>
                  <p className="text-[10px] text-text-muted">{alert.message}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
