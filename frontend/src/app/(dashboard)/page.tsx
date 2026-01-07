'use client';

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

export default function DashboardPage() {
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
      <PortfolioOverview />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <PortfolioChart />
        <AssetAllocation />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <RecentActivity />
        <PendingAlerts />
        <ActiveStrategies />
      </div>
    </PageContainer>
  );
}
