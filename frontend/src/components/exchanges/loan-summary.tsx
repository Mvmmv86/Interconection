'use client';

import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
import { Landmark, AlertTriangle } from 'lucide-react';
import type { LoanSummary as LoanSummaryType } from '@/hooks/useExchangeDetail';

interface LoanSummaryProps {
  loanSummary: LoanSummaryType;
}

export function LoanSummary({ loanSummary }: LoanSummaryProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (loanSummary.loans.length === 0) return null;

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
          ? '1px solid rgba(249, 115, 22, 0.2)'
          : '1px solid rgba(249, 115, 22, 0.3)',
        boxShadow: isDark
          ? '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-accent-orange/10">
            <Landmark className="w-4 h-4 text-accent-orange" />
          </div>
          <div>
            <h3 className={cn("text-[14px] font-semibold flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}>
              Active Loans
              <AlertTriangle className="w-3.5 h-3.5 text-accent-orange" />
            </h3>
            <p className={cn("text-[11px]", isDark ? "text-white/40" : "text-gray-500")}>
              {loanSummary.loans.length} active loan{loanSummary.loans.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-[10px] uppercase tracking-wider", isDark ? "text-white/30" : "text-gray-500")}>
            Total Borrowed
          </p>
          <p className="text-[18px] font-semibold tabular-nums text-accent-orange">
            {formatCurrency(loanSummary.totalBorrowedUsd)}
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={cn("p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
          <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>
            Total Interest
          </p>
          <p className={cn("text-[14px] font-medium tabular-nums text-status-error")}>
            {formatCurrency(loanSummary.totalInterestUsd)}
          </p>
        </div>
        <div className={cn("p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-gray-50")}>
          <p className={cn("text-[9px] uppercase tracking-wider mb-1", isDark ? "text-white/30" : "text-gray-500")}>
            Total Liability
          </p>
          <p className={cn("text-[14px] font-medium tabular-nums", isDark ? "text-white" : "text-gray-900")}>
            {formatCurrency(loanSummary.totalBorrowedUsd + loanSummary.totalInterestUsd)}
          </p>
        </div>
      </div>

      {/* Loans List */}
      <div className="space-y-2">
        <p className={cn("text-[10px] uppercase tracking-wider mb-2", isDark ? "text-white/30" : "text-gray-500")}>
          Loan Details
        </p>
        {loanSummary.loans.map((loan) => (
          <div
            key={loan.asset}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg",
              isDark ? "bg-white/[0.02]" : "bg-gray-50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold",
                "bg-accent-orange/10 text-accent-orange"
              )}>
                {loan.asset.slice(0, 3)}
              </div>
              <div>
                <p className={cn("text-[12px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                  {loan.asset}
                </p>
                <p className={cn("text-[10px]", isDark ? "text-white/30" : "text-gray-500")}>
                  Borrowed: {loan.borrowed.toLocaleString(undefined, { maximumFractionDigits: 4 })} {loan.asset}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn("text-[13px] font-medium tabular-nums text-accent-orange")}>
                {formatCurrency(loan.valueUsd)}
              </p>
              <p className={cn("text-[10px] tabular-nums text-status-error")}>
                Interest: {loan.interest.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
