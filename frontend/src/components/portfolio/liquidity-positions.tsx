'use client';

import { useMemo } from 'react';
import { Droplets, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import type { NormalizedDeFiPosition } from '@/lib/defi';

export interface LiquidityPositionsProps {
  positions: NormalizedDeFiPosition[];
  isLoading: boolean;
}

interface LPDisplay {
  id: string;
  protocol: string;
  protocolIcon?: string;
  pair: string;
  chain: string;
  liquidity: number;
  apr: number;
  il7d?: number;
  volume24h?: number;
  hasRewards: boolean;
}

export function LiquidityPositions({ positions, isLoading }: LiquidityPositionsProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Filter only LP positions
  const lpPositions = useMemo<LPDisplay[]>(() => {
    return positions
      .filter(p => p.category === 'lp')
      .map(p => ({
        id: p.id,
        protocol: p.protocol,
        protocolIcon: p.protocolIcon,
        pair: p.positionName || p.asset.symbol || `${p.protocol} LP`,
        chain: p.chain,
        liquidity: p.valueUsd,
        apr: p.apy?.total || 0,
        il7d: p.lp?.il7d,
        volume24h: p.lp?.volume24h,
        hasRewards: p.apy?.hasRewards || false,
      }))
      .sort((a, b) => b.liquidity - a.liquidity);
  }, [positions]);

  const totalLiquidity = lpPositions.reduce((sum, p) => sum + p.liquidity, 0);
  const avgApr = lpPositions.length > 0
    ? lpPositions.reduce((sum, p) => sum + p.apr, 0) / lpPositions.length
    : 0;

  // Empty state
  if (!isLoading && lpPositions.length === 0) {
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
          <div className="w-7 h-7 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
            <Droplets className="w-4 h-4 text-accent-cyan" />
          </div>
          <h3 className={cn('text-[12px] font-semibold uppercase tracking-wider', isDark ? 'text-white' : 'text-gray-900')}>
            Liquidity Pools
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8">
          <Droplets className={cn('w-8 h-8 mb-2', isDark ? 'text-white/10' : 'text-gray-300')} />
          <p className={cn('text-[11px]', isDark ? 'text-white/30' : 'text-gray-400')}>
            No LP positions found
          </p>
          <p className={cn('text-[10px] mt-1', isDark ? 'text-white/20' : 'text-gray-300')}>
            Connect a wallet to see liquidity positions
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
          <div className="w-7 h-7 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
            <Droplets className="w-4 h-4 text-accent-cyan" />
          </div>
          <div>
            <h3 className={cn(
              'text-[12px] font-semibold uppercase tracking-wider',
              isDark ? 'text-white' : 'text-gray-900'
            )}>
              Liquidity Pools
            </h3>
            <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>
              {isLoading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                </span>
              ) : (
                `${lpPositions.length} position${lpPositions.length !== 1 ? 's' : ''}`
              )}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn('text-[14px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
            {totalLiquidity >= 1000
              ? `$${(totalLiquidity / 1000).toFixed(0)}K`
              : `$${totalLiquidity.toFixed(0)}`
            }
          </p>
          {avgApr > 0 && (
            <p className="text-[9px] text-status-success">Avg {avgApr.toFixed(1)}% APR</p>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={cn('p-2.5 rounded-lg animate-pulse', isDark ? 'bg-white/[0.02]' : 'bg-gray-50')}>
              <div className="flex items-center gap-2">
                <div className={cn('w-7 h-7 rounded-lg', isDark ? 'bg-white/5' : 'bg-gray-200')} />
                <div className="flex-1 space-y-1.5">
                  <div className={cn('h-3 w-20 rounded', isDark ? 'bg-white/5' : 'bg-gray-200')} />
                  <div className={cn('h-2 w-16 rounded', isDark ? 'bg-white/5' : 'bg-gray-200')} />
                </div>
              </div>
            </div>
          ))
        ) : (
          lpPositions.map((position) => (
            <div
              key={position.id}
              className={cn(
                'p-2.5 rounded-lg transition-colors',
                isDark ? 'bg-white/[0.02] hover:bg-white/[0.03]' : 'bg-gray-50 hover:bg-gray-100'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden',
                    isDark ? 'bg-white/[0.05]' : 'bg-gray-100'
                  )}>
                    {position.protocolIcon ? (
                      <img
                        src={position.protocolIcon}
                        alt={position.protocol}
                        className="w-7 h-7 rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement!.textContent = position.protocol.slice(0, 3).toUpperCase();
                        }}
                      />
                    ) : (
                      <span className={cn('text-[8px] font-bold', isDark ? 'text-white/70' : 'text-gray-600')}>
                        {position.protocol.slice(0, 3).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                        {position.pair}
                      </p>
                      {position.il7d && position.il7d < -5 && (
                        <AlertTriangle className="w-3 h-3 text-accent-yellow" />
                      )}
                    </div>
                    <div className={cn('flex items-center gap-2 text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                      <span>{position.protocol}</span>
                      <span>•</span>
                      <span>{position.chain}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn('text-[11px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                    ${position.liquidity >= 1000
                      ? `${(position.liquidity / 1000).toFixed(1)}K`
                      : position.liquidity.toFixed(0)
                    }
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    {position.apr > 0 && (
                      <span className="text-[9px] font-medium text-status-success tabular-nums">
                        {position.apr.toFixed(1)}% APR
                      </span>
                    )}
                    {position.il7d !== undefined && position.il7d !== 0 && (
                      <span className={cn(
                        'text-[9px] font-medium tabular-nums',
                        position.il7d >= 0 ? 'text-status-success' : 'text-status-error'
                      )}>
                        {position.il7d.toFixed(1)}% IL
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Volume bar */}
              {position.volume24h && position.volume24h > 0 && (
                <div className={cn(
                  'mt-2 pt-2 border-t',
                  isDark ? 'border-white/[0.03]' : 'border-gray-100'
                )}>
                  <div className="flex items-center justify-between text-[9px]">
                    <span className={isDark ? 'text-white/30' : 'text-gray-500'}>24h volume</span>
                    <span className={cn('font-medium tabular-nums', isDark ? 'text-white/50' : 'text-gray-600')}>
                      ${position.volume24h >= 1000000
                        ? `${(position.volume24h / 1000000).toFixed(1)}M`
                        : position.volume24h >= 1000
                          ? `${(position.volume24h / 1000).toFixed(0)}K`
                          : position.volume24h.toFixed(0)
                      }
                    </span>
                  </div>
                </div>
              )}
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
          {lpPositions.length} pool{lpPositions.length !== 1 ? 's' : ''} active
        </span>
        <a href="/positions/defi" className="text-[10px] text-accent-blue hover:underline">View all →</a>
      </div>
    </div>
  );
}
