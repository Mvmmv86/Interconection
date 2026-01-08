'use client';

import { Layers, Shield, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const totalDeFiValue = mockDeFiPositions.reduce((sum, p) => sum + p.netValue, 0);
  const totalRewards = mockDeFiPositions.reduce((sum, p) => sum + p.rewards, 0);

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
          <div className="w-7 h-7 rounded-lg bg-accent-purple/10 flex items-center justify-center">
            <Layers className="w-4 h-4 text-accent-purple" />
          </div>
          <div>
            <h3 className={cn(
              'text-[12px] font-semibold uppercase tracking-wider',
              isDark ? 'text-white' : 'text-gray-900'
            )}>
              DeFi Positions
            </h3>
            <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>{mockDeFiPositions.length} protocols</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn('text-[14px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
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
                  {position.logo}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>{position.protocol}</p>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[8px] font-medium uppercase',
                        typeColors[position.type]
                      )}
                    >
                      {position.type}
                    </span>
                  </div>
                  <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>{position.chain}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn('text-[12px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
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
            <div className={cn(
              'grid grid-cols-4 gap-2 pt-2 border-t',
              isDark ? 'border-white/[0.03]' : 'border-gray-200'
            )}>
              <div>
                <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Supplied</p>
                <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                  ${(position.supplied / 1000).toFixed(0)}K
                </p>
              </div>
              <div>
                <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Borrowed</p>
                <p className={cn('text-[10px] font-medium tabular-nums', isDark ? 'text-white/70' : 'text-gray-700')}>
                  ${(position.borrowed / 1000).toFixed(0)}K
                </p>
              </div>
              <div>
                <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Health</p>
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
                  <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>N/A</p>
                )}
              </div>
              <div>
                <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Rewards</p>
                <p className="text-[10px] font-medium text-accent-cyan tabular-nums">
                  ${position.rewards.toLocaleString()}
                </p>
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
          + Connect Protocol
        </button>
        <button className="text-[10px] text-accent-blue hover:underline">View all →</button>
      </div>
    </div>
  );
}
