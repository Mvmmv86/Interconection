'use client';

import { Building2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExchangePosition {
  id: string;
  exchange: string;
  logo: string;
  totalValue: number;
  spotValue: number;
  marginValue: number;
  futuresValue: number;
  pnl24h: number;
  status: 'connected' | 'syncing' | 'error';
  lastSync: string;
}

const mockExchanges: ExchangePosition[] = [
  {
    id: '1',
    exchange: 'Binance',
    logo: 'BN',
    totalValue: 456000,
    spotValue: 350000,
    marginValue: 50000,
    futuresValue: 56000,
    pnl24h: 2.3,
    status: 'connected',
    lastSync: '2 min ago',
  },
  {
    id: '2',
    exchange: 'Coinbase',
    logo: 'CB',
    totalValue: 234000,
    spotValue: 234000,
    marginValue: 0,
    futuresValue: 0,
    pnl24h: 1.8,
    status: 'connected',
    lastSync: '5 min ago',
  },
  {
    id: '3',
    exchange: 'Kraken',
    logo: 'KR',
    totalValue: 89000,
    spotValue: 65000,
    marginValue: 24000,
    futuresValue: 0,
    pnl24h: -0.5,
    status: 'syncing',
    lastSync: 'syncing...',
  },
  {
    id: '4',
    exchange: 'OKX',
    logo: 'OK',
    totalValue: 45000,
    spotValue: 30000,
    marginValue: 0,
    futuresValue: 15000,
    pnl24h: 3.2,
    status: 'connected',
    lastSync: '1 min ago',
  },
];

const statusConfig = {
  connected: { icon: CheckCircle2, color: 'text-status-success', bg: 'bg-status-success/10' },
  syncing: { icon: RefreshCw, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10' },
  error: { icon: AlertCircle, color: 'text-status-error', bg: 'bg-status-error/10' },
};

export function ExchangePositions() {
  const totalExchangeValue = mockExchanges.reduce((sum, e) => sum + e.totalValue, 0);

  return (
    <div
      className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: `
          0 4px 24px rgba(0, 0, 0, 0.3),
          0 1px 2px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.05)
        `,
      }}
    >
      {/* Top shine effect */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06] relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-blue/10 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-accent-blue" />
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">
              Exchange Positions
            </h3>
            <p className="text-[10px] text-text-muted">{mockExchanges.length} connected</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[14px] font-semibold text-text-primary tabular-nums">
            ${(totalExchangeValue / 1000).toFixed(0)}K
          </p>
          <p className="text-[9px] text-text-muted">Total Value</p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {mockExchanges.map((exchange) => {
          const StatusIcon = statusConfig[exchange.status].icon;
          return (
            <div
              key={exchange.id}
              className="p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-[10px] font-bold text-text-secondary">
                    {exchange.logo}
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-text-primary">{exchange.exchange}</p>
                    <div className="flex items-center gap-1">
                      <StatusIcon
                        className={cn(
                          'w-3 h-3',
                          statusConfig[exchange.status].color,
                          exchange.status === 'syncing' && 'animate-spin'
                        )}
                      />
                      <span className="text-[9px] text-text-muted">{exchange.lastSync}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-medium text-text-primary tabular-nums">
                    ${exchange.totalValue.toLocaleString()}
                  </p>
                  <span
                    className={cn(
                      'text-[9px] font-medium tabular-nums',
                      exchange.pnl24h >= 0 ? 'text-status-success' : 'text-status-error'
                    )}
                  >
                    {exchange.pnl24h >= 0 ? '+' : ''}{exchange.pnl24h}% 24h
                  </span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.03]">
                <div>
                  <p className="text-[9px] text-text-muted">Spot</p>
                  <p className="text-[10px] font-medium text-text-secondary tabular-nums">
                    ${(exchange.spotValue / 1000).toFixed(0)}K
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-text-muted">Margin</p>
                  <p className="text-[10px] font-medium text-text-secondary tabular-nums">
                    ${(exchange.marginValue / 1000).toFixed(0)}K
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-text-muted">Futures</p>
                  <p className="text-[10px] font-medium text-text-secondary tabular-nums">
                    ${(exchange.futuresValue / 1000).toFixed(0)}K
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.03]">
        <button className="text-[10px] text-text-muted hover:text-text-secondary">
          + Add Exchange
        </button>
        <button className="text-[10px] text-accent-blue hover:underline">Manage →</button>
      </div>
    </div>
  );
}
