'use client';

import { useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import {
  PortfolioOverview,
  PortfolioChart,
  AssetAllocation,
  RecentActivity,
  PendingAlerts,
  ActiveStrategies,
} from '@/components/dashboard';
import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
import { useAllPositions } from '@/hooks/useAllPositions';
import { usePortfolioRisk } from '@/hooks/usePortfolioRisk';
import { useWalletTransactions } from '@/hooks/useWalletTransactions';
import { useExchangeTransactions } from '@/hooks/useExchangeTransactions';

export default function Home() {
  const { theme } = useTheme();

  // ═══════════════════════════════════════════
  // Real data from all sources
  // ═══════════════════════════════════════════
  const {
    positions,
    summary,
    distributionByType,
    isLoading,
  } = useAllPositions();

  const {
    riskScore,
    isLoading: isLoadingRisk,
  } = usePortfolioRisk(positions, summary);

  const {
    transactions: walletTxs,
    isLoading: isLoadingWalletTx,
  } = useWalletTransactions({ limit: 10 });

  const {
    transactions: exchangeTxs,
    isLoading: isLoadingExchangeTx,
  } = useExchangeTransactions({ limit: 10 });

  // ═══════════════════════════════════════════
  // Derived P&L metrics
  // ═══════════════════════════════════════════
  const derivedMetrics = useMemo(() => {
    const pnlToday = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
    const pnlTodayPercent = summary.totalValue > 0
      ? (pnlToday / summary.totalValue) * 100 : 0;

    // P&L Month: estimate based on daily P&L * 30
    const pnlMonth = pnlToday * 30;
    const pnlMonthPercent = summary.totalValue > 0
      ? (pnlMonth / summary.totalValue) * 100 : 0;

    return { pnlToday, pnlTodayPercent, pnlMonth, pnlMonthPercent };
  }, [positions, summary]);

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        background: theme === 'dark'
          ? 'linear-gradient(135deg, #0a0a0f 0%, #0d0d14 20%, #0f1018 40%, #0d0e15 60%, #0a0b10 80%, #08090d 100%)'
          : '#ffffff',
      }}
    >
      {/* Futuristic gradient overlays - only for dark mode */}
      {theme === 'dark' && (
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

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="pl-[200px] transition-all duration-300 relative z-10">
        {/* Header */}
        <Header />

        {/* Page Content */}
        <main className="p-5">
          {/* Page Title */}
          <div className="mb-5">
            <h1 className={cn(
              'text-lg font-semibold',
              theme === 'dark' ? 'text-text-primary' : 'text-gray-900'
            )}>Dashboard</h1>
            <p className={cn(
              'text-[11px] mt-0.5',
              theme === 'dark' ? 'text-text-muted' : 'text-gray-500'
            )}>Welcome back, John. Here&apos;s your portfolio overview.</p>
          </div>

          {/* Stats Overview */}
          <PortfolioOverview
            totalValue={summary.totalValue}
            pnlToday={derivedMetrics.pnlToday}
            pnlTodayPercent={derivedMetrics.pnlTodayPercent}
            pnlMonth={derivedMetrics.pnlMonth}
            pnlMonthPercent={derivedMetrics.pnlMonthPercent}
            avgApy={summary.avgApy || 0}
            isLoading={isLoading}
          />

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-5">
            <PortfolioChart
              positions={positions}
              totalValue={summary.totalValue}
              isLoading={isLoading}
            />
            <AssetAllocation
              data={distributionByType}
              totalValue={summary.totalValue}
              isLoading={isLoading}
            />
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-5">
            <RecentActivity
              walletTransactions={walletTxs}
              exchangeTransactions={exchangeTxs}
              isLoading={isLoadingWalletTx || isLoadingExchangeTx}
            />
            <PendingAlerts
              alerts={riskScore?.alerts || []}
              isLoading={isLoading || isLoadingRisk}
            />
            <ActiveStrategies />
          </div>
        </main>
      </div>
    </div>
  );
}
