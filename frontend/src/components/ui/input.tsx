'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "block text-sm font-medium mb-2",
              isDark ? "text-white/70" : "text-gray-700"
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none",
              isDark ? "text-white/40" : "text-gray-400"
            )}>
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-lg px-4 py-2.5 text-sm',
              'transition-all duration-200 outline-none',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isDark
                ? 'bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/30 focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/50'
                : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/30 focus:bg-white',
              leftIcon && 'pl-12',
              rightIcon && 'pr-12',
              error && 'border-status-error focus:border-status-error focus:ring-status-error/30',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2",
              isDark ? "text-white/40" : "text-gray-400"
            )}>
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-2 text-xs text-status-error">{error}</p>
        )}
        {hint && !error && (
          <p className={cn("mt-2 text-xs", isDark ? "text-white/50" : "text-gray-500")}>{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
