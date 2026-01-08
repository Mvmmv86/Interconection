'use client';

import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemedCard, useThemedText } from '@/components/ui/themed-card';

interface Strategy {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'paused';
  allocation: number;
  apy: number;
}

const mockStrategies: Strategy[] = [
  { id: '1', name: 'ETH Staking', type: 'Staking', status: 'active', allocation: 35, apy: 4.2 },
  { id: '2', name: 'Curve LP', type: 'Liquidity', status: 'active', allocation: 25, apy: 8.7 },
  { id: '3', name: 'Aave Lending', type: 'Lending', status: 'paused', allocation: 20, apy: 3.5 },
];

export function ActiveStrategies() {
  const { isDark, label } = useThemedText();

  return (
    <ThemedCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <span className={cn('text-[11px] font-semibold uppercase tracking-wider', label)}>
          Active Strategies
        </span>
        <button className="text-[10px] font-medium text-accent-blue hover:underline">View all</button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {mockStrategies.map((strategy) => {
          const isActive = strategy.status === 'active';

          return (
            <div
              key={strategy.id}
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
              <div className="p-3">
                <div className="flex items-center gap-3">
                  {/* Status Icon */}
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center',
                      isActive ? 'text-status-success' : (isDark ? 'text-white/40' : 'text-slate-400')
                    )}
                    style={{
                      background: isActive
                        ? isDark
                          ? 'rgba(34, 197, 94, 0.15)'
                          : 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(34, 197, 94, 0.04) 100%)'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'linear-gradient(135deg, rgba(100, 116, 139, 0.1) 0%, rgba(100, 116, 139, 0.04) 100%)',
                      border: isActive
                        ? isDark ? 'none' : '1px solid rgba(34, 197, 94, 0.2)'
                        : isDark ? 'none' : '1px solid rgba(100, 116, 139, 0.15)',
                      boxShadow: isActive && !isDark ? '0 2px 6px rgba(34, 197, 94, 0.1)' : 'none',
                    }}
                  >
                    {isActive ? (
                      <Play className="w-4 h-4" />
                    ) : (
                      <Pause className="w-4 h-4" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-[11px] font-semibold',
                      isDark ? 'text-white' : 'text-slate-900'
                    )}>
                      {strategy.name}
                    </p>
                    <p className={cn(
                      'text-[10px]',
                      isDark ? 'text-white/40' : 'text-slate-500'
                    )}>
                      {strategy.type}
                    </p>
                  </div>

                  {/* Metrics */}
                  <div className="text-right">
                    <div
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md mb-1"
                      style={{
                        background: isDark
                          ? 'rgba(59, 130, 246, 0.15)'
                          : 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.04) 100%)',
                        border: isDark ? 'none' : '1px solid rgba(59, 130, 246, 0.2)',
                      }}
                    >
                      <span className="text-[11px] font-bold text-accent-blue tabular-nums">
                        {strategy.apy}%
                      </span>
                      <span className={cn(
                        'text-[9px] font-medium',
                        isDark ? 'text-accent-blue/70' : 'text-accent-blue/80'
                      )}>
                        APY
                      </span>
                    </div>
                    <p className={cn(
                      'text-[10px] font-medium tabular-nums',
                      isDark ? 'text-white/50' : 'text-slate-600'
                    )}>
                      {strategy.allocation}% allocated
                    </p>
                  </div>
                </div>

                {/* Progress bar with gradient */}
                <div className="mt-3">
                  <div
                    className="h-[4px] rounded-full overflow-hidden"
                    style={{
                      background: isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 100%)',
                    }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${strategy.allocation}%`,
                        background: isActive
                          ? 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.2)'
                            : '#94a3b8',
                        boxShadow: isActive ? '0 0 8px rgba(59, 130, 246, 0.4)' : 'none',
                      }}
                    />
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
