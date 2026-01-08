'use client';

import { useTheme } from '@/contexts/theme-context';

export function useThemeStyles() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return {
    theme,
    isDark,

    // Background styles
    pageBackground: isDark
      ? 'linear-gradient(135deg, #0a0a0f 0%, #0d0d14 20%, #0f1018 40%, #0d0e15 60%, #0a0b10 80%, #08090d 100%)'
      : 'linear-gradient(135deg, #f8f9fb 0%, #f1f3f6 20%, #e8ebf0 40%, #f1f3f6 60%, #f5f6f8 80%, #f8f9fb 100%)',

    // Gradient overlay
    gradientOverlay: isDark
      ? `
        radial-gradient(ellipse at 0% 0%, rgba(59, 130, 246, 0.04) 0%, transparent 50%),
        radial-gradient(ellipse at 100% 0%, rgba(139, 92, 246, 0.03) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 100%, rgba(6, 182, 212, 0.02) 0%, transparent 40%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.01) 0%, transparent 30%)
      `
      : `
        radial-gradient(ellipse at 0% 0%, rgba(59, 130, 246, 0.06) 0%, transparent 50%),
        radial-gradient(ellipse at 100% 0%, rgba(139, 92, 246, 0.04) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 100%, rgba(6, 182, 212, 0.03) 0%, transparent 40%)
      `,

    // Card styles - Gradiente gelo-cinza futurístico para light mode
    cardBackground: isDark
      ? 'linear-gradient(145deg, rgba(22, 25, 35, 0.95) 0%, rgba(18, 21, 30, 0.9) 50%, rgba(20, 23, 32, 0.95) 100%)'
      : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8ecf1 70%, #e2e8f0 100%)',

    cardBorder: isDark
      ? '1px solid rgba(255, 255, 255, 0.08)'
      : '1px solid rgba(203, 213, 225, 0.6)',

    cardShadow: isDark
      ? '0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      : '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8)',

    cardShine: isDark
      ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)'
      : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',

    // Text colors - ALTO CONTRASTE para light mode
    textPrimary: isDark ? 'text-text-primary' : 'text-slate-900',
    textSecondary: isDark ? 'text-text-secondary' : 'text-slate-700',
    textTertiary: isDark ? 'text-text-tertiary' : 'text-slate-600',
    textMuted: isDark ? 'text-text-muted' : 'text-slate-500',

    // Border colors
    borderSubtle: isDark ? 'border-white/[0.06]' : 'border-slate-200',
    borderDefault: isDark ? 'border-white/[0.08]' : 'border-slate-300',

    // Hover states - mais visível no light mode
    hoverBg: isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-100',
  };
}
