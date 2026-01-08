'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
import {
  PortfolioSummary,
  AllocationByType,
  AllocationByChain,
  TopHoldings,
  ExchangePositions,
  DeFiPositions,
  StakingPositions,
  LiquidityPositions,
  DerivativesPositions,
  RiskExposure,
} from '@/components/portfolio';

export default function PortfolioPage() {
  const { theme } = useTheme();

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
          <PortfolioSummary />

          {/* Allocation Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-5">
            <AllocationByType />
            <AllocationByChain />
          </div>

          {/* Risk & Exchange Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-5">
            <RiskExposure />
            <ExchangePositions />
          </div>

          {/* Top Holdings */}
          <div className="mt-5">
            <TopHoldings />
          </div>

          {/* DeFi Positions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-5">
            <DeFiPositions />
            <StakingPositions />
          </div>

          {/* Liquidity & Derivatives */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-5">
            <LiquidityPositions />
            <DerivativesPositions />
          </div>
        </main>
      </div>
    </div>
  );
}
