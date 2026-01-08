'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useThemeStyles } from '@/hooks/use-theme-styles';

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
  const { isDark, cardBackground, cardBorder, cardShadow, cardShine } = useThemeStyles();

  const accentColors = {
    orange: 'bg-accent-orange',
    purple: 'bg-accent-purple',
    blue: 'bg-accent-blue',
    green: 'bg-status-success',
    cyan: 'bg-accent-cyan',
  };

  // Icon colors
  const iconColors = {
    orange: 'text-accent-orange',
    purple: 'text-accent-purple',
    blue: 'text-accent-blue',
    green: 'text-status-success',
    cyan: 'text-accent-cyan',
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
        background: cardBackground,
        border: cardBorder,
        boxShadow: cardShadow,
      }}
    >
      {/* Top shine effect */}
      <div
        className="absolute inset-x-0 top-0 h-[1px]"
        style={{
          background: cardShine,
        }}
      />

      {/* Accent line */}
      <div
        className={cn(
          'absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full',
          accentColors[accentColor]
        )}
        style={{
          boxShadow: isDark
            ? `0 0 12px ${accentColor === 'blue' ? 'rgba(59, 130, 246, 0.5)' : accentColor === 'green' ? 'rgba(34, 197, 94, 0.5)' : accentColor === 'cyan' ? 'rgba(6, 182, 212, 0.5)' : accentColor === 'purple' ? 'rgba(139, 92, 246, 0.5)' : 'rgba(249, 115, 22, 0.5)'}`
            : `0 0 8px ${accentColor === 'blue' ? 'rgba(59, 130, 246, 0.3)' : accentColor === 'green' ? 'rgba(34, 197, 94, 0.3)' : accentColor === 'cyan' ? 'rgba(6, 182, 212, 0.3)' : accentColor === 'purple' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(249, 115, 22, 0.3)'}`,
        }}
      />

      {/* Content container with subtle background */}
      <div
        className="relative z-10 rounded-lg p-3 -m-1"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%)'
            : 'transparent',
        }}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1.5 pl-1">
            {/* Label */}
            <p className={cn(
              'text-[10px] font-semibold uppercase tracking-wider',
              isDark ? 'text-white/50' : 'text-slate-500'
            )}>
              {label}
            </p>

            {/* Value */}
            <p className={cn(
              'text-2xl font-bold tabular-nums tracking-tight',
              isDark ? 'text-white' : 'text-slate-900'
            )}>
              {typeof value === 'number' ? formatValue(value) : value}
            </p>

            {/* Change */}
            {change !== undefined && (
              <div className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                isPositive
                  ? 'bg-status-success/15 text-status-success'
                  : 'bg-status-error/15 text-status-error'
              )}>
                <span>{isPositive ? '↑' : '↓'}</span>
                <span>{Math.abs(change).toFixed(2)}%</span>
              </div>
            )}
          </div>

          {/* Icon with tech styling */}
          {icon && (
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                iconColors[accentColor]
              )}
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)'
                  : `linear-gradient(145deg, ${accentColor === 'blue' ? 'rgba(59, 130, 246, 0.15)' : accentColor === 'green' ? 'rgba(34, 197, 94, 0.15)' : accentColor === 'cyan' ? 'rgba(6, 182, 212, 0.15)' : accentColor === 'purple' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(249, 115, 22, 0.15)'} 0%, ${accentColor === 'blue' ? 'rgba(59, 130, 246, 0.05)' : accentColor === 'green' ? 'rgba(34, 197, 94, 0.05)' : accentColor === 'cyan' ? 'rgba(6, 182, 212, 0.05)' : accentColor === 'purple' ? 'rgba(139, 92, 246, 0.05)' : 'rgba(249, 115, 22, 0.05)'} 100%)`,
                border: isDark
                  ? '1px solid rgba(255, 255, 255, 0.08)'
                  : `1px solid ${accentColor === 'blue' ? 'rgba(59, 130, 246, 0.2)' : accentColor === 'green' ? 'rgba(34, 197, 94, 0.2)' : accentColor === 'cyan' ? 'rgba(6, 182, 212, 0.2)' : accentColor === 'purple' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(249, 115, 22, 0.2)'}`,
                boxShadow: isDark
                  ? 'inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                  : `0 2px 8px ${accentColor === 'blue' ? 'rgba(59, 130, 246, 0.15)' : accentColor === 'green' ? 'rgba(34, 197, 94, 0.15)' : accentColor === 'cyan' ? 'rgba(6, 182, 212, 0.15)' : accentColor === 'purple' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(249, 115, 22, 0.15)'}`,
              }}
            >
              {icon}
            </div>
          )}
        </div>
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
