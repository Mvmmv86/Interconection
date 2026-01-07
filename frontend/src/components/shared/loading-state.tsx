'use client';

import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

export interface LoadingStateProps extends HTMLAttributes<HTMLDivElement> {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingState = forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ className, message = 'Loading...', size = 'md', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center py-16',
          className
        )}
        {...props}
      >
        <Spinner size={size} className="text-accent-purple mb-4" />
        <p className="text-body-sm text-text-tertiary">{message}</p>
      </div>
    );
  }
);

LoadingState.displayName = 'LoadingState';
