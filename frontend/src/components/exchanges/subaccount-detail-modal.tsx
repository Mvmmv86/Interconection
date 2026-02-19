'use client';

import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import type { SubAccount } from '@/hooks/useExchangeDetail';

// Re-export for backwards compatibility
export type SubAccountWithBalances = SubAccount;

interface SubAccountDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  subaccount: SubAccount | null;
}

export function SubAccountDetailModal({ isOpen, onClose, subaccount }: SubAccountDetailModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!isOpen || !subaccount) return null;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Use real balances from sub-account data
  const balances = subaccount.balances || [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg rounded-2xl overflow-hidden"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.98) 0%, rgba(18, 21, 30, 0.95) 50%, rgba(20, 23, 32, 0.98) 100%)'
              : 'linear-gradient(145deg, #ffffff 0%, #f8fafc 40%, #f1f5f9 100%)',
            border: isDark
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(203, 213, 225, 0.6)',
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={cn("flex items-center justify-between p-4 border-b", isDark ? "border-white/[0.06]" : "border-gray-200")}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center text-[12px] font-bold",
                "bg-accent-purple/10 text-accent-purple"
              )}>
                {subaccount.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className={cn("text-[16px] font-semibold", isDark ? "text-white" : "text-gray-900")}>
                  {subaccount.username}
                </h2>
                <p className={cn("text-[11px]", isDark ? "text-white/40" : "text-gray-500")}>
                  UID: {subaccount.uid}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                isDark
                  ? "hover:bg-white/[0.05] text-white/50 hover:text-white/70"
                  : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Summary */}
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={cn("p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>
                  Total Value
                </p>
                <p className={cn("text-[18px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                  {formatCurrency(subaccount.totalValueUsd)}
                </p>
              </div>
              <div className={cn("p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>
                  Assets
                </p>
                <p className={cn("text-[18px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                  {subaccount.balancesCount}
                </p>
              </div>
            </div>

            {/* Balances List */}
            <div>
              <p className={cn("text-[10px] uppercase tracking-wider mb-3", isDark ? "text-white/30" : "text-gray-500")}>
                Asset Balances
              </p>
              {balances.length === 0 ? (
                <div className={cn("py-8 text-center rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
                  <p className={cn("text-[12px]", isDark ? "text-white/40" : "text-gray-500")}>
                    No balances available
                  </p>
                </div>
              ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {balances.map((balance) => (
                  <div
                    key={balance.asset}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg",
                      isDark ? "bg-white/[0.02]" : "bg-gray-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold",
                        isDark ? "bg-white/[0.05] text-white/70" : "bg-gray-200 text-gray-700"
                      )}>
                        {balance.asset.slice(0, 3)}
                      </div>
                      <div>
                        <p className={cn("text-[12px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                          {balance.asset}
                        </p>
                        <p className={cn("text-[10px] tabular-nums", isDark ? "text-white/40" : "text-gray-500")}>
                          {balance.total.toLocaleString(undefined, { maximumFractionDigits: 8 })} {balance.asset}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-[12px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                        {formatCurrency(balance.valueUsd)}
                      </p>
                      {balance.change24h !== undefined && balance.change24h !== 0 && (
                        <div className="flex items-center justify-end gap-1">
                          {balance.change24h > 0 ? (
                            <TrendingUp className="w-3 h-3 text-status-success" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-status-error" />
                          )}
                          <span className={cn(
                            "text-[10px] tabular-nums",
                            balance.change24h > 0 ? "text-status-success" : "text-status-error"
                          )}>
                            {balance.change24h > 0 ? '+' : ''}{balance.change24h.toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className={cn("flex justify-end gap-2 p-4 border-t", isDark ? "border-white/[0.06]" : "border-gray-200")}>
            <button
              onClick={onClose}
              className={cn(
                "px-4 py-2 rounded-lg text-[12px] font-medium transition-colors",
                isDark
                  ? "bg-white/[0.05] text-white/70 hover:bg-white/[0.08]"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
