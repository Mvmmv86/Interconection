'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Building2,
  Wallet,
  Layers,
  Coins,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { useAllPositions } from '@/hooks/useAllPositions';

const locationIcons = {
  exchange: Building2,
  defi: Layers,
  wallet: Wallet,
  staking: Coins,
  cold_wallet: Wallet,
};

const locationColors = {
  exchange: 'bg-accent-blue/10 text-accent-blue',
  defi: 'bg-accent-purple/10 text-accent-purple',
  wallet: 'bg-accent-orange/10 text-accent-orange',
  staking: 'bg-status-success/10 text-status-success',
  cold_wallet: 'bg-accent-cyan/10 text-accent-cyan',
};

type SortField = 'value' | 'pnlPercent' | 'allocation' | 'quantity';
type FilterType = 'all' | 'exchange' | 'defi' | 'wallet' | 'staking';

const categoryLabels: Record<string, string> = {
  spot: 'Spot',
  defi: 'DeFi',
  staking: 'Staking',
  pools: 'LP',
  futures: 'Futures',
  earn: 'Earn',
  funding: 'Funding',
  margin: 'Margin',
  other: 'Other',
};

const categoryBadgeColors: Record<string, string> = {
  spot: 'bg-blue-500/10 text-blue-400',
  defi: 'bg-purple-500/10 text-purple-400',
  staking: 'bg-green-500/10 text-green-400',
  pools: 'bg-cyan-500/10 text-cyan-400',
  futures: 'bg-red-500/10 text-red-400',
  earn: 'bg-emerald-500/10 text-emerald-400',
  funding: 'bg-indigo-500/10 text-indigo-400',
  margin: 'bg-amber-500/10 text-amber-400',
  other: 'bg-orange-500/10 text-orange-400',
};

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(2)}`;
}

export function PositionsTable() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { positions, isLoading } = useAllPositions();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort positions
  const filteredPositions = useMemo(() => {
    return positions
      .filter((p) => {
        const matchesSearch =
          p.asset.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.location.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter =
          filterType === 'all' ||
          p.locationType === filterType ||
          (filterType === 'defi' && (p.locationType === 'defi' || p.locationType === 'staking'));

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const multiplier = sortOrder === 'desc' ? -1 : 1;
        const aValue = a[sortBy] ?? 0;
        const bValue = b[sortBy] ?? 0;
        return (aValue - bValue) * multiplier;
      });
  }, [positions, searchTerm, filterType, sortBy, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const totalValue = filteredPositions.reduce((sum, p) => sum + p.value, 0);
  const totalPnl = filteredPositions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);

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

  if (isLoading) {
    return (
      <div className="backdrop-blur-sm rounded-xl p-4" style={cardStyle}>
        <div className="flex items-center justify-center h-[300px]">
          <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-white/30' : 'text-gray-400')} />
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-sm rounded-xl p-4" style={cardStyle}>
      {/* Header */}
      <div className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b',
        isDark ? 'border-white/[0.06]' : 'border-gray-200'
      )}>
        <div>
          <h3 className={cn('text-[12px] font-semibold uppercase tracking-wider', isDark ? 'text-white' : 'text-gray-900')}>
            All Positions
          </h3>
          <p className={cn('text-[10px] mt-0.5', isDark ? 'text-white/30' : 'text-gray-500')}>
            {filteredPositions.length} positions · {formatCurrency(totalValue)} total
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className={cn('absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5', isDark ? 'text-white/30' : 'text-gray-400')} />
            <input
              type="text"
              placeholder="Search positions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                'w-40 h-8 pl-8 pr-3 rounded-lg text-[11px] focus:outline-none focus:border-accent-purple/50',
                isDark
                  ? 'bg-white/[0.03] border border-white/[0.06] text-white placeholder:text-white/30'
                  : 'bg-gray-100 border border-gray-200 text-gray-900 placeholder:text-gray-400'
              )}
            />
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'h-8 px-3 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-colors',
              showFilters
                ? 'bg-accent-purple/10 border-accent-purple/30 text-accent-purple'
                : isDark
                  ? 'bg-white/[0.03] border-white/[0.06] text-white/70 hover:bg-white/[0.05]'
                  : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
            <ChevronDown className={cn('w-3 h-3 transition-transform', showFilters && 'rotate-180')} />
          </button>

          {/* Sort */}
          <div className={cn(
            'flex items-center gap-1.5 h-8 px-3 rounded-lg border',
            isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-gray-100 border-gray-200'
          )}>
            <ArrowUpDown className={cn('w-3.5 h-3.5', isDark ? 'text-white/30' : 'text-gray-400')} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className={cn('bg-transparent text-[11px] focus:outline-none cursor-pointer', isDark ? 'text-white/70' : 'text-gray-700')}
            >
              <option value="value">Value</option>
              <option value="pnlPercent">P&L %</option>
              <option value="allocation">Allocation</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Pills */}
      {showFilters && (
        <div className={cn('flex items-center gap-2 mb-4 pb-3 border-b', isDark ? 'border-white/[0.03]' : 'border-gray-100')}>
          <span className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>Type:</span>
          {(['all', 'exchange', 'defi', 'wallet', 'staking'] as FilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[10px] font-medium capitalize transition-colors',
                filterType === type
                  ? 'bg-accent-purple/20 text-accent-purple'
                  : isDark
                    ? 'bg-white/[0.03] text-white/70 hover:bg-white/[0.05]'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredPositions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className={cn('w-10 h-10 mb-3', isDark ? 'text-white/20' : 'text-gray-300')} />
          <p className={cn('text-[12px] font-medium mb-1', isDark ? 'text-white/70' : 'text-gray-700')}>
            No positions found
          </p>
          <p className={cn('text-[10px]', isDark ? 'text-white/40' : 'text-gray-500')}>
            {searchTerm ? 'Try adjusting your search or filters' : 'Connect a wallet or exchange to see positions'}
          </p>
        </div>
      )}

      {/* Table */}
      {filteredPositions.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={cn('border-b', isDark ? 'border-white/[0.03]' : 'border-gray-100')}>
                  <th className={cn('text-left py-2.5 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Asset</th>
                  <th className={cn('text-right py-2.5 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Quantity</th>
                  <th className={cn('text-right py-2.5 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Price</th>
                  <th
                    className={cn('text-right py-2.5 text-[9px] font-medium uppercase tracking-wider cursor-pointer', isDark ? 'text-white/30 hover:text-white/70' : 'text-gray-500 hover:text-gray-700')}
                    onClick={() => handleSort('value')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Value
                      {sortBy === 'value' && <ArrowUpDown className="w-2.5 h-2.5" />}
                    </span>
                  </th>
                  <th
                    className={cn('text-right py-2.5 text-[9px] font-medium uppercase tracking-wider cursor-pointer', isDark ? 'text-white/30 hover:text-white/70' : 'text-gray-500 hover:text-gray-700')}
                    onClick={() => handleSort('pnlPercent')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      P&L
                      {sortBy === 'pnlPercent' && <ArrowUpDown className="w-2.5 h-2.5" />}
                    </span>
                  </th>
                  <th
                    className={cn('text-right py-2.5 text-[9px] font-medium uppercase tracking-wider cursor-pointer', isDark ? 'text-white/30 hover:text-white/70' : 'text-gray-500 hover:text-gray-700')}
                    onClick={() => handleSort('allocation')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Alloc.
                      {sortBy === 'allocation' && <ArrowUpDown className="w-2.5 h-2.5" />}
                    </span>
                  </th>
                  <th className={cn('text-center py-2.5 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Type</th>
                  <th className={cn('text-left py-2.5 text-[9px] font-medium uppercase tracking-wider pl-3', isDark ? 'text-white/30' : 'text-gray-500')}>Location</th>
                  <th className={cn('text-left py-2.5 text-[9px] font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-gray-500')}>Chain</th>
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map((position) => {
                  const LocationIcon = locationIcons[position.locationType] || Wallet;
                  const hasPnl = position.pnl !== undefined && position.pnl !== 0;

                  return (
                    <tr
                      key={position.id}
                      className={cn(
                        'border-b transition-colors cursor-pointer',
                        isDark ? 'border-white/[0.02] hover:bg-white/[0.02]' : 'border-gray-50 hover:bg-gray-50'
                      )}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          {position.icon ? (
                            <img
                              src={position.icon}
                              alt={position.symbol}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold',
                              isDark ? 'bg-white/[0.05] text-white/70' : 'bg-gray-100 text-gray-600'
                            )}>
                              {position.symbol.slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>{position.symbol}</p>
                            <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>{position.asset}</p>
                          </div>
                        </div>
                      </td>
                      <td className={cn('text-right py-3 text-[11px] tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                        {position.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </td>
                      <td className="text-right py-3">
                        <div className={cn('text-[11px] tabular-nums', isDark ? 'text-white/30' : 'text-gray-500')}>
                          ${position.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                        {position.entryPrice !== undefined && position.entryPrice > 0 && (
                          <div className={cn('text-[8px] tabular-nums', isDark ? 'text-white/20' : 'text-gray-400')}>
                            Entry: ${position.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>
                      <td className={cn('text-right py-3 text-[12px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                        {formatCurrency(position.value)}
                      </td>
                      <td className="text-right py-3">
                        {hasPnl ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1">
                              {(position.pnl ?? 0) >= 0 ? (
                                <TrendingUp className="w-3 h-3 text-status-success" />
                              ) : (
                                <TrendingDown className="w-3 h-3 text-status-error" />
                              )}
                              <span
                                className={cn(
                                  'text-[11px] font-medium tabular-nums',
                                  (position.pnl ?? 0) >= 0 ? 'text-status-success' : 'text-status-error'
                                )}
                              >
                                {(position.pnl ?? 0) >= 0 ? '+' : ''}{formatCurrency(Math.abs(position.pnl ?? 0))}
                              </span>
                            </div>
                            {position.pnlPercent !== undefined && position.pnlPercent !== 0 && (
                              <span
                                className={cn(
                                  'text-[9px] tabular-nums',
                                  (position.pnlPercent) >= 0 ? 'text-status-success/70' : 'text-status-error/70'
                                )}
                              >
                                {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        ) : position.pnlPercent !== undefined && position.pnlPercent !== 0 ? (
                          <div className="flex items-center justify-end gap-1">
                            {position.pnlPercent >= 0 ? (
                              <TrendingUp className="w-3 h-3 text-status-success" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-status-error" />
                            )}
                            <span
                              className={cn(
                                'text-[11px] font-medium tabular-nums',
                                position.pnlPercent >= 0 ? 'text-status-success' : 'text-status-error'
                              )}
                            >
                              {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                            </span>
                          </div>
                        ) : (
                          <span className={cn('text-[11px]', isDark ? 'text-white/20' : 'text-gray-300')}>—</span>
                        )}
                      </td>
                      <td className={cn('text-right py-3 text-[11px] tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                        {position.allocation.toFixed(1)}%
                      </td>
                      <td className="py-3 text-center">
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[8px] font-medium',
                          categoryBadgeColors[position.category] || categoryBadgeColors.other
                        )}>
                          {position.side ? `${categoryLabels[position.category]} ${position.side === 'long' ? 'L' : 'S'}` : categoryLabels[position.category] || position.category}
                          {position.leverage && position.leverage > 1 ? ` ${position.leverage}x` : ''}
                        </span>
                      </td>
                      <td className="py-3 pl-3">
                        <div className="flex items-center gap-1.5">
                          <div className={cn('w-5 h-5 rounded flex items-center justify-center', locationColors[position.locationType] || locationColors.wallet)}>
                            <LocationIcon className="w-3 h-3" />
                          </div>
                          <span className={cn('text-[10px]', isDark ? 'text-white/70' : 'text-gray-700')}>{position.location}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>{position.chain}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className={cn('flex items-center justify-between mt-4 pt-3 border-t', isDark ? 'border-white/[0.03]' : 'border-gray-100')}>
            <div className="flex items-center gap-4">
              <span className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                Total: <span className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>{formatCurrency(totalValue)}</span>
              </span>
              {totalPnl !== 0 && (
                <span className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                  P&L:{' '}
                  <span className={cn('font-medium', totalPnl >= 0 ? 'text-status-success' : 'text-status-error')}>
                    {totalPnl >= 0 ? '+' : ''}{formatCurrency(Math.abs(totalPnl))}
                  </span>
                </span>
              )}
            </div>
            <button className="text-[10px] text-accent-blue hover:underline">Export CSV →</button>
          </div>
        </>
      )}
    </div>
  );
}
