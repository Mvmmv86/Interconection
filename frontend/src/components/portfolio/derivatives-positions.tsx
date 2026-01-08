'use client';

import { LineChart, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const totalNotional = mockDerivatives.reduce((sum, p) => sum + p.size, 0);
  const totalPnl = mockDerivatives.reduce((sum, p) => sum + p.pnl, 0);
  const totalMargin = mockDerivatives.reduce((sum, p) => sum + p.margin, 0);

  return (
    <div
      className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden"
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
      {/* Top shine effect */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{
          background: isDark
            ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)'
            : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
        }}
      />

      {/* Header */}
      <div className={cn(
        'flex items-center justify-between pb-3 mb-3 border-b relative z-10',
        isDark ? 'border-white/[0.06]' : 'border-gray-200'
      )}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-orange/10 flex items-center justify-center">
            <LineChart className="w-4 h-4 text-accent-orange" />
          </div>
          <div>
            <h3 className={cn(
              'text-[12px] font-semibold uppercase tracking-wider',
              isDark ? 'text-white' : 'text-gray-900'
            )}>
              Derivatives
            </h3>
            <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>{mockDerivatives.length} open positions</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn('text-[14px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
            ${(totalNotional / 1000).toFixed(0)}K
          </p>
          <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Notional Value</p>
        </div>
      </div>

      {/* Stats */}
      <div className={cn(
        'grid grid-cols-3 gap-2 mb-3 p-2 rounded-lg',
        isDark ? 'bg-white/[0.02]' : 'bg-gray-50'
      )}>
        <div className="text-center">
          <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Unrealized P&L</p>
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
          <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Total Margin</p>
          <p className={cn('text-[11px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
            ${(totalMargin / 1000).toFixed(1)}K
          </p>
        </div>
        <div className="text-center">
          <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Avg Leverage</p>
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
              className={cn(
                'p-2.5 rounded-lg transition-colors',
                isDark ? 'bg-white/[0.02] hover:bg-white/[0.03]' : 'bg-gray-50 hover:bg-gray-100'
              )}
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
                      <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>{position.pair}</p>
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
                    <div className={cn('flex items-center gap-2 text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
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
              <div className={cn(
                'grid grid-cols-3 gap-2 pt-2 border-t',
                isDark ? 'border-white/[0.03]' : 'border-gray-100'
              )}>
                <div>
                  <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Entry</p>
                  <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                    ${position.entryPrice.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Mark</p>
                  <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                    ${position.markPrice.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className={cn('text-[9px] flex items-center gap-1', isDark ? 'text-white/30' : 'text-gray-500')}>
                    Liq
                    {distanceToLiq < 20 && <AlertTriangle className="w-2.5 h-2.5 text-accent-yellow" />}
                  </p>
                  <p
                    className={cn(
                      'text-[10px] font-medium tabular-nums',
                      distanceToLiq < 20 ? 'text-accent-yellow' : (isDark ? 'text-white/30' : 'text-gray-500')
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
      <div className={cn(
        'flex items-center justify-between mt-3 pt-3 border-t',
        isDark ? 'border-white/[0.03]' : 'border-gray-100'
      )}>
        <div className="flex items-center gap-1 text-[10px] text-accent-yellow">
          <AlertTriangle className="w-3 h-3" />
          <span>High leverage positions</span>
        </div>
        <button className="text-[10px] text-accent-blue hover:underline">View all →</button>
      </div>
    </div>
  );
}
