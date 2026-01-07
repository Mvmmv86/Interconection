'use client';

import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface CurrencyDisplayProps extends HTMLAttributes<HTMLSpanElement> {
  value: number;
  currency?: 'USD' | 'BRL' | 'EUR' | 'BTC' | 'ETH';
  showSign?: boolean;
  compact?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const CurrencyDisplay = forwardRef<HTMLSpanElement, CurrencyDisplayProps>(
  ({ className, value, currency = 'USD', showSign = false, compact = false, size = 'md', ...props }, ref) => {
    const formatValue = (val: number): string => {
      const absValue = Math.abs(val);

      if (compact) {
        if (absValue >= 1_000_000_000) {
          return `${(absValue / 1_000_000_000).toFixed(2)}B`;
        }
        if (absValue >= 1_000_000) {
          return `${(absValue / 1_000_000).toFixed(2)}M`;
        }
        if (absValue >= 1_000) {
          return `${(absValue / 1_000).toFixed(2)}K`;
        }
      }

      return absValue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const currencySymbols: Record<string, string> = {
      USD: '$',
      BRL: 'R$',
      EUR: '€',
      BTC: '₿',
      ETH: 'Ξ',
    };

    const sizes = {
      sm: 'text-body-sm',
      md: 'text-body-md',
      lg: 'text-heading-lg',
      xl: 'text-display-lg',
    };

    const isNegative = value < 0;
    const sign = showSign ? (isNegative ? '-' : '+') : (isNegative ? '-' : '');
    const symbol = currencySymbols[currency] || '$';

    return (
      <span
        ref={ref}
        className={cn(
          'font-semibold tabular-nums',
          sizes[size],
          showSign && (isNegative ? 'text-status-error' : 'text-status-success'),
          className
        )}
        {...props}
      >
        {sign}
        {symbol}
        {formatValue(value)}
      </span>
    );
  }
);

CurrencyDisplay.displayName = 'CurrencyDisplay';
