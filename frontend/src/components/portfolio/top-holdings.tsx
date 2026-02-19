'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Search, ArrowUpDown, Loader2, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { UnifiedPosition } from '@/types/positions';

export interface TopHoldingsProps {
  positions: UnifiedPosition[];  // Already filtered to spot only
  totalSpotValue: number;        // Sum of all spot positions (for allocation calc)
  isLoading: boolean;
}

const locationColors: Record<string, string> = {
  exchange: 'bg-accent-blue/10 text-accent-blue',
  defi: 'bg-accent-purple/10 text-accent-purple',
  wallet: 'bg-accent-cyan/10 text-accent-cyan',
  staking: 'bg-status-success/10 text-status-success',
  cold_wallet: 'bg-accent-yellow/10 text-accent-yellow',
};

type SortKey = 'value' | 'pnlPercent' | 'allocation';

export function TopHoldings({ positions, totalSpotValue, isLoading }: TopHoldingsProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('value');

  // Compute allocation relative to total spot value
  const holdingsWithAllocation = positions.map(p => ({
    ...p,
    spotAllocation: totalSpotValue > 0 ? (p.value / totalSpotValue) * 100 : 0,
    change24hUsd: p.pnlPercent ? (p.value * p.pnlPercent) / 100 : 0,
  }));

  const filteredHoldings = holdingsWithAllocation
    .filter((h) =>
      h.asset.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'pnlPercent':
          return Math.abs(b.pnlPercent || 0) - Math.abs(a.pnlPercent || 0);
        case 'allocation':
          return b.spotAllocation - a.spotAllocation;
        default:
          return b.value - a.value;
      }
    });

  const cardStyle = {
    background: isDark
      ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
      : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
    border: isDark
      ? '1px solid rgba(255, 255, 255, 0.08)'
      : '1px solid rgba(203, 213, 225, 0.6)',
    boxShadow: isDark
      ? '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
  };

  // Loading state
  if (isLoading && positions.length === 0) {
    return (
      <div className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden flex items-center justify-center h-[300px]" style={cardStyle}>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-white/20' : 'text-gray-300')} />
          <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-400')}>
            Carregando posições spot...
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (positions.length === 0) {
    return (
      <div className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden flex flex-col items-center justify-center h-[300px]" style={cardStyle}>
        <Coins className={cn('w-8 h-8 mb-2', isDark ? 'text-white/10' : 'text-gray-200')} />
        <p className={cn('text-xs', isDark ? 'text-white/30' : 'text-gray-400')}>
          Nenhuma posição spot encontrada
        </p>
        <p className={cn('text-[10px] mt-1', isDark ? 'text-white/20' : 'text-gray-300')}>
          Conecte uma wallet ou exchange para visualizar seus ativos
        </p>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden" style={cardStyle}>
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
        'flex items-center justify-between pb-3 mb-4 border-b relative z-10',
        isDark ? 'border-white/[0.06]' : 'border-gray-200'
      )}>
        <h3 className={cn(
          'text-[12px] font-semibold uppercase tracking-wider',
          isDark ? 'text-white' : 'text-gray-900'
        )}>
          Top Holdings
        </h3>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className={cn(
              'absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3',
              isDark ? 'text-white/30' : 'text-gray-400'
            )} />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                'w-32 h-7 pl-7 pr-2 rounded-md text-[10px] focus:outline-none transition-colors',
                isDark
                  ? 'bg-white/[0.03] border border-white/[0.03] text-white placeholder:text-white/30 focus:border-white/[0.06]'
                  : 'bg-gray-100 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-gray-300'
              )}
            />
          </div>

          {/* Sort */}
          <div className={cn(
            'flex items-center gap-1 px-2 py-1.5 rounded-md',
            isDark
              ? 'bg-white/[0.03] border border-white/[0.03]'
              : 'bg-gray-100 border border-gray-200'
          )}>
            <ArrowUpDown className={cn('w-3 h-3', isDark ? 'text-white/30' : 'text-gray-400')} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className={cn(
                'bg-transparent text-[10px] focus:outline-none cursor-pointer',
                isDark ? 'text-white/70' : 'text-gray-700'
              )}
            >
              <option value="value">Value</option>
              <option value="pnlPercent">P&L</option>
              <option value="allocation">Allocation</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={cn('border-b', isDark ? 'border-white/[0.03]' : 'border-gray-100')}>
              <th className={cn('text-left py-2 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Asset</th>
              <th className={cn('text-right py-2 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Quantity</th>
              <th className={cn('text-right py-2 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>24h Change</th>
              <th className={cn('text-right py-2 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Price</th>
              <th className={cn('text-right py-2 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Value</th>
              <th className={cn('text-right py-2 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>P&L</th>
              <th className={cn('text-right py-2 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Alloc.</th>
              <th className={cn('text-left py-2 text-[9px] font-medium uppercase tracking-wider pl-3', isDark ? 'text-white/30' : 'text-gray-500')}>Location</th>
            </tr>
          </thead>
          <tbody>
            {filteredHoldings.map((holding) => {
              const pnlPct = holding.pnlPercent || 0;
              const isPositive = pnlPct >= 0;
              const change24hUsd = holding.change24hUsd;

              return (
                <tr
                  key={holding.id}
                  className={cn(
                    'border-b transition-colors',
                    isDark
                      ? 'border-white/[0.02] hover:bg-white/[0.02]'
                      : 'border-gray-50 hover:bg-gray-50'
                  )}
                >
                  {/* Asset */}
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      {holding.icon ? (
                        <img
                          src={holding.icon}
                          alt={holding.symbol}
                          className="w-6 h-6 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const next = (e.target as HTMLImageElement).nextElementSibling;
                            if (next) (next as HTMLElement).style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold',
                          isDark ? 'bg-white/[0.05] text-white/70' : 'bg-gray-100 text-gray-600',
                          holding.icon && 'hidden'
                        )}
                      >
                        {holding.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                          {holding.symbol}
                        </p>
                        <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                          {holding.asset}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Quantity */}
                  <td className={cn('text-right py-2.5 text-[11px] tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                    {holding.quantity > 0
                      ? holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })
                      : '-'
                    }
                  </td>

                  {/* 24h Change ($) */}
                  <td className="text-right py-2.5">
                    {change24hUsd !== 0 ? (
                      <span className={cn(
                        'text-[11px] tabular-nums',
                        isPositive ? 'text-status-success' : 'text-status-error'
                      )}>
                        {isPositive ? '+' : ''}{Math.abs(change24hUsd) >= 1000
                          ? `$${(change24hUsd / 1000).toFixed(1)}K`
                          : `$${change24hUsd.toFixed(0)}`
                        }
                      </span>
                    ) : (
                      <span className={cn('text-[11px] tabular-nums', isDark ? 'text-white/20' : 'text-gray-300')}>-</span>
                    )}
                  </td>

                  {/* Price */}
                  <td className={cn('text-right py-2.5 text-[11px] tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                    {holding.currentPrice > 0
                      ? `$${holding.currentPrice.toLocaleString(undefined, {
                          minimumFractionDigits: holding.currentPrice < 1 ? 4 : 0,
                          maximumFractionDigits: holding.currentPrice < 1 ? 6 : holding.currentPrice < 100 ? 2 : 0,
                        })}`
                      : '-'
                    }
                  </td>

                  {/* Value */}
                  <td className={cn('text-right py-2.5 text-[11px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                    ${holding.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>

                  {/* P&L % */}
                  <td className="text-right py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {pnlPct !== 0 ? (
                        <>
                          {isPositive ? (
                            <TrendingUp className="w-3 h-3 text-status-success" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-status-error" />
                          )}
                          <span
                            className={cn(
                              'text-[11px] font-medium tabular-nums',
                              isPositive ? 'text-status-success' : 'text-status-error'
                            )}
                          >
                            {isPositive ? '+' : ''}{pnlPct.toFixed(1)}%
                          </span>
                        </>
                      ) : (
                        <span className={cn('text-[11px] tabular-nums', isDark ? 'text-white/20' : 'text-gray-300')}>
                          0.0%
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Allocation */}
                  <td className={cn('text-right py-2.5 text-[11px] tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                    {holding.spotAllocation.toFixed(1)}%
                  </td>

                  {/* Location */}
                  <td className="py-2.5 pl-3">
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded text-[9px] font-medium',
                        locationColors[holding.locationType] || (isDark ? 'bg-white/5 text-white/40' : 'bg-gray-100 text-gray-500')
                      )}
                    >
                      {holding.location}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className={cn(
        'flex items-center justify-between mt-3 pt-3 border-t',
        isDark ? 'border-white/[0.03]' : 'border-gray-100'
      )}>
        <span className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>
          Showing {filteredHoldings.length} of {positions.length} spot holdings
        </span>
        <span className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/50' : 'text-gray-600')}>
          Total Spot: ${totalSpotValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}
