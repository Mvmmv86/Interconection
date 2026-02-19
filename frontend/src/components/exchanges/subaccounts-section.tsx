'use client';

import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
import { Users, ChevronRight } from 'lucide-react';
import type { SubAccount } from '@/hooks/useExchangeDetail';

interface SubAccountsSectionProps {
  subaccounts: SubAccount[];
  totalValue: number;
  onSubAccountClick?: (subaccount: SubAccount) => void;
}

export function SubAccountsSection({ subaccounts, totalValue, onSubAccountClick }: SubAccountsSectionProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (subaccounts.length === 0) return null;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div
      className="rounded-xl p-4 mb-5"
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", "bg-accent-purple/10")}>
            <Users className="w-4 h-4 text-accent-purple" />
          </div>
          <div>
            <h3 className={cn("text-[14px] font-semibold", isDark ? "text-white" : "text-gray-900")}>
              Sub-accounts
            </h3>
            <p className={cn("text-[11px]", isDark ? "text-white/40" : "text-gray-500")}>
              {subaccounts.length} sub-account{subaccounts.length !== 1 ? 's' : ''} connected
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-[10px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>
            Total Value
          </p>
          <p className={cn("text-[18px] font-semibold tabular-nums", isDark ? "text-white" : "text-gray-900")}>
            {formatCurrency(totalValue)}
          </p>
        </div>
      </div>

      {/* Sub-accounts List */}
      <div className="space-y-2">
        {subaccounts.map((sub) => (
          <div
            key={sub.uid}
            onClick={() => onSubAccountClick?.(sub)}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer group",
              isDark
                ? "bg-white/[0.02] hover:bg-white/[0.04]"
                : "bg-gray-50 hover:bg-gray-100"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold",
                isDark ? "bg-white/[0.05] text-white/50" : "bg-gray-200 text-gray-600"
              )}>
                {sub.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className={cn("text-[12px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                  {sub.username}
                </p>
                <p className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                  UID: {sub.uid} · {sub.balancesCount} asset{sub.balancesCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className={cn("text-[13px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
                  {formatCurrency(sub.totalValueUsd)}
                </p>
                <p className={cn("text-[10px] tabular-nums", isDark ? "text-white/30" : "text-gray-500")}>
                  {((sub.totalValueUsd / totalValue) * 100).toFixed(1)}% of total
                </p>
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 transition-transform group-hover:translate-x-0.5",
                isDark ? "text-white/20" : "text-gray-400"
              )} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
