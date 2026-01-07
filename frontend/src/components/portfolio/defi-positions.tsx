'use client';

import { Layers, Shield, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeFiPosition {
  id: string;
  protocol: string;
  logo: string;
  type: 'lending' | 'borrowing' | 'yield';
  chain: string;
  supplied: number;
  borrowed: number;
  netValue: number;
  apy: number;
  healthFactor?: number;
  rewards: number;
}

const mockDeFiPositions: DeFiPosition[] = [
  {
    id: '1',
    protocol: 'Aave V3',
    logo: 'AA',
    type: 'lending',
    chain: 'Ethereum',
    supplied: 350000,
    borrowed: 150000,
    netValue: 200000,
    apy: 3.8,
    healthFactor: 1.85,
    rewards: 1200,
  },
  {
    id: '2',
    protocol: 'Compound',
    logo: 'CO',
    type: 'lending',
    chain: 'Ethereum',
    supplied: 180000,
    borrowed: 0,
    netValue: 180000,
    apy: 2.9,
    rewards: 450,
  },
  {
    id: '3',
    protocol: 'MakerDAO',
    logo: 'MK',
    type: 'borrowing',
    chain: 'Ethereum',
    supplied: 250000,
    borrowed: 100000,
    netValue: 150000,
    apy: -4.5,
    healthFactor: 2.1,
    rewards: 0,
  },
  {
    id: '4',
    protocol: 'Morpho',
    logo: 'MO',
    type: 'yield',
    chain: 'Ethereum',
    supplied: 75000,
    borrowed: 0,
    netValue: 75000,
    apy: 5.2,
    rewards: 890,
  },
];

const typeColors = {
  lending: 'bg-accent-blue/10 text-accent-blue',
  borrowing: 'bg-accent-orange/10 text-accent-orange',
  yield: 'bg-status-success/10 text-status-success',
};

export function DeFiPositions() {
  const totalDeFiValue = mockDeFiPositions.reduce((sum, p) => sum + p.netValue, 0);
  const totalRewards = mockDeFiPositions.reduce((sum, p) => sum + p.rewards, 0);

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
          <div className="w-7 h-7 rounded-lg bg-accent-purple/10 flex items-center justify-center">
            <Layers className="w-4 h-4 text-accent-purple" />
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">
              DeFi Positions
            </h3>
            <p className="text-[10px] text-text-muted">{mockDeFiPositions.length} protocols</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[14px] font-semibold text-text-primary tabular-nums">
            ${(totalDeFiValue / 1000).toFixed(0)}K
          </p>
          <p className="text-[9px] text-status-success">+${totalRewards.toLocaleString()} rewards</p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {mockDeFiPositions.map((position) => (
          <div
            key={position.id}
            className="p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-[10px] font-bold text-text-secondary">
                  {position.logo}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-medium text-text-primary">{position.protocol}</p>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[8px] font-medium uppercase',
                        typeColors[position.type]
                      )}
                    >
                      {position.type}
                    </span>
                  </div>
                  <p className="text-[9px] text-text-muted">{position.chain}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-medium text-text-primary tabular-nums">
                  ${position.netValue.toLocaleString()}
                </p>
                <span
                  className={cn(
                    'text-[9px] font-medium tabular-nums',
                    position.apy >= 0 ? 'text-status-success' : 'text-status-error'
                  )}
                >
                  {position.apy >= 0 ? '+' : ''}{position.apy}% APY
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/[0.03]">
              <div>
                <p className="text-[9px] text-text-muted">Supplied</p>
                <p className="text-[10px] font-medium text-text-secondary tabular-nums">
                  ${(position.supplied / 1000).toFixed(0)}K
                </p>
              </div>
              <div>
                <p className="text-[9px] text-text-muted">Borrowed</p>
                <p className="text-[10px] font-medium text-text-secondary tabular-nums">
                  ${(position.borrowed / 1000).toFixed(0)}K
                </p>
              </div>
              <div>
                <p className="text-[9px] text-text-muted">Health</p>
                {position.healthFactor ? (
                  <div className="flex items-center gap-1">
                    {position.healthFactor < 1.5 ? (
                      <AlertTriangle className="w-3 h-3 text-accent-yellow" />
                    ) : (
                      <Shield className="w-3 h-3 text-status-success" />
                    )}
                    <p
                      className={cn(
                        'text-[10px] font-medium tabular-nums',
                        position.healthFactor < 1.5 ? 'text-accent-yellow' : 'text-status-success'
                      )}
                    >
                      {position.healthFactor.toFixed(2)}
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-text-muted">N/A</p>
                )}
              </div>
              <div>
                <p className="text-[9px] text-text-muted">Rewards</p>
                <p className="text-[10px] font-medium text-accent-cyan tabular-nums">
                  ${position.rewards.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.03]">
        <button className="text-[10px] text-text-muted hover:text-text-secondary">
          + Connect Protocol
        </button>
        <button className="text-[10px] text-accent-blue hover:underline">View all →</button>
      </div>
    </div>
  );
}
