'use client';

import { Droplets, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const totalLiquidity = mockLPPositions.reduce((sum, p) => sum + p.liquidity, 0);
  const totalFees24h = mockLPPositions.reduce((sum, p) => sum + p.fees24h, 0);
  const avgApr = mockLPPositions.reduce((sum, p) => sum + p.apr, 0) / mockLPPositions.length;

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
          <div className="w-7 h-7 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
            <Droplets className="w-4 h-4 text-accent-cyan" />
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">
              Liquidity Pools
            </h3>
            <p className="text-[10px] text-text-muted">{mockLPPositions.length} positions</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[14px] font-semibold text-text-primary tabular-nums">
            ${(totalLiquidity / 1000).toFixed(0)}K
          </p>
          <p className="text-[9px] text-status-success">Avg {avgApr.toFixed(1)}% APR</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3 p-2 rounded-lg bg-white/[0.02]">
        <div className="text-center">
          <p className="text-[9px] text-text-muted">Fees (24h)</p>
          <p className="text-[11px] font-medium text-status-success tabular-nums">
            +${totalFees24h.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-text-muted">In Range</p>
          <p className="text-[11px] font-medium text-accent-blue tabular-nums">
            {mockLPPositions.filter((p) => p.inRange).length}/{mockLPPositions.length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-text-muted">IL Total</p>
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
            className="p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center text-[8px] font-bold text-text-secondary">
                  {position.logo}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-medium text-text-primary">{position.pair}</p>
                    {!position.inRange && (
                      <AlertTriangle className="w-3 h-3 text-accent-yellow" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-text-muted">
                    <span>{position.protocol}</span>
                    <span>•</span>
                    <span>{position.chain}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium text-text-primary tabular-nums">
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
            <div className="mt-2 pt-2 border-t border-white/[0.03]">
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-text-muted">24h fees</span>
                <span className="text-status-success font-medium tabular-nums">+${position.fees24h}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.03]">
        <button className="text-[10px] text-text-muted hover:text-text-secondary">
          + Add LP Position
        </button>
        <button className="text-[10px] text-accent-blue hover:underline">View all →</button>
      </div>
    </div>
  );
}
