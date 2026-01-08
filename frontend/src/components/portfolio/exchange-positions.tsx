'use client';

import { Building2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const totalExchangeValue = mockExchanges.reduce((sum, e) => sum + e.totalValue, 0);

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
          <div className="w-7 h-7 rounded-lg bg-accent-blue/10 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-accent-blue" />
          </div>
          <div>
            <h3 className={cn(
              'text-[12px] font-semibold uppercase tracking-wider',
              isDark ? 'text-white' : 'text-gray-900'
            )}>
              Exchange Positions
            </h3>
            <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>{mockExchanges.length} connected</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn('text-[14px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
            ${(totalExchangeValue / 1000).toFixed(0)}K
          </p>
          <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Total Value</p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {mockExchanges.map((exchange) => {
          const StatusIcon = statusConfig[exchange.status].icon;
          return (
            <div
              key={exchange.id}
              className={cn(
                'p-3 rounded-lg transition-colors',
                isDark ? 'bg-white/[0.02] hover:bg-white/[0.03]' : 'bg-gray-50 hover:bg-gray-100'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold',
                    isDark ? 'bg-white/[0.05] text-white/70' : 'bg-gray-100 text-gray-600'
                  )}>
                    {exchange.logo}
                  </div>
                  <div>
                    <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>{exchange.exchange}</p>
                    <div className="flex items-center gap-1">
                      <StatusIcon
                        className={cn(
                          'w-3 h-3',
                          statusConfig[exchange.status].color,
                          exchange.status === 'syncing' && 'animate-spin'
                        )}
                      />
                      <span className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>{exchange.lastSync}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn('text-[12px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
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
              <div className={cn(
                'grid grid-cols-3 gap-2 pt-2 border-t',
                isDark ? 'border-white/[0.03]' : 'border-gray-200'
              )}>
                <div>
                  <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Spot</p>
                  <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                    ${(exchange.spotValue / 1000).toFixed(0)}K
                  </p>
                </div>
                <div>
                  <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Margin</p>
                  <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                    ${(exchange.marginValue / 1000).toFixed(0)}K
                  </p>
                </div>
                <div>
                  <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Futures</p>
                  <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                    ${(exchange.futuresValue / 1000).toFixed(0)}K
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
        <button className={cn(
          'text-[10px]',
          isDark ? 'text-white/30 hover:text-white/70' : 'text-gray-500 hover:text-gray-700'
        )}>
          + Add Exchange
        </button>
        <button className="text-[10px] text-accent-blue hover:underline">Manage →</button>
      </div>
    </div>
  );
}
