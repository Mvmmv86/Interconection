'use client';

import Link from 'next/link';
import { Building2, RefreshCw, AlertCircle, CheckCircle2, Loader2, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { ExchangeData } from '@/types/positions';

export interface ExchangePositionsProps {
  exchanges: ExchangeData[];
  totalValue: number;
  isLoading: boolean;
}

const statusConfig = {
  connected: { icon: CheckCircle2, color: 'text-status-success', bg: 'bg-status-success/10' },
  syncing: { icon: RefreshCw, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10' },
  error: { icon: AlertCircle, color: 'text-status-error', bg: 'bg-status-error/10' },
  disconnected: { icon: Wifi, color: 'text-white/20', bg: 'bg-white/5' },
};

function formatValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function ExchangePositions({ exchanges, totalValue, isLoading }: ExchangePositionsProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const cardStyle = {
    background: isDark
      ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
      : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
    border: isDark
      ? '1px solid rgba(255, 255, 255, 0.08)'
      : '1px solid rgba(203, 213, 225, 0.6)',
    boxShadow: isDark
      ? '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
  };

  // Loading state
  if (isLoading && exchanges.length === 0) {
    return (
      <div className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden flex items-center justify-center h-[460px]" style={cardStyle}>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-white/20' : 'text-gray-300')} />
          <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-400')}>
            Carregando exchanges...
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (exchanges.length === 0) {
    return (
      <div className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden flex flex-col items-center justify-center h-[460px]" style={cardStyle}>
        <Building2 className={cn('w-8 h-8 mb-2', isDark ? 'text-white/10' : 'text-gray-200')} />
        <p className={cn('text-xs', isDark ? 'text-white/30' : 'text-gray-400')}>
          Nenhuma exchange conectada
        </p>
        <p className={cn('text-[10px] mt-1', isDark ? 'text-white/20' : 'text-gray-300')}>
          Conecte uma exchange para visualizar seus saldos
        </p>
        <Link
          href="/positions/exchanges"
          className="mt-3 text-[10px] text-accent-blue hover:underline"
        >
          + Adicionar Exchange
        </Link>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-sm rounded-xl p-4 relative overflow-hidden" style={cardStyle}>
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
            <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>
              {exchanges.length} connected
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn('text-[14px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
            {formatValue(totalValue)}
          </p>
          <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Total Value</p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {exchanges.map((exchange) => {
          const statusKey = exchange.status in statusConfig ? exchange.status : 'disconnected';
          const StatusIcon = statusConfig[statusKey].icon;

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
                    <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                      {exchange.name}
                    </p>
                    <div className="flex items-center gap-1">
                      <StatusIcon
                        className={cn(
                          'w-3 h-3',
                          statusConfig[statusKey].color,
                          statusKey === 'syncing' && 'animate-spin'
                        )}
                      />
                      <span className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                        {exchange.lastSync || 'never'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn('text-[12px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                    ${exchange.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  {exchange.hasSubaccounts && exchange.subaccountsCount && exchange.subaccountsCount > 0 && (
                    <span className={cn('text-[8px]', isDark ? 'text-accent-blue/60' : 'text-blue-400')}>
                      +{exchange.subaccountsCount} sub-account{exchange.subaccountsCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Breakdown */}
              <div className={cn(
                'grid gap-2 pt-2 border-t',
                isDark ? 'border-white/[0.03]' : 'border-gray-200',
                // Adjust grid cols based on available data
                (exchange.fundingValue && exchange.fundingValue > 0) || (exchange.earnValue && exchange.earnValue > 0)
                  ? 'grid-cols-4'
                  : 'grid-cols-3'
              )}>
                <div>
                  <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Spot</p>
                  <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                    {formatValue(exchange.spotValue)}
                  </p>
                </div>
                <div>
                  <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Margin</p>
                  <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                    {formatValue(exchange.marginValue)}
                  </p>
                </div>
                <div>
                  <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Futures</p>
                  <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                    {formatValue(exchange.futuresValue)}
                  </p>
                </div>
                {exchange.earnValue != null && exchange.earnValue > 0 && (
                  <div>
                    <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Earn</p>
                    <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                      {formatValue(exchange.earnValue)}
                    </p>
                  </div>
                )}
                {exchange.fundingValue != null && exchange.fundingValue > 0 && !exchange.earnValue && (
                  <div>
                    <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Funding</p>
                    <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                      {formatValue(exchange.fundingValue)}
                    </p>
                  </div>
                )}
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
        <Link
          href="/positions/exchanges"
          className={cn(
            'text-[10px]',
            isDark ? 'text-white/30 hover:text-white/70' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          + Add Exchange
        </Link>
        <Link href="/positions/exchanges" className="text-[10px] text-accent-blue hover:underline">
          Manage →
        </Link>
      </div>
    </div>
  );
}
