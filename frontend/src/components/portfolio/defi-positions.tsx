'use client';

import { useMemo } from 'react';
import { Layers, Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import type { NormalizedDeFiPosition } from '@/lib/defi';

export interface DeFiPositionsProps {
  positions: NormalizedDeFiPosition[];
  isLoading: boolean;
}

const typeColors: Record<string, string> = {
  lending: 'bg-accent-blue/10 text-accent-blue',
  yield: 'bg-status-success/10 text-status-success',
  staking: 'bg-accent-cyan/10 text-accent-cyan',
  claimable: 'bg-accent-yellow/10 text-accent-yellow',
  derivatives: 'bg-accent-orange/10 text-accent-orange',
  other: 'bg-white/10 text-white/50',
};

interface GroupedProtocol {
  protocol: string;
  protocolIcon?: string;
  chain: string;
  chains: string[];
  category: string;
  totalSupplied: number;
  totalBorrowed: number;
  netValue: number;
  apy: number;
  healthFactor?: number;
  rewards: number;
  positionCount: number;
}

export function DeFiPositions({ positions, isLoading }: DeFiPositionsProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Filter only DeFi positions (lending, yield, claimable, other) — no LP, no staking
  const defiPositions = useMemo(() => {
    return positions.filter(p =>
      p.category === 'lending' || p.category === 'yield' || p.category === 'claimable' || p.category === 'other' || p.category === 'derivatives'
    );
  }, [positions]);

  // Group by protocol
  const grouped = useMemo<GroupedProtocol[]>(() => {
    const map = new Map<string, GroupedProtocol>();

    for (const p of defiPositions) {
      const key = p.protocol;
      if (!map.has(key)) {
        map.set(key, {
          protocol: p.protocol,
          protocolIcon: p.protocolIcon,
          chain: p.chain,
          chains: [p.chain],
          category: p.category,
          totalSupplied: 0,
          totalBorrowed: 0,
          netValue: 0,
          apy: 0,
          rewards: 0,
          positionCount: 0,
        });
      }

      const group = map.get(key)!;
      group.positionCount += 1;

      if (!group.chains.includes(p.chain)) {
        group.chains.push(p.chain);
      }

      // Lending-specific data
      if (p.lending) {
        group.totalSupplied += p.lending.totalSupplyUsd || 0;
        group.totalBorrowed += p.lending.totalBorrowUsd || 0;
        if (p.lending.ltv && p.lending.ltv > 0) {
          // health factor approx = 1 / LTV (simplified)
          group.healthFactor = 1 / p.lending.ltv;
        }
      } else {
        group.totalSupplied += p.valueUsd;
      }

      group.netValue += p.valueUsd;

      // Best APY in group
      if (p.apy?.total && p.apy.total > (group.apy || 0)) {
        group.apy = p.apy.total;
      }

      // Rewards from reward APY
      if (p.apy?.reward && p.apy.reward > 0) {
        group.rewards += (p.valueUsd * p.apy.reward) / 100 / 365; // daily
      }
    }

    return Array.from(map.values()).sort((a, b) => b.netValue - a.netValue);
  }, [defiPositions]);

  const totalDeFiValue = defiPositions.reduce((sum, p) => sum + p.valueUsd, 0);
  const totalRewards = grouped.reduce((sum, g) => sum + g.rewards * 365, 0); // Annualized

  const protocolCount = grouped.length;

  // Empty state
  if (!isLoading && defiPositions.length === 0) {
    return (
      <div
        className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
            : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
          border: isDark
            ? '1px solid rgba(255, 255, 255, 0.08)'
            : '1px solid rgba(203, 213, 225, 0.6)',
          boxShadow: isDark
            ? '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        }}
      >
        <div className={cn(
          'flex items-center gap-2 pb-3 mb-3 border-b',
          isDark ? 'border-white/[0.06]' : 'border-gray-200'
        )}>
          <div className="w-7 h-7 rounded-lg bg-accent-purple/10 flex items-center justify-center">
            <Layers className="w-4 h-4 text-accent-purple" />
          </div>
          <h3 className={cn('text-[12px] font-semibold uppercase tracking-wider', isDark ? 'text-white' : 'text-gray-900')}>
            DeFi Positions
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8">
          <Layers className={cn('w-8 h-8 mb-2', isDark ? 'text-white/10' : 'text-gray-300')} />
          <p className={cn('text-[11px]', isDark ? 'text-white/30' : 'text-gray-400')}>
            No DeFi positions found
          </p>
          <p className={cn('text-[10px] mt-1', isDark ? 'text-white/20' : 'text-gray-300')}>
            Connect a wallet to see DeFi positions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden"
      style={{
        background: isDark
          ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
          : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
        border: isDark
          ? '1px solid rgba(255, 255, 255, 0.08)'
          : '1px solid rgba(203, 213, 225, 0.6)',
        boxShadow: isDark
          ? '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      }}
    >
      {/* Top shine effect */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{
          background: isDark
            ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)'
            : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
        }}
      />

      {/* Header */}
      <div className={cn(
        'flex items-center justify-between pb-3 mb-3 border-b relative z-10',
        isDark ? 'border-white/[0.06]' : 'border-gray-200'
      )}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-purple/10 flex items-center justify-center">
            <Layers className="w-4 h-4 text-accent-purple" />
          </div>
          <div>
            <h3 className={cn(
              'text-[12px] font-semibold uppercase tracking-wider',
              isDark ? 'text-white' : 'text-gray-900'
            )}>
              DeFi Positions
            </h3>
            <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>
              {isLoading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                </span>
              ) : (
                `${protocolCount} protocol${protocolCount !== 1 ? 's' : ''}`
              )}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn('text-[14px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
            {totalDeFiValue >= 1000
              ? `$${(totalDeFiValue / 1000).toFixed(0)}K`
              : `$${totalDeFiValue.toFixed(0)}`
            }
          </p>
          {totalRewards > 0 && (
            <p className="text-[9px] text-status-success">+${totalRewards.toFixed(0)} rewards/yr</p>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={cn('p-3 rounded-lg animate-pulse', isDark ? 'bg-white/[0.02]' : 'bg-gray-50')}>
              <div className="flex items-center gap-2">
                <div className={cn('w-8 h-8 rounded-lg', isDark ? 'bg-white/5' : 'bg-gray-200')} />
                <div className="flex-1 space-y-1.5">
                  <div className={cn('h-3 w-24 rounded', isDark ? 'bg-white/5' : 'bg-gray-200')} />
                  <div className={cn('h-2 w-16 rounded', isDark ? 'bg-white/5' : 'bg-gray-200')} />
                </div>
              </div>
            </div>
          ))
        ) : (
          grouped.map((group) => (
            <div
              key={group.protocol}
              className={cn(
                'p-3 rounded-lg transition-colors',
                isDark ? 'bg-white/[0.02] hover:bg-white/[0.03]' : 'bg-gray-50 hover:bg-gray-100'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden',
                    isDark ? 'bg-white/[0.05]' : 'bg-gray-100'
                  )}>
                    {group.protocolIcon ? (
                      <img
                        src={group.protocolIcon}
                        alt={group.protocol}
                        className="w-8 h-8 rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement!.textContent = group.protocol.slice(0, 2).toUpperCase();
                        }}
                      />
                    ) : (
                      <span className={cn('text-[10px] font-bold', isDark ? 'text-white/70' : 'text-gray-600')}>
                        {group.protocol.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                        {group.protocol}
                      </p>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[8px] font-medium uppercase',
                        typeColors[group.category] || typeColors.other
                      )}>
                        {group.category}
                      </span>
                    </div>
                    <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                      {group.chains.join(', ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn('text-[12px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                    ${group.netValue >= 1000 ? `${(group.netValue / 1000).toFixed(0)}K` : group.netValue.toFixed(0)}
                  </p>
                  {group.apy > 0 && (
                    <span className="text-[9px] font-medium text-status-success tabular-nums">
                      +{group.apy.toFixed(1)}% APY
                    </span>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className={cn(
                'grid grid-cols-4 gap-2 pt-2 border-t',
                isDark ? 'border-white/[0.03]' : 'border-gray-200'
              )}>
                <div>
                  <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Supplied</p>
                  <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                    {group.totalSupplied >= 1000
                      ? `$${(group.totalSupplied / 1000).toFixed(0)}K`
                      : `$${group.totalSupplied.toFixed(0)}`
                    }
                  </p>
                </div>
                <div>
                  <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Borrowed</p>
                  <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                    {group.totalBorrowed > 0
                      ? `$${(group.totalBorrowed / 1000).toFixed(0)}K`
                      : '$0'
                    }
                  </p>
                </div>
                <div>
                  <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Health</p>
                  {group.healthFactor ? (
                    <div className="flex items-center gap-1">
                      {group.healthFactor < 1.5 ? (
                        <AlertTriangle className="w-3 h-3 text-accent-yellow" />
                      ) : (
                        <Shield className="w-3 h-3 text-status-success" />
                      )}
                      <p className={cn(
                        'text-[10px] font-medium tabular-nums',
                        group.healthFactor < 1.5 ? 'text-accent-yellow' : 'text-status-success'
                      )}>
                        {group.healthFactor.toFixed(2)}
                      </p>
                    </div>
                  ) : (
                    <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>N/A</p>
                  )}
                </div>
                <div>
                  <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Positions</p>
                  <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                    {group.positionCount}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className={cn(
        'flex items-center justify-between mt-3 pt-3 border-t',
        isDark ? 'border-white/[0.03]' : 'border-gray-100'
      )}>
        <span className={cn(
          'text-[10px]',
          isDark ? 'text-white/30' : 'text-gray-500'
        )}>
          {defiPositions.length} position{defiPositions.length !== 1 ? 's' : ''} total
        </span>
        <a href="/positions/defi" className="text-[10px] text-accent-blue hover:underline">View all →</a>
      </div>
    </div>
  );
}
