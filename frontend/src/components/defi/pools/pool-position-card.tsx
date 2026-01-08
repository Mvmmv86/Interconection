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
import { useTheme } from '@/contexts/theme-context';
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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
      className={cn(
        "backdrop-blur-md rounded-xl overflow-hidden",
        isDark ? "border-white/[0.06]" : "border-slate-200/60"
      )}
      style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(22, 24, 32, 0.9) 0%, rgba(18, 20, 28, 0.85) 100%)'
          : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(203, 213, 225, 0.6)',
        boxShadow: isDark
          ? '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
          : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      }}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Token Pair Icons */}
            <div className="relative">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold border",
                isDark ? "bg-white/[0.08] border-white/[0.1]" : "bg-gray-200 border-gray-300",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {position.token0.symbol}
              </div>
              <div className={cn(
                "absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold border",
                isDark ? "bg-white/[0.08] border-white/[0.1]" : "bg-gray-200 border-gray-300",
                isDark ? "text-white/70" : "text-gray-600"
              )}>
                {position.token1.symbol.slice(0, 3)}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className={cn("text-[14px] font-semibold", isDark ? "text-white" : "text-gray-900")}>
                  {position.token0.symbol}/{position.token1.symbol}
                </h3>
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[9px] font-medium",
                  isDark ? "bg-white/[0.05] text-white/70" : "bg-gray-100 text-gray-600"
                )}>
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
                <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>{chain.name}</span>
                <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>·</span>
                <span className={cn("text-[10px]", isDark ? "text-white/70" : "text-gray-600")}>{protocol.name}</span>
                {position.nftId && (
                  <>
                    <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>·</span>
                    <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>#{position.nftId}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className={cn("text-[18px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
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
              <span className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                ({position.pnlUsd >= 0 ? '+' : ''}
                {formatNumber(position.pnlUsd)})
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className={cn("p-2 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
            <p className={cn("text-[9px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>APR</p>
            <p className="text-[13px] font-semibold text-status-success tabular-nums">
              {position.totalApr.toFixed(1)}%
            </p>
          </div>
          <div className={cn("p-2 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
            <p className={cn("text-[9px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>Fees Earned</p>
            <p className={cn("text-[13px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
              {formatNumber(position.feesEarned.totalUsd)}
            </p>
          </div>
          <div className={cn("p-2 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
            <p className={cn("text-[9px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>IL</p>
            <p
              className={cn(
                'text-[13px] font-semibold tabular-nums',
                position.impermanentLoss < 0 ? 'text-status-error' : 'text-status-success'
              )}
            >
              {position.impermanentLoss.toFixed(2)}%
            </p>
          </div>
          <div className={cn("p-2 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
            <p className={cn("text-[9px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>In Range</p>
            <p className={cn("text-[13px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
              {position.inRangePercent.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Price Range Visualization */}
        <div className={cn("mt-3 p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
          <div className="flex items-center justify-between mb-2">
            <span className={cn("text-[9px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>Price Range</span>
            <span className={cn("text-[10px]", isDark ? "text-white/70" : "text-gray-600")}>
              Current: <span className={cn("font-medium", isDark ? "text-white" : "text-gray-900")}>{position.currentPrice.toPrecision(4)}</span>
            </span>
          </div>
          <div className={cn("relative h-2 rounded-full overflow-hidden", isDark ? "bg-white/[0.05]" : "bg-gray-100")}>
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
            <span className={cn("text-[10px] tabular-nums", isDark ? "text-white/30" : "text-gray-500")}>
              {position.priceLower.toPrecision(4)}
            </span>
            <span className={cn("text-[10px] tabular-nums", isDark ? "text-white/30" : "text-gray-500")}>
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
          className={cn(
            "w-full flex items-center justify-center gap-1 mt-3 pt-3 border-t text-[10px] transition-colors",
            isDark ? "border-white/[0.03] text-white/30 hover:text-white" : "border-gray-100 text-gray-500 hover:text-gray-900"
          )}
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
        <div className={cn("px-4 pb-4 space-y-3 border-t", isDark ? "border-white/[0.03]" : "border-gray-100")}>
          {/* Token Balances */}
          <div className="pt-3">
            <p className={cn("text-[10px] uppercase tracking-wider mb-2", isDark ? "text-white/30" : "text-gray-500")}>Position Breakdown</p>
            <div className="grid grid-cols-2 gap-2">
              <div className={cn("p-2.5 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-[10px]", isDark ? "text-white/70" : "text-gray-600")}>{position.token0.symbol}</span>
                  <span className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
                    @ ${position.token0.price.toLocaleString()}
                  </span>
                </div>
                <p className={cn("text-[12px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                  {position.token0Amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </p>
                <p className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
                  ${(position.token0Amount * position.token0.price).toLocaleString()}
                </p>
              </div>
              <div className={cn("p-2.5 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-[10px]", isDark ? "text-white/70" : "text-gray-600")}>{position.token1.symbol}</span>
                  <span className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
                    @ ${position.token1.price.toLocaleString()}
                  </span>
                </div>
                <p className={cn("text-[12px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                  {position.token1Amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </p>
                <p className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
                  ${(position.token1Amount * position.token1.price).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* PnL Breakdown */}
          <div>
            <p className={cn("text-[10px] uppercase tracking-wider mb-2", isDark ? "text-white/30" : "text-gray-500")}>Performance</p>
            <div className="grid grid-cols-3 gap-2">
              <div className={cn("p-2.5 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>Initial Value</p>
                <p className={cn("text-[12px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                  {formatNumber(position.initialValueUsd)}
                </p>
              </div>
              <div className={cn("p-2.5 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>vs HODL</p>
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
              <div className={cn("p-2.5 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>IL Loss</p>
                <p className="text-[12px] font-medium text-status-error tabular-nums">
                  {formatNumber(position.impermanentLossUsd)}
                </p>
              </div>
            </div>
          </div>

          {/* Unclaimed Fees & Rewards */}
          <div>
            <p className={cn("text-[10px] uppercase tracking-wider mb-2", isDark ? "text-white/30" : "text-gray-500")}>Unclaimed</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-status-success/5 border border-status-success/10">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-status-success" />
                  <div>
                    <p className={cn("text-[10px]", isDark ? "text-white/70" : "text-gray-600")}>Trading Fees</p>
                    <p className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
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
                          <p className={cn("text-[10px]", isDark ? "text-white/70" : "text-gray-600")}>{reward.token.symbol} Rewards</p>
                          <p className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>
                            {reward.amount.toLocaleString()} {reward.token.symbol}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] font-semibold text-accent-purple tabular-nums">
                          {formatNumber(reward.valueUsd)}
                        </p>
                        <p className={cn("text-[9px]", isDark ? "text-white/30" : "text-gray-500")}>+{reward.apr.toFixed(1)}% APR</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Automation Settings */}
          <div>
            <p className={cn("text-[10px] uppercase tracking-wider mb-2", isDark ? "text-white/30" : "text-gray-500")}>Automation Settings</p>
            <div className="space-y-1.5">
              <div className={cn("flex items-center justify-between p-2 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                <div className="flex items-center gap-2">
                  <RefreshCw className={cn("w-3.5 h-3.5", isDark ? "text-white/30" : "text-gray-500")} />
                  <span className={cn("text-[10px]", isDark ? "text-white/70" : "text-gray-600")}>Auto-Compound</span>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    position.automation.autoCompound ? 'text-status-success' : isDark ? 'text-white/30' : 'text-gray-500'
                  )}
                >
                  {position.automation.autoCompound
                    ? `Active (>${position.automation.autoCompoundThreshold} USD)`
                    : 'Disabled'}
                </span>
              </div>
              <div className={cn("flex items-center justify-between p-2 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                <div className="flex items-center gap-2">
                  <Zap className={cn("w-3.5 h-3.5", isDark ? "text-white/30" : "text-gray-500")} />
                  <span className={cn("text-[10px]", isDark ? "text-white/70" : "text-gray-600")}>Auto-Range</span>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    position.automation.autoRange ? 'text-status-success' : isDark ? 'text-white/30' : 'text-gray-500'
                  )}
                >
                  {position.automation.autoRange
                    ? `Active (${position.automation.autoRangePercent}% out)`
                    : 'Disabled'}
                </span>
              </div>
              <div className={cn("flex items-center justify-between p-2 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                <div className="flex items-center gap-2">
                  <LogOut className={cn("w-3.5 h-3.5", isDark ? "text-white/30" : "text-gray-500")} />
                  <span className={cn("text-[10px]", isDark ? "text-white/70" : "text-gray-600")}>Auto-Exit</span>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    position.automation.autoExit ? 'text-accent-orange' : isDark ? 'text-white/30' : 'text-gray-500'
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
              className={cn(
                "flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-[11px] font-medium transition-colors",
                isDark ? "bg-white/[0.05] text-white/70 hover:bg-white/[0.08]" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              <LogOut className="w-4 h-4" />
            </button>
            <a
              href={`${chain.explorer}/token/${position.nftId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center justify-center h-9 px-3 rounded-lg transition-colors",
                isDark ? "bg-white/[0.05] text-white/70 hover:bg-white/[0.08]" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
