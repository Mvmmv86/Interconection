'use client';

import { type HTMLAttributes, forwardRef } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PercentChangeProps extends HTMLAttributes<HTMLSpanElement> {
  value: number;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PercentChange = forwardRef<HTMLSpanElement, PercentChangeProps>(
  ({ className, value, showIcon = true, size = 'md', ...props }, ref) => {
    const isPositive = value > 0;
    const isNegative = value < 0;

    const colorClass = isPositive
      ? 'text-status-success'
      : isNegative
      ? 'text-status-error'
      : 'text-text-tertiary';

    const sizes = {
      sm: 'text-caption',
      md: 'text-body-sm',
      lg: 'text-body-md',
    };

    const iconSizes = {
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    };

    const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 font-medium tabular-nums',
          colorClass,
          sizes[size],
          className
        )}
        {...props}
      >
        {showIcon && <Icon className={iconSizes[size]} />}
        <span>
          {isPositive && '+'}
          {value.toFixed(2)}%
        </span>
      </span>
    );
  }
);

PercentChange.displayName = 'PercentChange';
