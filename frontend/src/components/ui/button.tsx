'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles = `
      inline-flex items-center justify-center gap-2 font-semibold rounded-md
      transition-all duration-base outline-none
      disabled:opacity-50 disabled:cursor-not-allowed
      active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-2 focus-visible:ring-offset-background-primary
    `;

    const variants = {
      primary: 'bg-gradient-brand text-white hover:brightness-110 hover:shadow-glow-purple',
      secondary: 'bg-transparent border border-border-strong text-text-primary hover:bg-white/5',
      ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5',
      danger: 'bg-status-error text-white hover:brightness-110',
    };

    const sizes = {
      sm: 'px-4 py-2 text-body-sm',
      md: 'px-6 py-3 text-body-md',
      lg: 'px-8 py-4 text-body-lg',
      icon: 'p-0 w-10 h-10 rounded-md bg-white/5 hover:bg-white/10',
      'icon-sm': 'p-0 w-8 h-8 rounded-md bg-white/5 hover:bg-white/10',
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
