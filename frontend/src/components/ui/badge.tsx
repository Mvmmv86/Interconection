'use client';

import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'purple' | 'blue' | 'orange' | 'yellow' | 'success' | 'error';
  size?: 'sm' | 'md';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-white/10 text-text-secondary',
      purple: 'bg-accent-purple/20 text-accent-purple',
      blue: 'bg-accent-blue/20 text-accent-blue',
      orange: 'bg-accent-orange/20 text-accent-orange',
      yellow: 'bg-accent-yellow/20 text-accent-yellow',
      success: 'bg-status-success/20 text-status-success',
      error: 'bg-status-error/20 text-status-error',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-[10px]',
      md: 'px-3 py-1 text-caption',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 rounded-full font-medium',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
