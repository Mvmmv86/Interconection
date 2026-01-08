'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

interface ThemedCardProps {
  children: ReactNode;
  className?: string;
  showShine?: boolean;
}

export function ThemedCard({ children, className, showShine = true }: ThemedCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className={cn(
        'rounded-xl p-4 relative overflow-hidden transition-colors duration-300',
        className
      )}
      style={{
        background: isDark
          ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
          : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',
        border: isDark
          ? '1px solid rgba(255, 255, 255, 0.08)'
          : '1px solid rgba(203, 213, 225, 0.6)',
        boxShadow: isDark
          ? '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      }}
    >
      {/* Top shine effect */}
      {showShine && (
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background: isDark
              ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)'
              : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.9) 50%, transparent 100%)',
          }}
        />
      )}
      {children}
    </div>
  );
}

// Hook para usar estilos de texto com tema
export function useThemedText() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return {
    isDark,
    // Textos principais - ALTO CONTRASTE para light mode
    primary: isDark ? 'text-white' : 'text-slate-900',
    secondary: isDark ? 'text-white/70' : 'text-slate-700',
    tertiary: isDark ? 'text-white/50' : 'text-slate-600',
    muted: isDark ? 'text-white/30' : 'text-slate-500',
    // Labels - mais visíveis no light mode
    label: isDark ? 'text-white/50' : 'text-slate-700',
    // Hover backgrounds - mais pronunciado no light mode
    hoverBg: isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-100',
    // Backgrounds for icons/badges - mais contraste
    iconBg: isDark ? 'bg-white/[0.03]' : 'bg-slate-100',
    // Borders
    border: isDark ? 'border-white/[0.06]' : 'border-slate-200',
    // Input backgrounds
    inputBg: isDark ? 'bg-white/[0.04]' : 'bg-slate-50',
    inputBorder: isDark ? 'border-white/[0.06]' : 'border-slate-200',
  };
}
