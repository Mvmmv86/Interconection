'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  size?: 'sm' | 'md';
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, checked = false, onChange, size = 'md', disabled, ...props }, ref) => {
    const sizes = {
      sm: {
        track: 'w-9 h-5',
        thumb: 'w-4 h-4',
        translate: 'translate-x-4',
      },
      md: {
        track: 'w-11 h-6',
        thumb: 'w-5 h-5',
        translate: 'translate-x-5',
      },
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={cn(
          'relative inline-flex shrink-0 cursor-pointer rounded-full',
          'transition-colors duration-base focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-accent-purple focus-visible:ring-offset-2 focus-visible:ring-offset-background-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          sizes[size].track,
          checked ? 'bg-accent-purple' : 'bg-white/10',
          className
        )}
        onClick={() => onChange?.(!checked)}
        {...props}
      >
        <span
          className={cn(
            'pointer-events-none inline-block rounded-full bg-white shadow-sm',
            'transition-transform duration-base',
            sizes[size].thumb,
            'absolute top-0.5 left-0.5',
            checked && sizes[size].translate
          )}
        />
      </button>
    );
  }
);

Toggle.displayName = 'Toggle';
