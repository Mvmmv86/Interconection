'use client';

import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Active Strategies</span>
        <button className="text-[10px] text-accent-blue hover:underline">View all</button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {mockStrategies.map((strategy) => (
          <div
            key={strategy.id}
            className="p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              {/* Status Icon */}
              <div
                className={cn(
                  'w-7 h-7 rounded-md flex items-center justify-center',
                  strategy.status === 'active'
                    ? 'bg-status-success/10 text-status-success'
                    : 'bg-white/[0.03] text-text-muted'
                )}
              >
                {strategy.status === 'active' ? (
                  <Play className="w-3.5 h-3.5" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-text-primary">{strategy.name}</p>
                <p className="text-[10px] text-text-muted">{strategy.type}</p>
              </div>

              {/* Metrics */}
              <div className="text-right">
                <p className="text-[11px] font-medium text-accent-blue tabular-nums">{strategy.apy}% APY</p>
                <p className="text-[10px] text-text-muted tabular-nums">{strategy.allocation}%</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-[3px] bg-white/[0.03] rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  strategy.status === 'active' ? 'bg-accent-blue' : 'bg-text-muted'
                )}
                style={{ width: `${strategy.allocation}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
