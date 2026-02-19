'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useTheme } from '@/contexts/theme-context';
import {
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  ChevronRight,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddExchangeModal } from '@/components/exchanges/add-exchange-modal';
import {
  useExchangePositions,
  mockExchangeData,
} from '@/hooks/useExchangePositions';

const statusConfig = {
  connected: { icon: CheckCircle2, color: 'text-status-success', bg: 'bg-status-success/10', label: 'Connected' },
  syncing: { icon: RefreshCw, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10', label: 'Syncing' },
  error: { icon: AlertCircle, color: 'text-status-error', bg: 'bg-status-error/10', label: 'Error' },
  pending: { icon: Clock, color: 'text-white/30', bg: 'bg-white/5', label: 'Pending' },
};

// Use mock data in development mode when backend is not available
const USE_MOCK_DATA = process.env.NODE_ENV === 'development';

export default function ExchangesPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Fetch real data from API
  const {
    exchanges: apiExchanges,
    totalValue: apiTotalValue,
    spotHoldings: apiSpotHoldings,
    marginPositions: apiMarginPositions,
    futuresPositions: apiFuturesPositions,
    isLoading,
    error,
    refresh,
    syncAllAndRefresh,
  } = useExchangePositions();

  // Use mock data in development if no real data available
  const exchanges = USE_MOCK_DATA && apiExchanges.length === 0 ? mockExchangeData.exchanges : apiExchanges;
  const totalValue = USE_MOCK_DATA && apiExchanges.length === 0 ? mockExchangeData.totalValue : apiTotalValue;
  const totalSpot = USE_MOCK_DATA && apiExchanges.length === 0 ? mockExchangeData.spotHoldings : apiSpotHoldings;
  const totalMargin = USE_MOCK_DATA && apiExchanges.length === 0 ? mockExchangeData.marginPositions : apiMarginPositions;
  const totalFutures = USE_MOCK_DATA && apiExchanges.length === 0 ? mockExchangeData.futuresPositions : apiFuturesPositions;

  const filteredExchanges = exchanges.filter((e) =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddExchangeSuccess = () => {
    setIsAddModalOpen(false);
    refresh();
  };

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl p-4 animate-pulse"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
              : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
            border: isDark
              ? '1px solid rgba(255, 255, 255, 0.08)'
              : '1px solid rgba(203, 213, 225, 0.6)',
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className={cn("w-10 h-10 rounded-xl", isDark ? "bg-white/10" : "bg-gray-200")} />
            <div className="flex-1">
              <div className={cn("h-4 w-24 rounded mb-2", isDark ? "bg-white/10" : "bg-gray-200")} />
              <div className={cn("h-3 w-32 rounded", isDark ? "bg-white/5" : "bg-gray-100")} />
            </div>
            <div className="text-right">
              <div className={cn("h-5 w-20 rounded mb-1", isDark ? "bg-white/10" : "bg-gray-200")} />
              <div className={cn("h-3 w-12 rounded", isDark ? "bg-white/5" : "bg-gray-100")} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[1, 2, 3].map((j) => (
              <div key={j} className={cn("p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                <div className={cn("h-2 w-8 rounded mb-2", isDark ? "bg-white/10" : "bg-gray-200")} />
                <div className={cn("h-4 w-12 rounded", isDark ? "bg-white/10" : "bg-gray-200")} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // Empty state
  const EmptyState = () => (
    <div
      className="rounded-xl p-12 text-center"
      style={{
        background: isDark
          ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
          : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
        border: isDark
          ? '1px solid rgba(255, 255, 255, 0.08)'
          : '1px solid rgba(203, 213, 225, 0.6)',
      }}
    >
      <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4", isDark ? "bg-white/[0.05]" : "bg-gray-100")}>
        <Building2 className={cn("w-8 h-8", isDark ? "text-white/30" : "text-gray-400")} />
      </div>
      <h3 className={cn("text-[16px] font-semibold mb-2", isDark ? "text-white" : "text-gray-900")}>
        No exchanges connected
      </h3>
      <p className={cn("text-[12px] mb-6 max-w-sm mx-auto", isDark ? "text-white/50" : "text-gray-500")}>
        Connect your first exchange to start tracking your positions, balances, and performance in real-time.
      </p>
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="inline-flex items-center gap-2 h-10 px-6 rounded-lg bg-accent-purple text-white text-[12px] font-medium hover:bg-accent-purple/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Your First Exchange
      </button>
    </div>
  );

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #0a0a0f 0%, #0d0d14 20%, #0f1018 40%, #0d0e15 60%, #0a0b10 80%, #08090d 100%)'
          : '#ffffff',
      }}
    >
      {/* Futuristic gradient overlays - only for dark mode */}
      {isDark && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse at 0% 0%, rgba(59, 130, 246, 0.04) 0%, transparent 50%),
              radial-gradient(ellipse at 100% 0%, rgba(139, 92, 246, 0.03) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 100%, rgba(6, 182, 212, 0.02) 0%, transparent 40%),
              linear-gradient(180deg, rgba(255, 255, 255, 0.01) 0%, transparent 30%)
            `,
          }}
        />
      )}

      <Sidebar />

      <div className="pl-[200px] transition-all duration-300 relative z-10">
        <Header />

        <main className="p-5">
          {/* Page Title */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className={cn("flex items-center gap-2 text-[11px] mb-1", isDark ? "text-white/30" : "text-gray-500")}>
                <span>Positions</span>
                <ChevronRight className="w-3 h-3" />
                <span className={isDark ? "text-white/50" : "text-gray-600"}>Exchanges</span>
              </div>
              <h1 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}>Exchange Positions</h1>
              <p className={cn("text-[11px] mt-0.5", isDark ? "text-white/30" : "text-gray-500")}>
                Gerencie suas conexões com exchanges e visualize todas as posições
              </p>
            </div>
            <div className="flex items-center gap-2">
              {exchanges.length > 0 && (
                <button
                  onClick={() => syncAllAndRefresh()}
                  disabled={isLoading}
                  className={cn(
                    "flex items-center gap-2 h-9 px-3 rounded-lg text-[11px] font-medium transition-colors",
                    isDark
                      ? "bg-white/[0.05] text-white/70 hover:bg-white/[0.08]"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                  Refresh
                </button>
              )}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-purple text-white text-[11px] font-medium hover:bg-accent-purple/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Exchange
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total Value', value: totalValue, icon: Building2, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
              { label: 'Spot Holdings', value: totalSpot, icon: Building2, color: 'text-status-success', bg: 'bg-status-success/10' },
              { label: 'Margin Positions', value: totalMargin, icon: Building2, color: 'text-accent-orange', bg: 'bg-accent-orange/10' },
              { label: 'Futures Positions', value: totalFutures, icon: Building2, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl p-4 relative overflow-hidden"
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
                <div
                  className="absolute inset-x-0 top-0 h-[1px]"
                  style={{
                    background: isDark
                      ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)'
                      : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
                  }}
                />
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', card.bg)}>
                  <card.icon className={cn('w-4 h-4', card.color)} />
                </div>
                <p className={cn("text-[10px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>{card.label}</p>
                <p className={cn("text-[20px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                  {isLoading ? (
                    <span className={cn("inline-block w-16 h-6 rounded animate-pulse", isDark ? "bg-white/10" : "bg-gray-200")} />
                  ) : (
                    `$${(card.value / 1000).toFixed(0)}K`
                  )}
                </p>
              </div>
            ))}
          </div>

          {/* Search */}
          {exchanges.length > 0 && (
            <div className="mb-4">
              <div className="relative w-64">
                <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", isDark ? "text-white/30" : "text-gray-400")} />
                <input
                  type="text"
                  placeholder="Search exchanges..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "w-full h-9 pl-10 pr-4 rounded-lg text-[11px] focus:outline-none focus:border-accent-purple/50",
                    isDark
                      ? "bg-white/[0.03] border border-white/[0.06] text-white placeholder:text-white/30"
                      : "bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400"
                  )}
                />
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !USE_MOCK_DATA && (
            <div className={cn("rounded-lg p-4 mb-4 flex items-center gap-3", isDark ? "bg-status-error/10" : "bg-red-50")}>
              <AlertCircle className="w-5 h-5 text-status-error" />
              <div>
                <p className={cn("text-[12px] font-medium", isDark ? "text-white" : "text-gray-900")}>Error loading exchanges</p>
                <p className={cn("text-[11px]", isDark ? "text-white/50" : "text-gray-500")}>{error}</p>
              </div>
              <button
                onClick={() => refresh()}
                className="ml-auto text-[11px] text-accent-purple hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && exchanges.length === 0 && <LoadingSkeleton />}

          {/* Empty State */}
          {!isLoading && exchanges.length === 0 && !USE_MOCK_DATA && <EmptyState />}

          {/* Exchange Cards */}
          {(exchanges.length > 0 || USE_MOCK_DATA) && (
            <div className="space-y-3">
              {filteredExchanges.map((exchange) => {
                const status = statusConfig[exchange.status] || statusConfig.pending;
                const StatusIcon = status.icon;

                return (
                  <div
                    key={exchange.id}
                    className="rounded-xl p-4 relative overflow-hidden"
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
                    <div
                      className="absolute inset-x-0 top-0 h-[1px]"
                      style={{
                        background: isDark
                          ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)'
                          : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
                      }}
                    />
                    {/* Exchange Header */}
                    <div className={cn("flex items-center justify-between pb-3 mb-3 border-b", isDark ? "border-white/[0.06]" : "border-gray-200")}>
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-[12px] font-bold", isDark ? "bg-white/[0.05] text-white/50" : "bg-gray-100 text-gray-600")}>
                          {exchange.logo}
                        </div>
                        <div>
                          <h3 className={cn("text-[14px] font-semibold", isDark ? "text-white" : "text-gray-900")}>{exchange.name}</h3>
                          <div className="flex items-center gap-2">
                            <StatusIcon
                              className={cn(
                                'w-3 h-3',
                                status.color,
                                exchange.status === 'syncing' && 'animate-spin'
                              )}
                            />
                            <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>{exchange.lastSync}</span>
                            <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>·</span>
                            <Link
                              href={`/positions/exchanges/${exchange.id}`}
                              className={cn(
                                "flex items-center gap-1 text-[10px] font-medium transition-colors group",
                                isDark
                                  ? "text-accent-purple hover:text-accent-purple/80"
                                  : "text-accent-purple hover:text-accent-purple/70"
                              )}
                            >
                              <span>{exchange.positions} positions</span>
                              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-[18px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                          ${exchange.totalValue.toLocaleString()}
                        </p>
                        <span
                          className={cn(
                            'text-[11px] font-medium tabular-nums',
                            exchange.pnl24h >= 0 ? 'text-status-success' : 'text-status-error'
                          )}
                        >
                          {exchange.pnl24h >= 0 ? '+' : ''}{exchange.pnl24h}% 24h
                        </span>
                      </div>
                    </div>

                    {/* Balance Breakdown */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className={cn("p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                        <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>Spot</p>
                        <p className={cn("text-[14px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                          ${(exchange.spotValue / 1000).toFixed(0)}K
                        </p>
                      </div>
                      <div className={cn("p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                        <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>Margin</p>
                        <p className={cn("text-[14px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                          ${(exchange.marginValue / 1000).toFixed(0)}K
                        </p>
                      </div>
                      <div className={cn("p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                        <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>Futures</p>
                        <p className={cn("text-[14px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                          ${(exchange.futuresValue / 1000).toFixed(0)}K
                        </p>
                      </div>
                    </div>

                    {/* Top Assets */}
                    <div>
                      <p className={cn("text-[10px] uppercase tracking-wider mb-2", isDark ? "text-white/30" : "text-gray-500")}>Top Assets</p>
                      <div className="flex gap-2">
                        {exchange.topAssets.map((asset) => (
                          <div
                            key={asset.symbol}
                            className={cn("flex-1 p-2.5 rounded-lg transition-colors cursor-pointer", isDark ? "bg-white/[0.02] hover:bg-white/[0.03]" : "bg-gray-50 hover:bg-gray-100")}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={cn("text-[11px] font-medium", isDark ? "text-white" : "text-gray-900")}>{asset.symbol}</span>
                              <span
                                className={cn(
                                  'text-[9px] font-medium tabular-nums',
                                  asset.change >= 0 ? 'text-status-success' : 'text-status-error'
                                )}
                              >
                                {asset.change >= 0 ? '+' : ''}{asset.change}%
                              </span>
                            </div>
                            <p className={cn("text-[10px] tabular-nums", isDark ? "text-white/50" : "text-gray-600")}>
                              ${(asset.value / 1000).toFixed(0)}K
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Add Exchange Modal */}
      <AddExchangeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        clientId="00000000-0000-0000-0000-000000000001"
        onSuccess={handleAddExchangeSuccess}
      />
    </div>
  );
}
