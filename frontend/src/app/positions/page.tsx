'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import {
  PositionsSummary,
  PositionsTable,
  PositionsByLocation,
  PositionsDistribution,
  RecentTransactions,
} from '@/components/positions';

export default function PositionsPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d14 20%, #0f1018 40%, #0d0e15 60%, #0a0b10 80%, #08090d 100%)',
      }}
    >
      {/* Futuristic gradient overlays */}
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

      <Sidebar />

      <div className="pl-[200px] transition-all duration-300 relative z-10">
        <Header />

        <main className="p-5">
          {/* Page Title */}
          <div className="mb-5">
            <h1 className="text-lg font-semibold text-text-primary">Positions</h1>
            <p className="text-[11px] text-text-muted mt-0.5">
              Visão consolidada de todas as posições em exchanges, wallets e protocolos DeFi
            </p>
          </div>

          {/* Summary Cards */}
          <PositionsSummary />

          {/* Distribution Charts */}
          <div className="mt-5">
            <PositionsDistribution />
          </div>

          {/* Positions by Location */}
          <div className="mt-5">
            <PositionsByLocation />
          </div>

          {/* Main Table */}
          <div className="mt-5">
            <PositionsTable />
          </div>

          {/* Recent Transactions */}
          <div className="mt-5">
            <RecentTransactions />
          </div>
        </main>
      </div>
    </div>
  );
}
