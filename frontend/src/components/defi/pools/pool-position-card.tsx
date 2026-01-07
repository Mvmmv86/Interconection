'use client';

import { useState } from 'react';
import {
  Settings,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Droplets,
  Zap,
  RefreshCw,
  LogOut,
  Gift,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PoolPosition, PROTOCOL_CONFIG, CHAIN_CONFIG } from './types';

interface PoolPositionCardProps {
  position: PoolPosition;
  onManage?: (position: PoolPosition) => void;
  onCollectFees?: (position: PoolPosition) => void;
  onRemoveLiquidity?: (position: PoolPosition) => void;
}

export function PoolPositionCard({
  position,
  onManage,
  onCollectFees,
  onRemoveLiquidity,
}: PoolPositionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const protocol = PROTOCOL_CONFIG[position.protocol];
  const chain = CHAIN_CONFIG[position.chain];

  const rangeWidth = position.priceUpper - position.priceLower;
  const currentInRange =
    position.currentPrice >= position.priceLower &&
    position.currentPrice <= position.priceUpper;

  // Calculate position in range visually
  const rangePosition = Math.max(
    0,
    Math.min(
      100,
      ((position.currentPrice - position.priceLower) / rangeWidth) * 100
    )
  );

  const formatNumber = (num: number, decimals = 2) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(decimals)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(decimals)}K`;
    return `$${num.toFixed(decimals)}`;
  };

  return (
    <div
      className="backdrop-blur-md rounded-xl border border-white/[0.06] overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)',
        boxShadow:
          '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      }}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Token Pair Icons */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] font-bold text-text-primary border border-white/[0.1]">
                {position.token0.symbol}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white/[0.08] flex items-center justify-center text-[8px] font-bold text-text-secondary border border-white/[0.1]">
                {position.token1.symbol.slice(0, 3)}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold text-text-primary">
                  {position.token0.symbol}/{position.token1.symbol}
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/[0.05] text-text-secondary">
                  {position.feeTier}%
                </span>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[9px] font-medium',
                    currentInRange
                      ? 'bg-status-success/10 text-status-success'
                      : 'bg-status-error/10 text-status-error'
                  )}
                >
                  {currentInRange ? 'In Range' : 'Out of Range'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[8px] font-medium uppercase',
                    position.networkType === 'solana'
                      ? 'bg-[#9945ff]/15 text-[#9945ff]'
                      : 'bg-[#627eea]/15 text-[#627eea]'
                  )}
                >
                  {position.networkType === 'solana' ? 'SOL' : 'EVM'}
                </span>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: chain.color }}
                />
                <span className="text-[10px] text-text-muted">{chain.name}</span>
                <span className="text-[10px] text-text-muted">·</span>
                <span className="text-[10px] text-text-secondary">{protocol.name}</span>
                {position.nftId && (
                  <>
                    <span className="text-[10px] text-text-muted">·</span>
                    <span className="text-[10px] text-text-muted">#{position.nftId}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[18px] font-semibold text-text-primary tabular-nums">
              {formatNumber(position.totalValueUsd)}
            </p>
            <div className="flex items-center justify-end gap-1.5">
              <span
                className={cn(
                  'text-[11px] font-medium tabular-nums',
                  position.pnlPercent >= 0 ? 'text-status-success' : 'text-status-error'
                )}
              >
                {position.pnlPercent >= 0 ? '+' : ''}
                {position.pnlPercent.toFixed(2)}%
              </span>
              <span className="text-[10px] text-text-muted">
                ({position.pnlUsd >= 0 ? '+' : ''}
                {formatNumber(position.pnlUsd)})
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="p-2 rounded-lg bg-white/[0.02]">
            <p className="text-[9px] text-text-muted uppercase tracking-wider">APR</p>
            <p className="text-[13px] font-semibold text-status-success tabular-nums">
              {position.totalApr.toFixed(1)}%
            </p>
          </div>
          <div className="p-2 rounded-lg bg-white/[0.02]">
            <p className="text-[9px] text-text-muted uppercase tracking-wider">Fees Earned</p>
            <p className="text-[13px] font-semibold text-text-primary tabular-nums">
              {formatNumber(position.feesEarned.totalUsd)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-white/[0.02]">
            <p className="text-[9px] text-text-muted uppercase tracking-wider">IL</p>
            <p
              className={cn(
                'text-[13px] font-semibold tabular-nums',
                position.impermanentLoss < 0 ? 'text-status-error' : 'text-status-success'
              )}
            >
              {position.impermanentLoss.toFixed(2)}%
            </p>
          </div>
          <div className="p-2 rounded-lg bg-white/[0.02]">
            <p className="text-[9px] text-text-muted uppercase tracking-wider">In Range</p>
            <p className="text-[13px] font-semibold text-text-primary tabular-nums">
              {position.inRangePercent.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Price Range Visualization */}
        <div className="mt-3 p-3 rounded-lg bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] text-text-muted uppercase tracking-wider">Price Range</span>
            <span className="text-[10px] text-text-secondary">
              Current: <span className="text-text-primary font-medium">{position.currentPrice.toPrecision(4)}</span>
            </span>
          </div>
          <div className="relative h-2 bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className={cn(
                'absolute h-full rounded-full',
                currentInRange ? 'bg-status-success/30' : 'bg-status-error/30'
              )}
              style={{ left: '0%', right: '0%' }}
            />
            <div
              className={cn(
                'absolute w-2 h-2 rounded-full transform -translate-x-1/2',
                currentInRange ? 'bg-status-success' : 'bg-status-error'
              )}
              style={{ left: `${rangePosition}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-text-muted tabular-nums">
              {position.priceLower.toPrecision(4)}
            </span>
            <span className="text-[10px] text-text-muted tabular-nums">
              {position.priceUpper.toPrecision(4)}
            </span>
          </div>
        </div>

        {/* Automation Badges */}
        {(position.automation.autoCompound ||
          position.automation.autoRange ||
          position.automation.autoExit) && (
          <div className="flex items-center gap-2 mt-3">
            {position.automation.autoCompound && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent-cyan/10 text-accent-cyan text-[9px] font-medium">
                <RefreshCw className="w-3 h-3" />
                Auto-Compound
              </span>
            )}
            {position.automation.autoRange && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent-purple/10 text-accent-purple text-[9px] font-medium">
                <Zap className="w-3 h-3" />
                Auto-Range
              </span>
            )}
            {position.automation.autoExit && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent-orange/10 text-accent-orange text-[9px] font-medium">
                <LogOut className="w-3 h-3" />
                Auto-Exit
              </span>
            )}
          </div>
        )}

        {/* Expand/Collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-1 mt-3 pt-3 border-t border-white/[0.03] text-[10px] text-text-muted hover:text-text-primary transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Less Details
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              More Details
            </>
          )}
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.03]">
          {/* Token Balances */}
          <div className="pt-3">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Position Breakdown</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-white/[0.02]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-text-secondary">{position.token0.symbol}</span>
                  <span className="text-[9px] text-text-muted">
                    @ ${position.token0.price.toLocaleString()}
                  </span>
                </div>
                <p className="text-[12px] font-medium text-text-primary tabular-nums">
                  {position.token0Amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </p>
                <p className="text-[9px] text-text-muted">
                  ${(position.token0Amount * position.token0.price).toLocaleString()}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-white/[0.02]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-text-secondary">{position.token1.symbol}</span>
                  <span className="text-[9px] text-text-muted">
                    @ ${position.token1.price.toLocaleString()}
                  </span>
                </div>
                <p className="text-[12px] font-medium text-text-primary tabular-nums">
                  {position.token1Amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </p>
                <p className="text-[9px] text-text-muted">
                  ${(position.token1Amount * position.token1.price).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* PnL Breakdown */}
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Performance</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-white/[0.02]">
                <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1">Initial Value</p>
                <p className="text-[12px] font-medium text-text-primary tabular-nums">
                  {formatNumber(position.initialValueUsd)}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-white/[0.02]">
                <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1">vs HODL</p>
                <p
                  className={cn(
                    'text-[12px] font-medium tabular-nums',
                    position.currentValueUsd >= position.hodlValueUsd
                      ? 'text-status-success'
                      : 'text-status-error'
                  )}
                >
                  {position.currentValueUsd >= position.hodlValueUsd ? '+' : ''}
                  {formatNumber(position.currentValueUsd - position.hodlValueUsd)}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-white/[0.02]">
                <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1">IL Loss</p>
                <p className="text-[12px] font-medium text-status-error tabular-nums">
                  {formatNumber(position.impermanentLossUsd)}
                </p>
              </div>
            </div>
          </div>

          {/* Unclaimed Fees & Rewards */}
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Unclaimed</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-status-success/5 border border-status-success/10">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-status-success" />
                  <div>
                    <p className="text-[10px] text-text-secondary">Trading Fees</p>
                    <p className="text-[9px] text-text-muted">
                      {position.feesUnclaimed.token0.toFixed(4)} {position.token0.symbol} +{' '}
                      {position.feesUnclaimed.token1.toFixed(4)} {position.token1.symbol}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-semibold text-status-success tabular-nums">
                    {formatNumber(position.feesUnclaimed.totalUsd)}
                  </p>
                </div>
              </div>

              {position.rewards && position.rewards.length > 0 && (
                <>
                  {position.rewards.map((reward, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-accent-purple/5 border border-accent-purple/10"
                    >
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-accent-purple" />
                        <div>
                          <p className="text-[10px] text-text-secondary">{reward.token.symbol} Rewards</p>
                          <p className="text-[9px] text-text-muted">
                            {reward.amount.toLocaleString()} {reward.token.symbol}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] font-semibold text-accent-purple tabular-nums">
                          {formatNumber(reward.valueUsd)}
                        </p>
                        <p className="text-[9px] text-text-muted">+{reward.apr.toFixed(1)}% APR</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Automation Settings */}
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Automation Settings</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[10px] text-text-secondary">Auto-Compound</span>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    position.automation.autoCompound ? 'text-status-success' : 'text-text-muted'
                  )}
                >
                  {position.automation.autoCompound
                    ? `Active (>${position.automation.autoCompoundThreshold} USD)`
                    : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[10px] text-text-secondary">Auto-Range</span>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    position.automation.autoRange ? 'text-status-success' : 'text-text-muted'
                  )}
                >
                  {position.automation.autoRange
                    ? `Active (${position.automation.autoRangePercent}% out)`
                    : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <LogOut className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[10px] text-text-secondary">Auto-Exit</span>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    position.automation.autoExit ? 'text-accent-orange' : 'text-text-muted'
                  )}
                >
                  {position.automation.autoExit
                    ? `@ ${position.automation.autoExitPrice} → ${position.automation.autoExitToken}`
                    : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => onCollectFees?.(position)}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-status-success/10 text-status-success text-[11px] font-medium hover:bg-status-success/20 transition-colors"
            >
              <Droplets className="w-4 h-4" />
              Collect Fees
            </button>
            <button
              onClick={() => onManage?.(position)}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-accent-purple/10 text-accent-purple text-[11px] font-medium hover:bg-accent-purple/20 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Manage
            </button>
            <button
              onClick={() => onRemoveLiquidity?.(position)}
              className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-white/[0.05] text-text-secondary text-[11px] font-medium hover:bg-white/[0.08] transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <a
              href={`${chain.explorer}/token/${position.nftId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center h-9 px-3 rounded-lg bg-white/[0.05] text-text-secondary hover:bg-white/[0.08] transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
