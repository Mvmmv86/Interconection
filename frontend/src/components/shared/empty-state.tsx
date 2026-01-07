'use client';

import { type HTMLAttributes, forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
  };
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center text-center py-16 px-8',
          className
        )}
        {...props}
      >
        {icon && (
          <div className="w-16 h-16 mb-4 text-text-muted opacity-30">
            {icon}
          </div>
        )}
        <h3 className="text-heading-md text-text-primary mb-2">{title}</h3>
        {description && (
          <p className="text-body-sm text-text-tertiary max-w-sm mb-6">
            {description}
          </p>
        )}
        {action && (
          <Button variant={action.variant || 'primary'} onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';
