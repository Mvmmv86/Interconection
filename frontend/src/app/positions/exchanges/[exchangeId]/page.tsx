'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useTheme } from '@/contexts/theme-context';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Wallet,
  BarChart3,
  PiggyBank,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExchangeDetail, mockExchangeDetail } from '@/hooks/useExchangeDetail';
import { FuturesPositionsTable } from '@/components/exchanges/futures-positions-table';
import { SpotBalancesTable } from '@/components/exchanges/spot-balances-table';
import { SubAccountsSection } from '@/components/exchanges/subaccounts-section';
import { LoanSummary } from '@/components/exchanges/loan-summary';
import { SubAccountDetailModal, type SubAccountWithBalances } from '@/components/exchanges/subaccount-detail-modal';

// Use mock data in development mode when backend is not available
const USE_MOCK_DATA = process.env.NODE_ENV === 'development';

type TabType = 'futures' | 'spot' | 'margin' | 'earn' | 'funding';

export default function ExchangeDetailPage() {
  const params = useParams();
  const exchangeId = params.exchangeId as string;
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<TabType>('futures');
  const [selectedSubAccount, setSelectedSubAccount] = useState<SubAccountWithBalances | null>(null);

  // Fetch exchange detail data
  const { data: apiData, isLoading, error, refresh } = useExchangeDetail(exchangeId);

  // Use mock data in development if no real data
  const data = USE_MOCK_DATA && !apiData ? mockExchangeDetail : apiData;

  const tabs: { id: TabType; label: string; icon: typeof Wallet; count: number }[] = [
    { id: 'futures', label: 'Futures', icon: TrendingUp, count: data?.futuresCount || 0 },
    { id: 'spot', label: 'Spot', icon: Wallet, count: data?.spotCount || 0 },
    { id: 'margin', label: 'Margin', icon: BarChart3, count: data?.marginCount || 0 },
    { id: 'earn', label: 'Earn', icon: PiggyBank, count: data?.earnCount || 0 },
    { id: 'funding', label: 'Funding', icon: Layers, count: data?.fundingCount || 0 },
  ];

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className={cn("w-12 h-12 rounded-xl animate-pulse", isDark ? "bg-white/10" : "bg-gray-200")} />
        <div className="flex-1">
          <div className={cn("h-6 w-32 rounded mb-2 animate-pulse", isDark ? "bg-white/10" : "bg-gray-200")} />
          <div className={cn("h-4 w-24 rounded animate-pulse", isDark ? "bg-white/5" : "bg-gray-100")} />
        </div>
      </div>
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
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
            <div className={cn("h-3 w-12 rounded mb-2", isDark ? "bg-white/10" : "bg-gray-200")} />
            <div className={cn("h-6 w-20 rounded", isDark ? "bg-white/10" : "bg-gray-200")} />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div
        className="rounded-xl p-4"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
            : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
          border: isDark
            ? '1px solid rgba(255, 255, 255, 0.08)'
            : '1px solid rgba(203, 213, 225, 0.6)',
        }}
      >
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={cn("h-12 rounded animate-pulse", isDark ? "bg-white/5" : "bg-gray-100")} />
          ))}
        </div>
      </div>
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
          {/* Back Button & Title */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              <Link
                href="/positions/exchanges"
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
                  isDark
                    ? "bg-white/[0.05] hover:bg-white/[0.08] text-white/70"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                )}
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <div className={cn("flex items-center gap-2 text-[11px] mb-1", isDark ? "text-white/30" : "text-gray-500")}>
                  <span>Positions</span>
                  <span>/</span>
                  <span>Exchanges</span>
                  <span>/</span>
                  <span className={isDark ? "text-white/50" : "text-gray-600"}>{data?.exchangeName || 'Loading...'}</span>
                </div>
                <h1 className={cn("text-lg font-semibold flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}>
                  {data?.exchangeName || 'Exchange'} Positions
                  {data?.status === 'connected' && (
                    <CheckCircle2 className="w-4 h-4 text-status-success" />
                  )}
                  {data?.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-status-error" />
                  )}
                </h1>
                <p className={cn("text-[11px] mt-0.5", isDark ? "text-white/30" : "text-gray-500")}>
                  {data?.exchangeLabel || ''} - Last sync: {data?.lastSync || 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refresh()}
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
            </div>
          </div>

          {/* Error State */}
          {error && !USE_MOCK_DATA && (
            <div className={cn("rounded-lg p-4 mb-4 flex items-center gap-3", isDark ? "bg-status-error/10" : "bg-red-50")}>
              <AlertCircle className="w-5 h-5 text-status-error" />
              <div>
                <p className={cn("text-[12px] font-medium", isDark ? "text-white" : "text-gray-900")}>Error loading exchange data</p>
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
          {isLoading && !data && <LoadingSkeleton />}

          {/* Content */}
          {data && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                {[
                  { label: 'Total Value', value: data.totalValueUsd, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
                  { label: 'Spot', value: data.totalSpotUsd, color: 'text-status-success', bg: 'bg-status-success/10' },
                  { label: 'Futures', value: data.totalFuturesUsd, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
                  { label: 'Margin', value: data.totalMarginUsd, color: 'text-accent-orange', bg: 'bg-accent-orange/10' },
                  { label: 'Earn', value: data.totalEarnUsd, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10' },
                  { label: 'Funding', value: data.totalFundingUsd, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
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
                    <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>{card.label}</p>
                    <p className={cn("text-[16px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                      ${card.value >= 1000 ? `${(card.value / 1000).toFixed(1)}K` : card.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div
                className="rounded-xl mb-4 overflow-hidden"
                style={{
                  background: isDark
                    ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
                    : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
                  border: isDark
                    ? '1px solid rgba(255, 255, 255, 0.08)'
                    : '1px solid rgba(203, 213, 225, 0.6)',
                }}
              >
                <div className={cn("flex border-b", isDark ? "border-white/[0.06]" : "border-gray-200")}>
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-3 text-[12px] font-medium transition-colors relative",
                          isActive
                            ? isDark
                              ? "text-white"
                              : "text-gray-900"
                            : isDark
                              ? "text-white/40 hover:text-white/60"
                              : "text-gray-500 hover:text-gray-700"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                        {tab.count > 0 && (
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-medium",
                              isActive
                                ? "bg-accent-purple/20 text-accent-purple"
                                : isDark
                                  ? "bg-white/[0.05] text-white/40"
                                  : "bg-gray-100 text-gray-500"
                            )}
                          >
                            {tab.count}
                          </span>
                        )}
                        {isActive && (
                          <div
                            className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-purple"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tab Content */}
                <div className="p-4">
                  {activeTab === 'futures' && (
                    data.futuresPositions.length > 0 || data.futuresBalances.length > 0 ? (
                      <div className="space-y-5">
                        {data.futuresBalances.length > 0 && (
                          <div className="space-y-2">
                            <p className={cn("text-[11px] font-medium uppercase", isDark ? "text-white/40" : "text-gray-500")}>
                              Account Equity
                            </p>
                            <SpotBalancesTable balances={data.futuresBalances} />
                          </div>
                        )}
                        {data.futuresPositions.length > 0 && (
                          <div className="space-y-2">
                            <p className={cn("text-[11px] font-medium uppercase", isDark ? "text-white/40" : "text-gray-500")}>
                              Open Positions
                            </p>
                            <FuturesPositionsTable positions={data.futuresPositions} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <EmptyTabState
                        isDark={isDark}
                        icon={TrendingUp}
                        title="No Futures Positions"
                        description="You don't have any open futures positions on this exchange."
                      />
                    )
                  )}

                  {activeTab === 'spot' && (
                    data.spotBalances.length > 0 ? (
                      <SpotBalancesTable balances={data.spotBalances} />
                    ) : (
                      <EmptyTabState
                        isDark={isDark}
                        icon={Wallet}
                        title="No Spot Balances"
                        description="You don't have any spot balances on this exchange."
                      />
                    )
                  )}

                  {activeTab === 'margin' && (
                    data.marginBalances.length > 0 ? (
                      <SpotBalancesTable balances={data.marginBalances} />
                    ) : (
                      <EmptyTabState
                        isDark={isDark}
                        icon={BarChart3}
                        title="No Margin Positions"
                        description="You don't have any margin positions on this exchange."
                      />
                    )
                  )}

                  {activeTab === 'earn' && (
                    <EmptyTabState
                      isDark={isDark}
                      icon={PiggyBank}
                      title="No Earn Positions"
                      description="You don't have any earn/staking positions on this exchange."
                    />
                  )}

                  {activeTab === 'funding' && (
                    data.fundingBalances.length > 0 ? (
                      <SpotBalancesTable balances={data.fundingBalances} />
                    ) : (
                      <EmptyTabState
                        isDark={isDark}
                        icon={Layers}
                        title="No Funding Balance"
                        description="You don't have any funding balance on this exchange."
                      />
                    )
                  )}
                </div>
              </div>

              {/* Loan Summary - Show if there are active loans */}
              {data.loanSummary && data.loanSummary.loans.length > 0 && (
                <LoanSummary loanSummary={data.loanSummary} />
              )}

              {/* Sub-accounts Section */}
              {data.subaccounts && data.subaccounts.length > 0 && (
                <SubAccountsSection
                  subaccounts={data.subaccounts}
                  totalValue={data.totalSubaccountsValue}
                  onSubAccountClick={(sub) => setSelectedSubAccount(sub)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Sub-account Detail Modal */}
      <SubAccountDetailModal
        isOpen={!!selectedSubAccount}
        onClose={() => setSelectedSubAccount(null)}
        subaccount={selectedSubAccount}
      />
    </div>
  );
}

// Empty state component for tabs
function EmptyTabState({
  isDark,
  icon: Icon,
  title,
  description,
}: {
  isDark: boolean;
  icon: typeof Wallet;
  title: string;
  description: string;
}) {
  return (
    <div className="py-12 text-center">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3", isDark ? "bg-white/[0.05]" : "bg-gray-100")}>
        <Icon className={cn("w-6 h-6", isDark ? "text-white/30" : "text-gray-400")} />
      </div>
      <h3 className={cn("text-[14px] font-medium mb-1", isDark ? "text-white/70" : "text-gray-700")}>
        {title}
      </h3>
      <p className={cn("text-[11px]", isDark ? "text-white/30" : "text-gray-500")}>
        {description}
      </p>
    </div>
  );
}
