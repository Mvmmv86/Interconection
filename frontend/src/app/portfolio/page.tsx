'use client';

import { useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
import { useAllPositions } from '@/hooks/useAllPositions';
import { useMultiWalletDeFiPositions } from '@/hooks/defi';
import { usePortfolioRisk } from '@/hooks/usePortfolioRisk';
import {
  PortfolioSummary,
  AllocationByType,
  AllocationByChain,
  TopHoldings,
  ExchangePositions,
  DeFiPositions,
  LiquidityPositions,
  DerivativesPositions,
  RiskExposure,
} from '@/components/portfolio';

// Lazy load modais pesados - só carregam quando abertos
const RiskSettingsModal = dynamic(
  () => import('@/components/portfolio/risk-settings-modal').then(m => ({ default: m.RiskSettingsModal })),
  { ssr: false }
);
const RiskReportModal = dynamic(
  () => import('@/components/portfolio/risk-report-modal').then(m => ({ default: m.RiskReportModal })),
  { ssr: false }
);

export default function PortfolioPage() {
  const { theme } = useTheme();

  // ═══════════════════════════════════════════
  // Real data from all sources
  // ═══════════════════════════════════════════
  const {
    positions,
    summary,
    distributionByType,
    distributionByChain,
    exchanges,
    isLoading,
    isLoadingExchanges,
  } = useAllPositions();

  // Raw DeFi positions for DeFi & LP cards (React Query caches, no double fetch)
  const {
    positions: rawDefiPositions,
    isLoading: isLoadingDefiRaw,
  } = useMultiWalletDeFiPositions();

  // ═══════════════════════════════════════════
  // Risk metrics from real calculations
  // ═══════════════════════════════════════════
  const {
    metrics: riskMetrics,
    riskScore,
    thresholds: riskThresholds,
    updateThresholds,
    resetThresholds,
    isLoading: isLoadingRisk,
    hasData: hasRiskData,
    hasPriceHistory,
  } = usePortfolioRisk(positions, summary);

  const [isRiskSettingsOpen, setIsRiskSettingsOpen] = useState(false);

  // ═══════════════════════════════════════════
  // Report modal state
  // ═══════════════════════════════════════════
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [reportGeneratedAt, setReportGeneratedAt] = useState('');
  const [reportSummary, setReportSummary] = useState<{
    totalAum: number;
    positionCount: number;
    riskStatus: string;
    riskScoreValue: number;
  } | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const handleGenerateReport = useCallback(async () => {
    setIsReportModalOpen(true);
    setIsGeneratingReport(true);
    setReportContent('');

    try {
      const context = {
        summary,
        topPositions: positions.slice(0, 10),
        riskMetrics,
        riskScore,
        distributionByType,
        distributionByChain,
      };

      const response = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar relatório');
      }

      const data = await response.json();
      setReportContent(data.content || '');
      setReportGeneratedAt(data.generatedAt || new Date().toISOString());
      setReportSummary(data.summary || null);
    } catch (error) {
      console.error('Report generation error:', error);
      setReportContent('Erro ao gerar o relatório. Tente novamente.');
    } finally {
      setIsGeneratingReport(false);
    }
  }, [summary, positions, riskMetrics, riskScore, distributionByType, distributionByChain]);

  // ═══════════════════════════════════════════
  // Spot positions for Top Holdings
  // ═══════════════════════════════════════════
  const spotPositions = useMemo(() => {
    return positions.filter(p => p.category === 'spot');
  }, [positions]);

  const totalSpotValue = useMemo(() => {
    return spotPositions.reduce((sum, p) => sum + p.value, 0);
  }, [spotPositions]);

  // ═══════════════════════════════════════════
  // Derived metrics for summary cards
  // ═══════════════════════════════════════════
  const derivedMetrics = useMemo(() => {
    // Unrealized P&L: sum of all 24h changes across positions
    const unrealizedPnl = positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
    const unrealizedPnlPercent = summary.totalValue > 0
      ? (unrealizedPnl / summary.totalValue) * 100
      : 0;

    // 24h AUM change percentage
    const aumChange24h = unrealizedPnlPercent;

    // Yield earnings: projected annual yield from positions with APY
    const yieldEarnings = positions.reduce((sum, p) => {
      if (p.apy && p.apy > 0) {
        return sum + (p.value * p.apy) / 100;
      }
      return sum;
    }, 0);

    // Weighted average APY
    const avgApy = summary.avgApy || 0;

    return {
      unrealizedPnl,
      unrealizedPnlPercent,
      aumChange24h,
      yieldEarnings,
      avgApy,
    };
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

      <Sidebar />

      <div className="pl-[200px] transition-all duration-300 relative z-10">
        <Header />

        <main className="p-5">
          {/* Page Title */}
          <div className="mb-5">
            <h1 className={cn(
              'text-lg font-semibold',
              theme === 'dark' ? 'text-text-primary' : 'text-slate-900'
            )}>Portfolio</h1>
            <p className={cn(
              'text-[11px] mt-0.5',
              theme === 'dark' ? 'text-text-muted' : 'text-slate-500'
            )}>
              Visão consolidada de todos os ativos e posições
            </p>
          </div>

          {/* Summary Cards */}
          <PortfolioSummary
            totalAum={summary.totalValue}
            aumChange24h={derivedMetrics.aumChange24h}
            unrealizedPnl={derivedMetrics.unrealizedPnl}
            unrealizedPnlPercent={derivedMetrics.unrealizedPnlPercent}
            realizedPnl={null}
            yieldEarnings={derivedMetrics.yieldEarnings}
            avgApy={derivedMetrics.avgApy}
            activePositions={summary.totalPositionCount}
            isLoading={isLoading}
          />

          {/* Allocation Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-5">
            <AllocationByType
              data={distributionByType}
              totalValue={summary.totalValue}
              isLoading={isLoading}
            />
            <AllocationByChain
              data={distributionByChain}
              totalValue={summary.totalValue}
              isLoading={isLoading}
            />
          </div>

          {/* Risk & Exchange Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-5">
            <RiskExposure
              metrics={riskMetrics}
              riskScore={riskScore}
              thresholds={riskThresholds}
              isLoading={isLoading || isLoadingRisk}
              hasData={hasRiskData}
              hasPriceHistory={hasPriceHistory}
              onOpenSettings={() => setIsRiskSettingsOpen(true)}
              onGenerateReport={handleGenerateReport}
            />
            <ExchangePositions
              exchanges={exchanges}
              totalValue={summary.exchangeHoldings}
              isLoading={isLoadingExchanges}
            />
          </div>

          {/* Risk Settings Modal - lazy loaded, only mounts when open */}
          {isRiskSettingsOpen && (
            <RiskSettingsModal
              isOpen={isRiskSettingsOpen}
              onClose={() => setIsRiskSettingsOpen(false)}
              thresholds={riskThresholds}
              onSave={updateThresholds}
              onReset={resetThresholds}
            />
          )}

          {/* Risk Report Modal - lazy loaded, only mounts when open */}
          {isReportModalOpen && (
            <RiskReportModal
              isOpen={isReportModalOpen}
              onClose={() => setIsReportModalOpen(false)}
              reportContent={reportContent}
              generatedAt={reportGeneratedAt}
              summary={reportSummary}
              isLoading={isGeneratingReport}
            />
          )}

          {/* Top Holdings (Spot Only) */}
          <div className="mt-5">
            <TopHoldings
              positions={spotPositions}
              totalSpotValue={totalSpotValue}
              isLoading={isLoading}
            />
          </div>

          {/* DeFi & Liquidity Pools */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-5">
            <DeFiPositions
              positions={rawDefiPositions}
              isLoading={isLoadingDefiRaw}
            />
            <LiquidityPositions
              positions={rawDefiPositions}
              isLoading={isLoadingDefiRaw}
            />
          </div>

          {/* Derivatives */}
          <div className="mt-5">
            <DerivativesPositions />
          </div>
        </main>
      </div>
    </div>
  );
}
