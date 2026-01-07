'use client';

import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: 'purple' | 'blue' | 'orange' | 'success' | 'error';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, variant = 'purple', size = 'md', showLabel = false, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const variants = {
      purple: 'bg-gradient-secondary',
      blue: 'bg-accent-blue',
      orange: 'bg-gradient-highlight',
      success: 'bg-status-success',
      error: 'bg-status-error',
    };

    const sizes = {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3',
    };

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        {showLabel && (
          <div className="flex justify-between mb-1">
            <span className="text-caption text-text-secondary">Progress</span>
            <span className="text-caption text-text-primary tabular-nums">{Math.round(percentage)}%</span>
          </div>
        )}
        <div className={cn('w-full bg-white/10 rounded-full overflow-hidden', sizes[size])}>
          <div
            className={cn('h-full rounded-full transition-all duration-slower', variants[variant])}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

Progress.displayName = 'Progress';
