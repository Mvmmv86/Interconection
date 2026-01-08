'use client';

import { Droplets, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

interface LiquidityPosition {
  id: string;
  protocol: string;
  logo: string;
  pair: string;
  chain: string;
  liquidity: number;
  share: number;
  fees24h: number;
  apr: number;
  impermanentLoss: number;
  inRange: boolean;
}

const mockLPPositions: LiquidityPosition[] = [
  {
    id: '1',
    protocol: 'Uniswap V3',
    logo: 'UNI',
    pair: 'ETH/USDC',
    chain: 'Ethereum',
    liquidity: 150000,
    share: 0.012,
    fees24h: 245,
    apr: 18.5,
    impermanentLoss: -2.3,
    inRange: true,
  },
  {
    id: '2',
    protocol: 'Curve',
    logo: 'CRV',
    pair: '3pool',
    chain: 'Ethereum',
    liquidity: 200000,
    share: 0.008,
    fees24h: 156,
    apr: 8.2,
    impermanentLoss: -0.1,
    inRange: true,
  },
  {
    id: '3',
    protocol: 'Balancer',
    logo: 'BAL',
    pair: 'wstETH/ETH',
    chain: 'Ethereum',
    liquidity: 85000,
    share: 0.015,
    fees24h: 98,
    apr: 12.4,
    impermanentLoss: -0.5,
    inRange: true,
  },
  {
    id: '4',
    protocol: 'Raydium',
    logo: 'RAY',
    pair: 'SOL/USDC',
    chain: 'Solana',
    liquidity: 65000,
    share: 0.022,
    fees24h: 189,
    apr: 24.6,
    impermanentLoss: -4.8,
    inRange: false,
  },
  {
    id: '5',
    protocol: 'Aerodrome',
    logo: 'AERO',
    pair: 'ETH/USDC',
    chain: 'Base',
    liquidity: 45000,
    share: 0.031,
    fees24h: 134,
    apr: 32.1,
    impermanentLoss: -1.2,
    inRange: true,
  },
];

export function LiquidityPositions() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const totalLiquidity = mockLPPositions.reduce((sum, p) => sum + p.liquidity, 0);
  const totalFees24h = mockLPPositions.reduce((sum, p) => sum + p.fees24h, 0);
  const avgApr = mockLPPositions.reduce((sum, p) => sum + p.apr, 0) / mockLPPositions.length;

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
          <div className="w-7 h-7 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
            <Droplets className="w-4 h-4 text-accent-cyan" />
          </div>
          <div>
            <h3 className={cn(
              'text-[12px] font-semibold uppercase tracking-wider',
              isDark ? 'text-white' : 'text-gray-900'
            )}>
              Liquidity Pools
            </h3>
            <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>{mockLPPositions.length} positions</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn('text-[14px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
            ${(totalLiquidity / 1000).toFixed(0)}K
          </p>
          <p className="text-[9px] text-status-success">Avg {avgApr.toFixed(1)}% APR</p>
        </div>
      </div>

      {/* Stats */}
      <div className={cn(
        'grid grid-cols-3 gap-2 mb-3 p-2 rounded-lg',
        isDark ? 'bg-white/[0.02]' : 'bg-gray-50'
      )}>
        <div className="text-center">
          <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Fees (24h)</p>
          <p className="text-[11px] font-medium text-status-success tabular-nums">
            +${totalFees24h.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>In Range</p>
          <p className="text-[11px] font-medium text-accent-blue tabular-nums">
            {mockLPPositions.filter((p) => p.inRange).length}/{mockLPPositions.length}
          </p>
        </div>
        <div className="text-center">
          <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>IL Total</p>
          <p className="text-[11px] font-medium text-status-error tabular-nums">
            -${Math.abs(mockLPPositions.reduce((sum, p) => sum + p.impermanentLoss * p.liquidity / 100, 0)).toFixed(0)}
          </p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {mockLPPositions.map((position) => (
          <div
            key={position.id}
            className={cn(
              'p-2.5 rounded-lg transition-colors',
              isDark ? 'bg-white/[0.02] hover:bg-white/[0.03]' : 'bg-gray-50 hover:bg-gray-100'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center text-[8px] font-bold',
                  isDark ? 'bg-white/[0.05] text-white/70' : 'bg-gray-100 text-gray-600'
                )}>
                  {position.logo}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>{position.pair}</p>
                    {!position.inRange && (
                      <AlertTriangle className="w-3 h-3 text-accent-yellow" />
                    )}
                  </div>
                  <div className={cn('flex items-center gap-2 text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                    <span>{position.protocol}</span>
                    <span>•</span>
                    <span>{position.chain}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className={cn('text-[11px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                  ${(position.liquidity / 1000).toFixed(0)}K
                </p>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-[9px] font-medium text-status-success tabular-nums">
                    {position.apr}% APR
                  </span>
                  <span
                    className={cn(
                      'text-[9px] font-medium tabular-nums',
                      position.impermanentLoss >= 0 ? 'text-status-success' : 'text-status-error'
                    )}
                  >
                    {position.impermanentLoss}% IL
                  </span>
                </div>
              </div>
            </div>

            {/* Fees bar */}
            <div className={cn(
              'mt-2 pt-2 border-t',
              isDark ? 'border-white/[0.03]' : 'border-gray-100'
            )}>
              <div className="flex items-center justify-between text-[9px]">
                <span className={isDark ? 'text-white/30' : 'text-gray-500'}>24h fees</span>
                <span className="text-status-success font-medium tabular-nums">+${position.fees24h}</span>
              </div>
            </div>
          </div>
        ))}
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
          + Add LP Position
        </button>
        <button className="text-[10px] text-accent-blue hover:underline">View all →</button>
      </div>
    </div>
  );
}
