'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExchangeAccount {
  id: string;
  name: string;
  logo: string;
  status: 'connected' | 'syncing' | 'error';
  lastSync: string;
  totalValue: number;
  spotValue: number;
  marginValue: number;
  futuresValue: number;
  pnl24h: number;
  positions: number;
  topAssets: { symbol: string; value: number; change: number }[];
}

const mockExchanges: ExchangeAccount[] = [
  {
    id: '1',
    name: 'Binance',
    logo: 'BN',
    status: 'connected',
    lastSync: '2 min ago',
    totalValue: 456000,
    spotValue: 350000,
    marginValue: 50000,
    futuresValue: 56000,
    pnl24h: 2.3,
    positions: 12,
    topAssets: [
      { symbol: 'BTC', value: 200000, change: 3.2 },
      { symbol: 'ETH', value: 100000, change: 2.8 },
      { symbol: 'UNI', value: 50000, change: -1.2 },
    ],
  },
  {
    id: '2',
    name: 'Coinbase',
    logo: 'CB',
    status: 'connected',
    lastSync: '5 min ago',
    totalValue: 234000,
    spotValue: 234000,
    marginValue: 0,
    futuresValue: 0,
    pnl24h: 1.8,
    positions: 8,
    topAssets: [
      { symbol: 'SOL', value: 120000, change: 4.5 },
      { symbol: 'ETH', value: 80000, change: 2.8 },
      { symbol: 'BTC', value: 34000, change: 3.2 },
    ],
  },
  {
    id: '3',
    name: 'Kraken',
    logo: 'KR',
    status: 'syncing',
    lastSync: 'syncing...',
    totalValue: 140000,
    spotValue: 100000,
    marginValue: 40000,
    futuresValue: 0,
    pnl24h: -0.5,
    positions: 5,
    topAssets: [
      { symbol: 'LINK', value: 60000, change: 5.2 },
      { symbol: 'DOT', value: 50000, change: -2.1 },
      { symbol: 'XRP', value: 30000, change: 1.5 },
    ],
  },
  {
    id: '4',
    name: 'OKX',
    logo: 'OK',
    status: 'connected',
    lastSync: '1 min ago',
    totalValue: 89000,
    spotValue: 50000,
    marginValue: 15000,
    futuresValue: 24000,
    pnl24h: 3.2,
    positions: 6,
    topAssets: [
      { symbol: 'ETH', value: 40000, change: 2.8 },
      { symbol: 'ARB', value: 30000, change: 6.1 },
      { symbol: 'OP', value: 19000, change: 4.3 },
    ],
  },
];

const statusConfig = {
  connected: { icon: CheckCircle2, color: 'text-status-success', bg: 'bg-status-success/10', label: 'Connected' },
  syncing: { icon: RefreshCw, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10', label: 'Syncing' },
  error: { icon: AlertCircle, color: 'text-status-error', bg: 'bg-status-error/10', label: 'Error' },
};

export default function ExchangesPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchTerm, setSearchTerm] = useState('');

  const totalValue = mockExchanges.reduce((sum, e) => sum + e.totalValue, 0);
  const totalSpot = mockExchanges.reduce((sum, e) => sum + e.spotValue, 0);
  const totalMargin = mockExchanges.reduce((sum, e) => sum + e.marginValue, 0);
  const totalFutures = mockExchanges.reduce((sum, e) => sum + e.futuresValue, 0);

  const filteredExchanges = mockExchanges.filter((e) =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase())
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
            <button className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent-purple text-white text-[11px] font-medium hover:bg-accent-purple/90 transition-colors">
              <Plus className="w-4 h-4" />
              Add Exchange
            </button>
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
                  ${(card.value / 1000).toFixed(0)}K
                </p>
              </div>
            ))}
          </div>

          {/* Search */}
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

          {/* Exchange Cards */}
          <div className="space-y-3">
            {filteredExchanges.map((exchange) => {
              const status = statusConfig[exchange.status];
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
                          <span className={cn("text-[10px]", isDark ? "text-white/50" : "text-gray-600")}>{exchange.positions} positions</span>
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
        </main>
      </div>
    </div>
  );
}
