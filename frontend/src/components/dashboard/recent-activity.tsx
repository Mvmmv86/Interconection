'use client';

import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, RefreshCw, Gift, Activity as ActivityIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemedCard, useThemedText } from '@/components/ui/themed-card';
import type { NormalizedTransaction } from '@/lib/defi';
import type { ExchangeTransactionData } from '@/types/positions';

interface UnifiedActivity {
  id: string;
  type: 'buy' | 'sell' | 'transfer' | 'reward' | 'swap' | 'stake';
  asset: string;
  amount: number;
  value: number;
  time: string;
  timestamp: number;
  status: 'confirmed' | 'pending';
}

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
  swap: {
    icon: RefreshCw,
    color: 'text-accent-purple',
    bgDark: 'rgba(139, 92, 246, 0.15)',
    bgLight: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(139, 92, 246, 0.04) 100%)',
    borderLight: 'rgba(139, 92, 246, 0.2)',
    shadowLight: 'rgba(139, 92, 246, 0.1)',
  },
  stake: {
    icon: ActivityIcon,
    color: 'text-accent-purple',
    bgDark: 'rgba(139, 92, 246, 0.15)',
    bgLight: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(139, 92, 246, 0.04) 100%)',
    borderLight: 'rgba(139, 92, 246, 0.2)',
    shadowLight: 'rgba(139, 92, 246, 0.1)',
  },
};

function getRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(ts).toLocaleDateString();
}

function mapWalletTxType(type: NormalizedTransaction['type']): UnifiedActivity['type'] {
  switch (type) {
    case 'buy': return 'buy';
    case 'sell': return 'sell';
    case 'swap': return 'swap';
    case 'transfer_in': return 'transfer';
    case 'transfer_out': return 'transfer';
    case 'stake':
    case 'unstake': return 'stake';
    case 'claim': return 'reward';
    default: return 'transfer';
  }
}

function mapExchangeTxType(type: ExchangeTransactionData['type']): UnifiedActivity['type'] {
  switch (type) {
    case 'deposit': return 'buy';
    case 'withdrawal': return 'sell';
    case 'internal_transfer': return 'transfer';
    default: return 'transfer';
  }
}

interface RecentActivityProps {
  walletTransactions: NormalizedTransaction[];
  exchangeTransactions: ExchangeTransactionData[];
  isLoading: boolean;
}

export function RecentActivity({ walletTransactions, exchangeTransactions, isLoading }: RecentActivityProps) {
  const { isDark, label } = useThemedText();

  const activities = useMemo(() => {
    const unified: UnifiedActivity[] = [];

    // Convert wallet transactions
    if (walletTransactions) {
      for (const tx of walletTransactions) {
        unified.push({
          id: tx.id,
          type: mapWalletTxType(tx.type),
          asset: tx.symbol || tx.asset,
          amount: tx.amount,
          value: tx.value,
          timestamp: new Date(tx.timestamp).getTime(),
          time: '',
          status: tx.status === 'confirmed' ? 'confirmed' : 'pending',
        });
      }
    }

    // Convert exchange transactions
    if (exchangeTransactions) {
      for (const tx of exchangeTransactions) {
        unified.push({
          id: tx.id,
          type: mapExchangeTxType(tx.type),
          asset: tx.coin,
          amount: tx.amount,
          value: tx.valueUsd,
          timestamp: new Date(tx.timestamp).getTime(),
          time: '',
          status: tx.status === 'completed' ? 'confirmed' : 'pending',
        });
      }
    }

    // Sort by timestamp descending and take top 4
    unified.sort((a, b) => b.timestamp - a.timestamp);
    const top = unified.slice(0, 4);

    // Calculate relative time
    for (const item of top) {
      item.time = getRelativeTime(item.timestamp);
    }

    return top;
  }, [walletTransactions, exchangeTransactions]);

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
        {isLoading && activities.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg animate-pulse"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)'
                  : '#f8fafc',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #e2e8f0',
                height: 56,
              }}
            />
          ))
        ) : activities.length === 0 ? (
          <div className={cn(
            'text-[11px] text-center py-6',
            isDark ? 'text-white/30' : 'text-slate-400'
          )}>
            No recent activity
          </div>
        ) : (
          activities.map((activity) => {
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
                        {activity.amount < 0.01
                          ? activity.amount.toFixed(6)
                          : activity.amount < 1
                            ? activity.amount.toFixed(4)
                            : activity.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        } {activity.asset}
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
                      ${activity.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
          })
        )}
      </div>
    </ThemedCard>
  );
}
