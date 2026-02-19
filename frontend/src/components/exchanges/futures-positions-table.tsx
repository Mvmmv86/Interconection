'use client';

import { useState, useMemo } from 'react';
import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
import { ArrowUpDown, Search, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import type { FuturesPosition } from '@/hooks/useExchangeDetail';

interface FuturesPositionsTableProps {
  positions: FuturesPosition[];
}

type SortField = 'symbol' | 'positionValue' | 'unrealizedPnl' | 'unrealizedPnlPercent' | 'leverage';
type SortDirection = 'asc' | 'desc';
type SideFilter = 'all' | 'long' | 'short';

export function FuturesPositionsTable({ positions }: FuturesPositionsTableProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('positionValue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sideFilter, setSideFilter] = useState<SideFilter>('all');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedPositions = useMemo(() => {
    let result = [...positions];

    // Filter by search term
    if (searchTerm) {
      result = result.filter((p) =>
        p.symbol.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by side
    if (sideFilter !== 'all') {
      result = result.filter((p) =>
        sideFilter === 'long' ? p.side === 'Buy' : p.side === 'Sell'
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const multiplier = sortDirection === 'asc' ? 1 : -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * multiplier;
      }
      return ((aVal as number) - (bVal as number)) * multiplier;
    });

    return result;
  }, [positions, searchTerm, sortField, sortDirection, sideFilter]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredAndSortedPositions.reduce(
      (acc, pos) => ({
        positionValue: acc.positionValue + pos.positionValue,
        unrealizedPnl: acc.unrealizedPnl + pos.unrealizedPnl,
        margin: acc.margin + pos.margin,
      }),
      { positionValue: 0, unrealizedPnl: 0, margin: 0 }
    );
  }, [filteredAndSortedPositions]);

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPrice = (value: number) => {
    if (value >= 1000) {
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${value.toFixed(4)}`;
  };

  const SortHeader = ({ field, children, align = 'left' }: { field: SortField; children: React.ReactNode; align?: 'left' | 'right' | 'center' }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        "flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium transition-colors w-full",
        align === 'right' && "justify-end",
        align === 'center' && "justify-center",
        isDark ? "text-white/40 hover:text-white/60" : "text-gray-500 hover:text-gray-700"
      )}
    >
      {children}
      <ArrowUpDown className={cn("w-3 h-3", sortField === field && "text-accent-purple")} />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", isDark ? "text-white/30" : "text-gray-400")} />
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "w-48 h-8 pl-9 pr-3 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-accent-purple/50",
                isDark
                  ? "bg-white/[0.03] border border-white/[0.06] text-white placeholder:text-white/30"
                  : "bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400"
              )}
            />
          </div>

          {/* Side Filter */}
          <div className="flex items-center gap-1">
            <Filter className={cn("w-4 h-4", isDark ? "text-white/30" : "text-gray-400")} />
            <div className={cn("flex rounded-lg overflow-hidden text-[11px]", isDark ? "bg-white/[0.03]" : "bg-gray-100")}>
              {(['all', 'long', 'short'] as SideFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSideFilter(filter)}
                  className={cn(
                    "px-3 py-1.5 font-medium capitalize transition-colors",
                    sideFilter === filter
                      ? filter === 'long'
                        ? "bg-status-success/20 text-status-success"
                        : filter === 'short'
                          ? "bg-status-error/20 text-status-error"
                          : "bg-accent-purple/20 text-accent-purple"
                      : isDark
                        ? "text-white/40 hover:text-white/60"
                        : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-4 text-[11px]">
          <span className={isDark ? "text-white/40" : "text-gray-500"}>
            {filteredAndSortedPositions.length} position{filteredAndSortedPositions.length !== 1 ? 's' : ''}
          </span>
          <span className={isDark ? "text-white/40" : "text-gray-500"}>|</span>
          <span className={isDark ? "text-white/70" : "text-gray-700"}>
            Total: {formatCurrency(totals.positionValue)}
          </span>
          <span className={totals.unrealizedPnl >= 0 ? "text-status-success" : "text-status-error"}>
            PnL: {totals.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(totals.unrealizedPnl)}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={cn("border-b", isDark ? "border-white/[0.06]" : "border-gray-200")}>
              <th className="text-left py-3 px-3 w-[12%]">
                <SortHeader field="symbol">Symbol</SortHeader>
              </th>
              <th className="text-center py-3 px-2 w-[8%]">
                <span className={cn("text-[10px] uppercase tracking-wider font-medium", isDark ? "text-white/40" : "text-gray-500")}>
                  Side
                </span>
              </th>
              <th className="text-right py-3 px-3 w-[7%]">
                <span className={cn("text-[10px] uppercase tracking-wider font-medium", isDark ? "text-white/40" : "text-gray-500")}>
                  Size
                </span>
              </th>
              <th className="text-right py-3 px-3 w-[11%]">
                <span className={cn("text-[10px] uppercase tracking-wider font-medium", isDark ? "text-white/40" : "text-gray-500")}>
                  Entry Price
                </span>
              </th>
              <th className="text-right py-3 px-3 w-[11%]">
                <span className={cn("text-[10px] uppercase tracking-wider font-medium", isDark ? "text-white/40" : "text-gray-500")}>
                  Mark Price
                </span>
              </th>
              <th className="text-right py-3 px-3 w-[9%]">
                <SortHeader field="positionValue" align="right">Value</SortHeader>
              </th>
              <th className="text-right py-3 px-3 w-[10%]">
                <SortHeader field="unrealizedPnl" align="right">PnL</SortHeader>
              </th>
              <th className="text-center py-3 px-3 w-[9%]">
                <SortHeader field="leverage" align="center">Leverage</SortHeader>
              </th>
              <th className="text-right py-3 px-3 w-[9%]">
                <span className={cn("text-[10px] uppercase tracking-wider font-medium", isDark ? "text-white/40" : "text-gray-500")}>
                  Margin
                </span>
              </th>
              <th className="text-right py-3 px-3 w-[10%]">
                <span className={cn("text-[10px] uppercase tracking-wider font-medium", isDark ? "text-white/40" : "text-gray-500")}>
                  Liq. Price
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedPositions.map((position, index) => {
              const isLong = position.side === 'Buy';
              const isProfitable = position.unrealizedPnl >= 0;

              return (
                <tr
                  key={`${position.symbol}-${index}`}
                  className={cn(
                    "border-b transition-colors",
                    isDark
                      ? "border-white/[0.03] hover:bg-white/[0.02]"
                      : "border-gray-100 hover:bg-gray-50"
                  )}
                >
                  {/* Symbol */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[12px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                        {position.symbol}
                      </span>
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded", isDark ? "bg-white/[0.05] text-white/40" : "bg-gray-100 text-gray-500")}>
                        {position.category}
                      </span>
                    </div>
                  </td>

                  {/* Side */}
                  <td className="py-3 px-2 text-center">
                    <div
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold",
                        isLong
                          ? "bg-status-success/10 text-status-success"
                          : "bg-status-error/10 text-status-error"
                      )}
                    >
                      {isLong ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isLong ? 'LONG' : 'SHORT'}
                    </div>
                  </td>

                  {/* Size */}
                  <td className="py-3 px-3 text-right">
                    <span className={cn("text-[12px] tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                      {position.size.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </span>
                  </td>

                  {/* Entry Price */}
                  <td className="py-3 px-3 text-right">
                    <span className={cn("text-[12px] tabular-nums", isDark ? "text-white/70" : "text-gray-700")}>
                      {formatPrice(position.entryPrice)}
                    </span>
                  </td>

                  {/* Mark Price */}
                  <td className="py-3 px-3 text-right">
                    <span className={cn("text-[12px] tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                      {formatPrice(position.markPrice)}
                    </span>
                  </td>

                  {/* Position Value */}
                  <td className="py-3 px-3 text-right">
                    <span className={cn("text-[12px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                      {formatCurrency(position.positionValue)}
                    </span>
                  </td>

                  {/* PnL */}
                  <td className="py-3 px-3 text-right">
                    <div className="flex flex-col items-end">
                      <span
                        className={cn(
                          "text-[12px] font-medium tabular-nums",
                          isProfitable ? "text-status-success" : "text-status-error"
                        )}
                      >
                        {isProfitable ? '+' : ''}{formatCurrency(position.unrealizedPnl)}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] tabular-nums",
                          isProfitable ? "text-status-success/70" : "text-status-error/70"
                        )}
                      >
                        {isProfitable ? '+' : ''}{position.unrealizedPnlPercent.toFixed(2)}%
                      </span>
                    </div>
                  </td>

                  {/* Leverage */}
                  <td className="py-3 px-3 text-center">
                    <span
                      className={cn(
                        "inline-flex px-2 py-0.5 rounded text-[11px] font-semibold tabular-nums",
                        position.leverage >= 20
                          ? "bg-status-error/10 text-status-error"
                          : position.leverage >= 10
                            ? "bg-accent-orange/10 text-accent-orange"
                            : "bg-accent-blue/10 text-accent-blue"
                      )}
                    >
                      {position.leverage}x
                    </span>
                  </td>

                  {/* Margin */}
                  <td className="py-3 px-3 text-right">
                    <span className={cn("text-[12px] tabular-nums", isDark ? "text-white/70" : "text-gray-700")}>
                      {formatCurrency(position.margin)}
                    </span>
                  </td>

                  {/* Liquidation Price */}
                  <td className="py-3 px-3 text-right">
                    <span className={cn("text-[12px] tabular-nums", isDark ? "text-white/50" : "text-gray-500")}>
                      {formatPrice(position.liquidationPrice)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* No results */}
      {filteredAndSortedPositions.length === 0 && (
        <div className="py-8 text-center">
          <p className={cn("text-[12px]", isDark ? "text-white/40" : "text-gray-500")}>
            No positions match your filters
          </p>
        </div>
      )}
    </div>
  );
}
