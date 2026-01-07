'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-body-sm font-medium text-text-secondary mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full appearance-none bg-white/5 border border-border-default rounded-md',
              'px-4 py-3 pr-10 text-body-md text-text-primary',
              'transition-all duration-base outline-none cursor-pointer',
              'focus:border-accent-purple focus:shadow-glow-purple',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-status-error focus:border-status-error focus:shadow-none',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled className="text-text-muted bg-background-secondary">
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-background-secondary text-text-primary"
              >
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
          />
        </div>
        {error && (
          <p className="mt-2 text-caption text-status-error">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
