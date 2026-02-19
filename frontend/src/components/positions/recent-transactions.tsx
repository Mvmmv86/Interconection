'use client';

import { useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Coins, Droplets, Loader2, AlertCircle, CheckCircle, Clock, Building2, ArrowLeftRight, Filter, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { useWalletTransactions } from '@/hooks/useWalletTransactions';
import { useExchangeTransactions } from '@/hooks/useExchangeTransactions';


// Unified transaction for display
interface DisplayTransaction {
  id: string;
  type: string;
  asset: string;
  symbol: string;
  amount: number;
  value: number;
  icon?: string;
  relativeTime: string;
  location: string;
  chain?: string;
  status?: string;
  toSymbol?: string;
  source: 'wallet' | 'exchange';
  sortTimestamp: number;
}

const typeConfig: Record<string, { icon: typeof ArrowUpRight; color: string; bg: string; label: string }> = {
  buy: { icon: ArrowDownLeft, color: 'text-status-success', bg: 'bg-status-success/10', label: 'Buy' },
  sell: { icon: ArrowUpRight, color: 'text-status-error', bg: 'bg-status-error/10', label: 'Sell' },
  transfer_in: { icon: ArrowDownLeft, color: 'text-accent-blue', bg: 'bg-accent-blue/10', label: 'Receive' },
  transfer_out: { icon: ArrowUpRight, color: 'text-accent-orange', bg: 'bg-accent-orange/10', label: 'Send' },
  swap: { icon: RefreshCw, color: 'text-accent-purple', bg: 'bg-accent-purple/10', label: 'Swap' },
  stake: { icon: Coins, color: 'text-accent-cyan', bg: 'bg-accent-cyan/10', label: 'Stake' },
  unstake: { icon: Coins, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10', label: 'Unstake' },
  claim: { icon: Droplets, color: 'text-status-success', bg: 'bg-status-success/10', label: 'Claim' },
  approve: { icon: CheckCircle, color: 'text-white/50', bg: 'bg-white/5', label: 'Approve' },
  deposit: { icon: ArrowDownLeft, color: 'text-status-success', bg: 'bg-status-success/10', label: 'Deposit' },
  withdrawal: { icon: ArrowUpRight, color: 'text-status-error', bg: 'bg-status-error/10', label: 'Withdrawal' },
  internal_transfer: { icon: ArrowLeftRight, color: 'text-accent-blue', bg: 'bg-accent-blue/10', label: 'Transfer' },
  other: { icon: RefreshCw, color: 'text-white/50', bg: 'bg-white/5', label: 'Contract' },
};

// Filter type groups
type TxFilterType = 'all' | 'deposits' | 'withdrawals' | 'transfers' | 'swaps' | 'buy_sell' | 'staking';

const txFilterGroups: Record<TxFilterType, { label: string; types: string[] }> = {
  all: { label: 'All', types: [] },
  deposits: { label: 'Deposits', types: ['deposit', 'transfer_in'] },
  withdrawals: { label: 'Withdrawals', types: ['withdrawal', 'transfer_out'] },
  transfers: { label: 'Transfers', types: ['internal_transfer'] },
  swaps: { label: 'Swaps', types: ['swap'] },
  buy_sell: { label: 'Buy/Sell', types: ['buy', 'sell'] },
  staking: { label: 'Staking', types: ['stake', 'unstake', 'claim'] },
};

// Date period options
type DatePeriod = '7d' | '30d' | '90d' | 'all';

const datePeriods: { value: DatePeriod; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'All' },
];

function formatAmount(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(2)}M`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(2)}K`;
  } else if (amount >= 1) {
    return amount.toFixed(2);
  } else if (amount >= 0.0001) {
    return amount.toFixed(4);
  }
  return amount.toFixed(6);
}

function formatValue(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return `${Math.floor(diffDay / 30)}mo ago`;
}

function getDateCutoff(period: DatePeriod): number {
  if (period === 'all') return 0;
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

export function RecentTransactions() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { transactions: walletTxs, isLoading: isLoadingWallet, isError: isWalletError, error: walletError } = useWalletTransactions({ limit: 50 });
  const { transactions: exchangeTxs, isLoading: isLoadingExchange } = useExchangeTransactions({ limit: 50 });

  const [filterType, setFilterType] = useState<TxFilterType>('all');
  const [datePeriod, setDatePeriod] = useState<DatePeriod>('30d');
  const [showFilters, setShowFilters] = useState(false);

  const isLoading = isLoadingWallet && isLoadingExchange;

  // Merge all transactions (unfiltered)
  const mergedTransactions = useMemo<DisplayTransaction[]>(() => {
    const merged: DisplayTransaction[] = [];

    // Add wallet transactions
    for (const tx of walletTxs) {
      merged.push({
        id: `wallet-${tx.id}`,
        type: tx.type,
        asset: tx.asset,
        symbol: tx.symbol,
        amount: tx.amount,
        value: tx.value,
        icon: tx.icon,
        relativeTime: tx.relativeTime,
        location: tx.location,
        chain: tx.chain,
        status: tx.status,
        toSymbol: tx.toSymbol,
        source: 'wallet',
        sortTimestamp: tx.timestamp ? new Date(tx.timestamp).getTime() : 0,
      });
    }

    // Add exchange transactions
    for (const tx of exchangeTxs) {
      let displayLocation = tx.exchangeName;
      if (tx.type === 'internal_transfer' && tx.fromAccount && tx.toAccount) {
        displayLocation = `${tx.fromAccount} → ${tx.toAccount}`;
      }

      merged.push({
        id: `exchange-${tx.id}`,
        type: tx.type,
        asset: tx.coin,
        symbol: tx.coin,
        amount: tx.amount,
        value: tx.valueUsd,
        relativeTime: getRelativeTime(tx.timestamp),
        location: displayLocation,
        chain: tx.chain || tx.exchangeName,
        status: tx.status === 'completed' ? undefined : tx.status,
        source: 'exchange',
        sortTimestamp: new Date(tx.timestamp).getTime(),
      });
    }

    // Sort by timestamp descending (most recent first)
    merged.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
    return merged;
  }, [walletTxs, exchangeTxs]);

  // Apply filters
  const filteredTransactions = useMemo(() => {
    const dateCutoff = getDateCutoff(datePeriod);
    const typeGroup = txFilterGroups[filterType];

    return mergedTransactions.filter((tx) => {
      // Date filter
      if (tx.sortTimestamp > 0 && tx.sortTimestamp < dateCutoff) return false;

      // Type filter
      if (filterType !== 'all' && !typeGroup.types.includes(tx.type)) return false;

      return true;
    });
  }, [mergedTransactions, filterType, datePeriod]);

  // Count by filter group (for showing counts on pills)
  const filterCounts = useMemo(() => {
    const dateCutoff = getDateCutoff(datePeriod);
    const dateFiltered = mergedTransactions.filter(
      (tx) => tx.sortTimestamp === 0 || tx.sortTimestamp >= dateCutoff
    );

    const counts: Record<TxFilterType, number> = {
      all: dateFiltered.length,
      deposits: 0,
      withdrawals: 0,
      transfers: 0,
      swaps: 0,
      buy_sell: 0,
      staking: 0,
    };

    for (const tx of dateFiltered) {
      for (const [key, group] of Object.entries(txFilterGroups)) {
        if (key !== 'all' && group.types.includes(tx.type)) {
          counts[key as TxFilterType]++;
        }
      }
    }

    return counts;
  }, [mergedTransactions, datePeriod]);

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
  if (isLoading) {
    return (
      <div className="backdrop-blur-sm rounded-xl p-4" style={cardStyle}>
        <div className={cn('flex items-center justify-between pb-3 mb-3 border-b', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>
          <h3 className={cn('text-[12px] font-semibold uppercase tracking-wider', isDark ? 'text-white' : 'text-gray-900')}>
            Recent Transactions
          </h3>
        </div>
        <div className="flex items-center justify-center h-[200px]">
          <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-white/30' : 'text-gray-400')} />
        </div>
      </div>
    );
  }

  // Error state (only if wallet had errors AND no exchange transactions)
  if (isWalletError && exchangeTxs.length === 0) {
    const errorMessage = walletError?.message || '';
    const isApiKeyError = errorMessage.includes('API_KEY_UNAUTHORIZED') || errorMessage.includes('API_KEY_FORBIDDEN');

    return (
      <div className="backdrop-blur-sm rounded-xl p-4" style={cardStyle}>
        <div className={cn('flex items-center justify-between pb-3 mb-3 border-b', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>
          <h3 className={cn('text-[12px] font-semibold uppercase tracking-wider', isDark ? 'text-white' : 'text-gray-900')}>
            Recent Transactions
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className={cn('w-8 h-8 mb-2', isDark ? 'text-accent-yellow' : 'text-yellow-500')} />
          <p className={cn('text-[11px] mb-1', isDark ? 'text-white/40' : 'text-gray-500')}>
            {isApiKeyError ? 'Transactions API requires upgrade' : 'Failed to load transactions'}
          </p>
          <p className={cn('text-[10px] max-w-[200px]', isDark ? 'text-white/30' : 'text-gray-400')}>
            {isApiKeyError
              ? 'The Zerion API dev key does not include transactions. Upgrade to a paid plan for this feature.'
              : 'Check your connection and try again'
            }
          </p>
        </div>
      </div>
    );
  }

  // Check if there are any transactions at all (before filters)
  const hasNoData = mergedTransactions.length === 0;

  // Empty state (no data at all)
  if (hasNoData) {
    return (
      <div className="backdrop-blur-sm rounded-xl p-4" style={cardStyle}>
        <div className={cn('flex items-center justify-between pb-3 mb-3 border-b', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>
          <h3 className={cn('text-[12px] font-semibold uppercase tracking-wider', isDark ? 'text-white' : 'text-gray-900')}>
            Recent Transactions
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className={cn('w-8 h-8 mb-2', isDark ? 'text-white/20' : 'text-gray-300')} />
          <p className={cn('text-[11px] mb-1', isDark ? 'text-white/40' : 'text-gray-500')}>
            No transactions found
          </p>
          <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-400')}>
            Connect a wallet or exchange to see transactions
          </p>
        </div>
      </div>
    );
  }

  const activeFilterCount = (filterType !== 'all' ? 1 : 0) + (datePeriod !== 'all' ? 1 : 0);

  return (
    <div className="backdrop-blur-sm rounded-xl p-4" style={cardStyle}>
      {/* Header */}
      <div className={cn('flex items-center justify-between pb-3 mb-3 border-b', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>
        <div>
          <h3 className={cn('text-[12px] font-semibold uppercase tracking-wider', isDark ? 'text-white' : 'text-gray-900')}>
            Recent Transactions
          </h3>
          <p className={cn('text-[10px] mt-0.5', isDark ? 'text-white/30' : 'text-gray-500')}>
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
            {filterType !== 'all' && ` · ${txFilterGroups[filterType].label}`}
            {datePeriod !== 'all' && ` · Last ${datePeriod === '7d' ? '7 days' : datePeriod === '30d' ? '30 days' : '90 days'}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Date period tabs */}
          <div className={cn(
            'flex items-center rounded-lg border overflow-hidden',
            isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-gray-100 border-gray-200'
          )}>
            {datePeriods.map((period) => (
              <button
                key={period.value}
                onClick={() => setDatePeriod(period.value)}
                className={cn(
                  'px-2 py-1 text-[10px] font-medium transition-colors',
                  datePeriod === period.value
                    ? 'bg-accent-purple/20 text-accent-purple'
                    : isDark
                      ? 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                )}
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'h-7 px-2.5 rounded-lg border text-[10px] font-medium flex items-center gap-1 transition-colors',
              showFilters || filterType !== 'all'
                ? 'bg-accent-purple/10 border-accent-purple/30 text-accent-purple'
                : isDark
                  ? 'bg-white/[0.03] border-white/[0.06] text-white/70 hover:bg-white/[0.05]'
                  : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
            )}
          >
            <Filter className="w-3 h-3" />
            {activeFilterCount > 0 && (
              <span className="bg-accent-purple text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={cn('w-2.5 h-2.5 transition-transform', showFilters && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      {showFilters && (
        <div className={cn('flex flex-wrap items-center gap-1.5 mb-3 pb-3 border-b', isDark ? 'border-white/[0.03]' : 'border-gray-100')}>
          <span className={cn('text-[9px] mr-1', isDark ? 'text-white/30' : 'text-gray-500')}>Type:</span>
          {(Object.keys(txFilterGroups) as TxFilterType[]).map((type) => {
            const group = txFilterGroups[type];
            const count = filterCounts[type];

            // Hide groups with 0 count (except 'all')
            if (type !== 'all' && count === 0) return null;

            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  'px-2 py-1 rounded-md text-[10px] font-medium transition-colors flex items-center gap-1',
                  filterType === type
                    ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
                    : isDark
                      ? 'bg-white/[0.03] text-white/50 hover:bg-white/[0.06] border border-white/[0.04]'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                )}
              >
                {group.label}
                <span className={cn(
                  'text-[8px] px-1 py-0.5 rounded',
                  filterType === type
                    ? 'bg-accent-purple/20 text-accent-purple'
                    : isDark ? 'bg-white/[0.05] text-white/30' : 'bg-gray-200 text-gray-500'
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* List with scroll */}
      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
        {filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className={cn('w-6 h-6 mb-2', isDark ? 'text-white/20' : 'text-gray-300')} />
            <p className={cn('text-[11px]', isDark ? 'text-white/40' : 'text-gray-500')}>
              No transactions match the current filters
            </p>
            <button
              onClick={() => { setFilterType('all'); setDatePeriod('all'); }}
              className="text-[10px] text-accent-purple hover:underline mt-1"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const config = typeConfig[tx.type] || typeConfig.other;
            const Icon = config.icon;
            const isOutgoing = tx.type === 'sell' || tx.type === 'transfer_out' || tx.type === 'withdrawal';

            // Build display text
            let displayAsset = tx.asset;

            // For swaps, show "FROM → TO"
            if (tx.type === 'swap' && tx.toSymbol) {
              displayAsset = `${tx.symbol} → ${tx.toSymbol}`;
            }

            // For internal transfers, show the coin
            if (tx.type === 'internal_transfer') {
              displayAsset = tx.asset;
            }

            return (
              <div
                key={tx.id}
                className={cn(
                  'flex items-center justify-between p-2.5 rounded-lg transition-colors cursor-pointer',
                  isDark ? 'bg-white/[0.02] hover:bg-white/[0.03]' : 'bg-gray-50 hover:bg-gray-100'
                )}
              >
                <div className="flex items-center gap-2.5">
                  {/* Icon */}
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', config.bg)}>
                    {tx.icon ? (
                      <img src={tx.icon} alt={tx.symbol} className="w-5 h-5 rounded-full" />
                    ) : (
                      <Icon className={cn('w-4 h-4', config.color)} />
                    )}
                  </div>

                  {/* Details */}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                        {displayAsset}
                      </p>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[8px] font-medium',
                        config.bg, config.color
                      )}>
                        {config.label}
                      </span>
                      {tx.source === 'exchange' && (
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[8px] font-medium',
                          'bg-accent-blue/10 text-accent-blue'
                        )}>
                          <Building2 className="w-2.5 h-2.5 inline mr-0.5" />
                          CEX
                        </span>
                      )}
                      {tx.status === 'pending' && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-medium bg-accent-yellow/10 text-accent-yellow">
                          <Clock className="w-2.5 h-2.5" />
                          Pending
                        </span>
                      )}
                      {tx.status === 'failed' && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-status-error/10 text-status-error">
                          Failed
                        </span>
                      )}
                    </div>
                    <div className={cn('flex items-center gap-1.5 text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                      <span>{tx.relativeTime}</span>
                      <span>·</span>
                      <span>{tx.location}</span>
                      {tx.chain && (
                        <>
                          <span>·</span>
                          <span className={isDark ? 'text-white/50' : 'text-gray-600'}>{tx.chain}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <p className={cn('text-[11px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                    {isOutgoing ? '-' : '+'}{formatAmount(tx.amount)} {tx.type !== 'swap' ? tx.symbol : ''}
                  </p>
                  {tx.value > 0 && (
                    <p className={cn('text-[9px] tabular-nums', isDark ? 'text-white/30' : 'text-gray-500')}>
                      {formatValue(tx.value)}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className={cn('flex items-center justify-between mt-3 pt-3 border-t', isDark ? 'border-white/[0.03]' : 'border-gray-100')}>
        <span className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>
          {filteredTransactions.length} of {mergedTransactions.length} transaction{mergedTransactions.length !== 1 ? 's' : ''}
        </span>
        <button className="text-[10px] text-accent-blue hover:underline">View all transactions →</button>
      </div>
    </div>
  );
}
