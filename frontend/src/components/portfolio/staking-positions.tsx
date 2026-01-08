'use client';

import { Coins, Clock, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

interface StakingPosition {
  id: string;
  protocol: string;
  logo: string;
  asset: string;
  stakedAmount: number;
  stakedValue: number;
  rewards: number;
  apy: number;
  lockPeriod: string;
  unlockDate?: string;
  status: 'active' | 'unlocking' | 'claimable';
}

const mockStakingPositions: StakingPosition[] = [
  {
    id: '1',
    protocol: 'Lido',
    logo: 'LD',
    asset: 'stETH',
    stakedAmount: 50,
    stakedValue: 200000,
    rewards: 4200,
    apy: 4.2,
    lockPeriod: 'Liquid',
    status: 'active',
  },
  {
    id: '2',
    protocol: 'Rocket Pool',
    logo: 'RP',
    asset: 'rETH',
    stakedAmount: 25,
    stakedValue: 100000,
    rewards: 2100,
    apy: 4.5,
    lockPeriod: 'Liquid',
    status: 'active',
  },
  {
    id: '3',
    protocol: 'Eigenlayer',
    logo: 'EL',
    asset: 'ETH',
    stakedAmount: 20,
    stakedValue: 80000,
    rewards: 1500,
    apy: 6.8,
    lockPeriod: '7 days',
    unlockDate: 'Jan 15, 2026',
    status: 'unlocking',
  },
  {
    id: '4',
    protocol: 'Marinade',
    logo: 'MN',
    asset: 'mSOL',
    stakedAmount: 500,
    stakedValue: 110000,
    rewards: 3200,
    apy: 7.2,
    lockPeriod: 'Liquid',
    status: 'active',
  },
  {
    id: '5',
    protocol: 'Jito',
    logo: 'JT',
    asset: 'jitoSOL',
    stakedAmount: 300,
    stakedValue: 66000,
    rewards: 2800,
    apy: 8.1,
    lockPeriod: 'Liquid',
    status: 'claimable',
  },
];

const statusConfig = {
  active: { label: 'Active', color: 'bg-status-success/10 text-status-success' },
  unlocking: { label: 'Unlocking', color: 'bg-accent-yellow/10 text-accent-yellow' },
  claimable: { label: 'Claimable', color: 'bg-accent-cyan/10 text-accent-cyan' },
};

export function StakingPositions() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const totalStaked = mockStakingPositions.reduce((sum, p) => sum + p.stakedValue, 0);
  const totalRewards = mockStakingPositions.reduce((sum, p) => sum + p.rewards, 0);
  const avgApy = mockStakingPositions.reduce((sum, p) => sum + p.apy, 0) / mockStakingPositions.length;

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
          <div className="w-7 h-7 rounded-lg bg-status-success/10 flex items-center justify-center">
            <Coins className="w-4 h-4 text-status-success" />
          </div>
          <div>
            <h3 className={cn(
              'text-[12px] font-semibold uppercase tracking-wider',
              isDark ? 'text-white' : 'text-gray-900'
            )}>
              Staking Positions
            </h3>
            <p className={cn('text-[10px]', isDark ? 'text-white/30' : 'text-gray-500')}>{mockStakingPositions.length} validators</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn('text-[14px] font-semibold tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
            ${(totalStaked / 1000).toFixed(0)}K
          </p>
          <p className="text-[9px] text-status-success">Avg {avgApy.toFixed(1)}% APY</p>
        </div>
      </div>

      {/* Stats */}
      <div className={cn(
        'grid grid-cols-3 gap-2 mb-3 p-2 rounded-lg',
        isDark ? 'bg-white/[0.02]' : 'bg-gray-50'
      )}>
        <div className="text-center">
          <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Total Rewards</p>
          <p className="text-[11px] font-medium text-accent-cyan tabular-nums">
            ${totalRewards.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Liquid Staked</p>
          <p className="text-[11px] font-medium text-status-success tabular-nums">78%</p>
        </div>
        <div className="text-center">
          <p className={cn('text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>Claimable</p>
          <p className="text-[11px] font-medium text-accent-purple tabular-nums">
            ${(2800).toLocaleString()}
          </p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {mockStakingPositions.map((position) => (
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
                  'w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold',
                  isDark ? 'bg-white/[0.05] text-white/70' : 'bg-gray-100 text-gray-600'
                )}>
                  {position.logo}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className={cn('text-[11px] font-medium', isDark ? 'text-white' : 'text-gray-900')}>{position.protocol}</p>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[8px] font-medium',
                        statusConfig[position.status].color
                      )}
                    >
                      {statusConfig[position.status].label}
                    </span>
                  </div>
                  <div className={cn('flex items-center gap-2 text-[9px]', isDark ? 'text-white/30' : 'text-gray-500')}>
                    <span>{position.stakedAmount} {position.asset}</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {position.lockPeriod}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className={cn('text-[11px] font-medium tabular-nums', isDark ? 'text-white' : 'text-gray-900')}>
                  ${(position.stakedValue / 1000).toFixed(0)}K
                </p>
                <div className="flex items-center justify-end gap-1">
                  <Zap className="w-2.5 h-2.5 text-status-success" />
                  <span className="text-[9px] font-medium text-status-success tabular-nums">
                    {position.apy}% APY
                  </span>
                </div>
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
        <button className="flex items-center gap-1 text-[10px] text-accent-cyan hover:underline">
          <TrendingUp className="w-3 h-3" />
          Claim all rewards
        </button>
        <button className="text-[10px] text-accent-blue hover:underline">View all →</button>
      </div>
    </div>
  );
}
