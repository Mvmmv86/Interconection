'use client';

import { AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemedCard, useThemedText } from '@/components/ui/themed-card';

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
  high: {
    borderColor: '#ef4444',
    iconColor: 'text-status-error',
    bgDark: 'rgba(239, 68, 68, 0.15)',
    bgLight: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.02) 100%)',
    dotBg: 'bg-status-error',
    glowLight: 'rgba(239, 68, 68, 0.15)',
  },
  medium: {
    borderColor: '#eab308',
    iconColor: 'text-amber-500',
    bgDark: 'rgba(234, 179, 8, 0.15)',
    bgLight: 'linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(234, 179, 8, 0.02) 100%)',
    dotBg: 'bg-accent-yellow',
    glowLight: 'rgba(234, 179, 8, 0.15)',
  },
  low: {
    borderColor: '#3b82f6',
    iconColor: 'text-accent-blue',
    bgDark: 'rgba(59, 130, 246, 0.15)',
    bgLight: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.02) 100%)',
    dotBg: 'bg-accent-blue',
    glowLight: 'rgba(59, 130, 246, 0.15)',
  },
};

export function PendingAlerts() {
  const { isDark, label } = useThemedText();

  return (
    <ThemedCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <span className={cn('text-[11px] font-semibold uppercase tracking-wider', label)}>
          Pending Alerts
        </span>
        <span className="px-2 py-0.5 rounded-full bg-status-error/15 text-[10px] font-bold text-status-error">
          {mockAlerts.length} active
        </span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {mockAlerts.map((alert) => {
          const Icon = alertIcons[alert.type];
          const config = priorityConfig[alert.priority];

          return (
            <div
              key={alert.id}
              className="rounded-lg overflow-hidden transition-all duration-200"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)'
                  : '#f8fafc',
                border: isDark
                  ? '1px solid rgba(255, 255, 255, 0.05)'
                  : '1px solid #e2e8f0',
              }}
            >
              {/* Priority indicator bar */}
              <div
                className="h-[3px]"
                style={{
                  background: `linear-gradient(90deg, ${config.borderColor} 0%, transparent 100%)`,
                }}
              />

              <div className="p-2.5">
                <div className="flex items-start gap-3">
                  {/* Icon with styled background */}
                  <div
                    className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', config.iconColor)}
                    style={{
                      background: isDark ? config.bgDark : config.bgLight,
                      border: isDark ? 'none' : `1px solid ${config.borderColor}20`,
                      boxShadow: isDark ? 'none' : `0 2px 6px ${config.glowLight}`,
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        'text-[11px] font-semibold',
                        isDark ? 'text-white' : 'text-slate-900'
                      )}>
                        {alert.title}
                      </span>
                      <span
                        className={cn('w-2 h-2 rounded-full animate-pulse', config.dotBg)}
                        style={{
                          boxShadow: `0 0 6px ${config.borderColor}`,
                        }}
                      />
                    </div>
                    <p className={cn(
                      'text-[10px]',
                      isDark ? 'text-white/50' : 'text-slate-600'
                    )}>
                      {alert.message}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ThemedCard>
  );
}
