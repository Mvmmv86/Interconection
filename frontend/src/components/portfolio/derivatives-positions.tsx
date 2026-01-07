'use client';

import { LineChart, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DerivativePosition {
  id: string;
  exchange: string;
  type: 'perpetual' | 'future' | 'option';
  pair: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
  liquidationPrice: number;
  margin: number;
}

const mockDerivatives: DerivativePosition[] = [
  {
    id: '1',
    exchange: 'Binance',
    type: 'perpetual',
    pair: 'BTC/USDT',
    side: 'long',
    size: 50000,
    entryPrice: 100000,
    markPrice: 105000,
    leverage: 5,
    pnl: 2500,
    pnlPercent: 25.0,
    liquidationPrice: 82000,
    margin: 10000,
  },
  {
    id: '2',
    exchange: 'Binance',
    type: 'perpetual',
    pair: 'ETH/USDT',
    side: 'long',
    size: 30000,
    entryPrice: 3800,
    markPrice: 4000,
    leverage: 3,
    pnl: 1578,
    pnlPercent: 15.8,
    liquidationPrice: 2900,
    margin: 10000,
  },
  {
    id: '3',
    exchange: 'OKX',
    type: 'perpetual',
    pair: 'SOL/USDT',
    side: 'short',
    size: 20000,
    entryPrice: 230,
    markPrice: 220,
    leverage: 4,
    pnl: 869,
    pnlPercent: 17.4,
    liquidationPrice: 280,
    margin: 5000,
  },
  {
    id: '4',
    exchange: 'Binance',
    type: 'future',
    pair: 'BTC-MAR26',
    side: 'long',
    size: 25000,
    entryPrice: 102000,
    markPrice: 106500,
    leverage: 2,
    pnl: 1102,
    pnlPercent: 8.8,
    liquidationPrice: 55000,
    margin: 12500,
  },
];

const typeConfig = {
  perpetual: { label: 'PERP', color: 'bg-accent-blue/10 text-accent-blue' },
  future: { label: 'FUT', color: 'bg-accent-purple/10 text-accent-purple' },
  option: { label: 'OPT', color: 'bg-accent-orange/10 text-accent-orange' },
};

export function DerivativesPositions() {
  const totalNotional = mockDerivatives.reduce((sum, p) => sum + p.size, 0);
  const totalPnl = mockDerivatives.reduce((sum, p) => sum + p.pnl, 0);
  const totalMargin = mockDerivatives.reduce((sum, p) => sum + p.margin, 0);

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
          <div className="w-7 h-7 rounded-lg bg-accent-orange/10 flex items-center justify-center">
            <LineChart className="w-4 h-4 text-accent-orange" />
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">
              Derivatives
            </h3>
            <p className="text-[10px] text-text-muted">{mockDerivatives.length} open positions</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[14px] font-semibold text-text-primary tabular-nums">
            ${(totalNotional / 1000).toFixed(0)}K
          </p>
          <p className="text-[9px] text-text-muted">Notional Value</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3 p-2 rounded-lg bg-white/[0.02]">
        <div className="text-center">
          <p className="text-[9px] text-text-muted">Unrealized P&L</p>
          <p
            className={cn(
              'text-[11px] font-medium tabular-nums',
              totalPnl >= 0 ? 'text-status-success' : 'text-status-error'
            )}
          >
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-text-muted">Total Margin</p>
          <p className="text-[11px] font-medium text-text-primary tabular-nums">
            ${(totalMargin / 1000).toFixed(1)}K
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-text-muted">Avg Leverage</p>
          <p className="text-[11px] font-medium text-accent-yellow tabular-nums">
            {(mockDerivatives.reduce((sum, p) => sum + p.leverage, 0) / mockDerivatives.length).toFixed(1)}x
          </p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {mockDerivatives.map((position) => {
          const isProfit = position.pnl >= 0;
          const distanceToLiq = position.side === 'long'
            ? ((position.markPrice - position.liquidationPrice) / position.markPrice) * 100
            : ((position.liquidationPrice - position.markPrice) / position.markPrice) * 100;

          return (
            <div
              key={position.id}
              className="p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center',
                      position.side === 'long' ? 'bg-status-success/10' : 'bg-status-error/10'
                    )}
                  >
                    {position.side === 'long' ? (
                      <TrendingUp className="w-4 h-4 text-status-success" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-status-error" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-medium text-text-primary">{position.pair}</p>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[8px] font-medium',
                          typeConfig[position.type].color
                        )}
                      >
                        {typeConfig[position.type].label}
                      </span>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[8px] font-medium uppercase',
                          position.side === 'long'
                            ? 'bg-status-success/10 text-status-success'
                            : 'bg-status-error/10 text-status-error'
                        )}
                      >
                        {position.side}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-text-muted">
                      <span>{position.exchange}</span>
                      <span>•</span>
                      <span>{position.leverage}x</span>
                      <span>•</span>
                      <span>${(position.size / 1000).toFixed(0)}K</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      'text-[12px] font-medium tabular-nums',
                      isProfit ? 'text-status-success' : 'text-status-error'
                    )}
                  >
                    {isProfit ? '+' : ''}${position.pnl.toLocaleString()}
                  </p>
                  <span
                    className={cn(
                      'text-[9px] font-medium tabular-nums',
                      isProfit ? 'text-status-success' : 'text-status-error'
                    )}
                  >
                    {isProfit ? '+' : ''}{position.pnlPercent.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Price & Liquidation */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.03]">
                <div>
                  <p className="text-[9px] text-text-muted">Entry</p>
                  <p className="text-[10px] font-medium text-text-secondary tabular-nums">
                    ${position.entryPrice.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-text-muted">Mark</p>
                  <p className="text-[10px] font-medium text-text-primary tabular-nums">
                    ${position.markPrice.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-text-muted flex items-center gap-1">
                    Liq
                    {distanceToLiq < 20 && <AlertTriangle className="w-2.5 h-2.5 text-accent-yellow" />}
                  </p>
                  <p
                    className={cn(
                      'text-[10px] font-medium tabular-nums',
                      distanceToLiq < 20 ? 'text-accent-yellow' : 'text-text-muted'
                    )}
                  >
                    ${position.liquidationPrice.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.03]">
        <div className="flex items-center gap-1 text-[10px] text-accent-yellow">
          <AlertTriangle className="w-3 h-3" />
          <span>High leverage positions</span>
        </div>
        <button className="text-[10px] text-accent-blue hover:underline">View all →</button>
      </div>
    </div>
  );
}
