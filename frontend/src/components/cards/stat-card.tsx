'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  icon?: ReactNode;
  accentColor?: 'orange' | 'purple' | 'blue' | 'green' | 'cyan';
  className?: string;
}

export function StatCard({
  label,
  value,
  change,
  icon,
  accentColor = 'blue',
  className,
}: StatCardProps) {
  const accentColors = {
    orange: 'bg-accent-orange',
    purple: 'bg-accent-purple',
    blue: 'bg-accent-blue',
    green: 'bg-status-success',
    cyan: 'bg-accent-cyan',
  };

  const isPositive = change !== undefined && change >= 0;

  return (
    <div
      className={cn(
        'relative rounded-xl p-4 overflow-hidden',
        'hover:scale-[1.01] transition-all duration-300',
        className
      )}
      style={{
        background: 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: `
          0 4px 24px rgba(0, 0, 0, 0.3),
          0 1px 2px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.05)
        `,
      }}
    >
      {/* Top shine effect */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
        }}
      />

      {/* Accent line */}
      <div
        className={cn(
          'absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full',
          accentColors[accentColor]
        )}
        style={{
          boxShadow: `0 0 12px ${accentColor === 'blue' ? 'rgba(59, 130, 246, 0.5)' : accentColor === 'green' ? 'rgba(34, 197, 94, 0.5)' : accentColor === 'cyan' ? 'rgba(6, 182, 212, 0.5)' : accentColor === 'purple' ? 'rgba(139, 92, 246, 0.5)' : 'rgba(249, 115, 22, 0.5)'}`,
        }}
      />

      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1.5 pl-2">
          {/* Label */}
          <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
            {label}
          </p>

          {/* Value */}
          <p className="text-xl font-semibold text-text-primary tabular-nums">
            {typeof value === 'number' ? formatValue(value) : value}
          </p>

          {/* Change */}
          {change !== undefined && (
            <p
              className={cn(
                'text-[10px] font-medium tabular-nums',
                isPositive ? 'text-status-success' : 'text-status-error'
              )}
            >
              {isPositive ? '+' : ''}
              {change.toFixed(2)}%
            </p>
          )}
        </div>

        {/* Icon */}
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted"
            style={{
              background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function formatValue(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  if (value < 100) {
    return `${value.toFixed(2)}%`;
  }
  return `$${value.toLocaleString()}`;
}
