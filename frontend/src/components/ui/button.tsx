'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const baseStyles = `
      inline-flex items-center justify-center gap-2 font-semibold rounded-lg
      transition-all duration-200 outline-none
      disabled:opacity-50 disabled:cursor-not-allowed
      active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-2
    `;

    const variants = {
      primary: 'bg-accent-purple text-white hover:bg-accent-purple/90',
      secondary: isDark
        ? 'bg-transparent border border-white/20 text-white hover:bg-white/5'
        : 'bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50',
      ghost: isDark
        ? 'bg-transparent text-white/70 hover:text-white hover:bg-white/5'
        : 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100',
      danger: 'bg-status-error text-white hover:bg-status-error/90',
    };

    const sizes = {
      sm: 'px-4 py-2 text-xs',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-8 py-3 text-base',
      icon: cn(
        'p-0 w-10 h-10 rounded-lg',
        isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'
      ),
      'icon-sm': cn(
        'p-0 w-8 h-8 rounded-lg',
        isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'
      ),
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Loading...</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
