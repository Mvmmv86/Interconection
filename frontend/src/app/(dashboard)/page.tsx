'use client';

import { useMemo } from 'react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download } from 'lucide-react';
import {
  PortfolioOverview,
  PortfolioChart,
  AssetAllocation,
  RecentActivity,
  PendingAlerts,
  ActiveStrategies,
} from '@/components/dashboard';
import { useAllPositions } from '@/hooks/useAllPositions';
import { usePortfolioRisk } from '@/hooks/usePortfolioRisk';
import { useWalletTransactions } from '@/hooks/useWalletTransactions';
import { useExchangeTransactions } from '@/hooks/useExchangeTransactions';

export default function DashboardPage() {
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

  const derivedMetrics = useMemo(() => {
    const pnlToday = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
    const pnlTodayPercent = summary.totalValue > 0
      ? (pnlToday / summary.totalValue) * 100 : 0;
    const pnlMonth = pnlToday * 30;
    const pnlMonthPercent = summary.totalValue > 0
      ? (pnlMonth / summary.totalValue) * 100 : 0;
    return { pnlToday, pnlTodayPercent, pnlMonth, pnlMonthPercent };
  }, [positions, summary]);

  return (
    <PageContainer>
      {/* Header */}
      <PageHeader
        title="Dashboard"
        description="Welcome back, John. Here's your portfolio overview."
        actions={
          <>
            <Button variant="secondary" size="sm">
              <RefreshCw className="w-4 h-4" />
              Sync All
            </Button>
            <Button variant="secondary" size="sm">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </>
        }
      />

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
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
    </PageContainer>
  );
}
