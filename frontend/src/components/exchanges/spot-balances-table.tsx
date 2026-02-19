'use client';

import { useState, useMemo } from 'react';
import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
import { ArrowUpDown, Search, TrendingUp, TrendingDown } from 'lucide-react';
import type { SpotBalance, FundingBalance, MarginBalance } from '@/hooks/useExchangeDetail';

type Balance = SpotBalance | FundingBalance | MarginBalance;

interface SpotBalancesTableProps {
  balances: Balance[];
}

type SortField = 'asset' | 'total' | 'valueUsd' | 'change24h';
type SortDirection = 'asc' | 'desc';

// Type guard to check if balance has change24h property
function hasChange24h(balance: Balance): balance is SpotBalance | MarginBalance {
  return 'change24h' in balance;
}

// Type guard for margin balance
function isMarginBalance(balance: Balance): balance is MarginBalance {
  return 'borrowed' in balance;
}

export function SpotBalancesTable({ balances }: SpotBalancesTableProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('valueUsd');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedBalances = useMemo(() => {
    let result = [...balances];

    // Filter by search term
    if (searchTerm) {
      result = result.filter((b) =>
        b.asset.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortField === 'change24h') {
        aVal = hasChange24h(a) ? a.change24h : 0;
        bVal = hasChange24h(b) ? b.change24h : 0;
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }

      const multiplier = sortDirection === 'asc' ? 1 : -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * multiplier;
      }
      return ((aVal as number) - (bVal as number)) * multiplier;
    });

    return result;
  }, [balances, searchTerm, sortField, sortDirection]);

  // Calculate totals
  const totalValue = useMemo(() => {
    return filteredAndSortedBalances.reduce((acc, b) => acc + b.valueUsd, 0);
  }, [filteredAndSortedBalances]);

  // Check if any balance has margin data
  const hasMarginData = balances.some(isMarginBalance);

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatQuantity = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }
    if (value < 0.0001) {
      return value.toExponential(4);
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
  };

  const formatPrice = (value: number) => {
    if (value >= 1000) {
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (value < 0.0001) {
      return `$${value.toExponential(4)}`;
    }
    return `$${value.toFixed(4)}`;
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        "flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium transition-colors",
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
              placeholder="Search asset..."
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
        </div>

        {/* Summary */}
        <div className="flex items-center gap-4 text-[11px]">
          <span className={isDark ? "text-white/40" : "text-gray-500"}>
            {filteredAndSortedBalances.length} asset{filteredAndSortedBalances.length !== 1 ? 's' : ''}
          </span>
          <span className={isDark ? "text-white/40" : "text-gray-500"}>|</span>
          <span className={isDark ? "text-white/70" : "text-gray-700"}>
            Total: {formatCurrency(totalValue)}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={cn("border-b", isDark ? "border-white/[0.06]" : "border-gray-200")}>
              <th className="text-left py-3 px-2">
                <SortHeader field="asset">Asset</SortHeader>
              </th>
              <th className="text-right py-3 px-2">
                <span className={cn("text-[10px] uppercase tracking-wider font-medium", isDark ? "text-white/40" : "text-gray-500")}>
                  Free
                </span>
              </th>
              <th className="text-right py-3 px-2">
                <span className={cn("text-[10px] uppercase tracking-wider font-medium", isDark ? "text-white/40" : "text-gray-500")}>
                  Locked
                </span>
              </th>
              <th className="text-right py-3 px-2">
                <SortHeader field="total">Total</SortHeader>
              </th>
              {hasMarginData && (
                <>
                  <th className="text-right py-3 px-2">
                    <span className={cn("text-[10px] uppercase tracking-wider font-medium", isDark ? "text-white/40" : "text-gray-500")}>
                      Borrowed
                    </span>
                  </th>
                  <th className="text-right py-3 px-2">
                    <span className={cn("text-[10px] uppercase tracking-wider font-medium", isDark ? "text-white/40" : "text-gray-500")}>
                      Interest
                    </span>
                  </th>
                </>
              )}
              <th className="text-right py-3 px-2">
                <span className={cn("text-[10px] uppercase tracking-wider font-medium", isDark ? "text-white/40" : "text-gray-500")}>
                  Price
                </span>
              </th>
              <th className="text-right py-3 px-2">
                <SortHeader field="valueUsd">Value</SortHeader>
              </th>
              <th className="text-right py-3 px-2">
                <SortHeader field="change24h">24h</SortHeader>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedBalances.map((balance, index) => {
              const change = hasChange24h(balance) ? balance.change24h : 0;
              const isPositiveChange = change >= 0;

              return (
                <tr
                  key={`${balance.asset}-${index}`}
                  className={cn(
                    "border-b transition-colors",
                    isDark
                      ? "border-white/[0.03] hover:bg-white/[0.02]"
                      : "border-gray-100 hover:bg-gray-50"
                  )}
                >
                  {/* Asset */}
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold",
                          isDark ? "bg-white/[0.05] text-white/60" : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {balance.asset.slice(0, 3)}
                      </div>
                      <span className={cn("text-[12px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                        {balance.asset}
                      </span>
                    </div>
                  </td>

                  {/* Free */}
                  <td className="py-3 px-2 text-right">
                    <span className={cn("text-[12px] tabular-nums", isDark ? "text-white/70" : "text-gray-700")}>
                      {formatQuantity(balance.free)}
                    </span>
                  </td>

                  {/* Locked */}
                  <td className="py-3 px-2 text-right">
                    <span className={cn("text-[12px] tabular-nums", isDark ? "text-white/50" : "text-gray-500")}>
                      {formatQuantity(balance.locked)}
                    </span>
                  </td>

                  {/* Total */}
                  <td className="py-3 px-2 text-right">
                    <span className={cn("text-[12px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                      {formatQuantity(balance.total)}
                    </span>
                  </td>

                  {/* Margin specific columns */}
                  {hasMarginData && (
                    <>
                      <td className="py-3 px-2 text-right">
                        <span className={cn("text-[12px] tabular-nums", isDark ? "text-accent-orange" : "text-orange-600")}>
                          {isMarginBalance(balance) ? formatQuantity(balance.borrowed) : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={cn("text-[12px] tabular-nums", isDark ? "text-white/50" : "text-gray-500")}>
                          {isMarginBalance(balance) ? formatQuantity(balance.interest) : '-'}
                        </span>
                      </td>
                    </>
                  )}

                  {/* Price */}
                  <td className="py-3 px-2 text-right">
                    <span className={cn("text-[12px] tabular-nums", isDark ? "text-white/70" : "text-gray-700")}>
                      {formatPrice(balance.priceUsd)}
                    </span>
                  </td>

                  {/* Value */}
                  <td className="py-3 px-2 text-right">
                    <span className={cn("text-[12px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                      {formatCurrency(balance.valueUsd)}
                    </span>
                  </td>

                  {/* 24h Change */}
                  <td className="py-3 px-2 text-right">
                    <div
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium tabular-nums",
                        isPositiveChange
                          ? "bg-status-success/10 text-status-success"
                          : "bg-status-error/10 text-status-error"
                      )}
                    >
                      {isPositiveChange ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isPositiveChange ? '+' : ''}{change.toFixed(2)}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* No results */}
      {filteredAndSortedBalances.length === 0 && (
        <div className="py-8 text-center">
          <p className={cn("text-[12px]", isDark ? "text-white/40" : "text-gray-500")}>
            No assets match your search
          </p>
        </div>
      )}
    </div>
  );
}
