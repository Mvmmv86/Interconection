'use client';

import { Search, Bell, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className={cn(
        'h-12',
        'border-b',
        'flex items-center justify-between px-5',
        'sticky top-0 z-40 backdrop-blur-md',
        'transition-colors duration-300',
        theme === 'dark'
          ? 'border-white/[0.04]'
          : 'border-gray-200',
        className
      )}
      style={{
        background: theme === 'dark'
          ? 'rgba(4, 4, 6, 0.8)'
          : 'rgba(255, 255, 255, 0.9)',
      }}
    >
      {/* Search */}
      <div className="flex items-center gap-2.5 flex-1 max-w-xs">
        <div className="relative w-full">
          <Search className={cn(
            'absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5',
            theme === 'dark' ? 'text-text-muted' : 'text-gray-400'
          )} />
          <input
            type="text"
            placeholder="Search..."
            className={cn(
              'w-full h-8 pl-8 pr-3 rounded-md text-[11px] focus:outline-none transition-colors',
              theme === 'dark'
                ? 'text-text-primary placeholder:text-text-muted'
                : 'text-gray-900 placeholder:text-gray-400'
            )}
            style={{
              background: theme === 'dark'
                ? 'rgba(255, 255, 255, 0.04)'
                : 'rgba(0, 0, 0, 0.04)',
              border: theme === 'dark'
                ? '1px solid rgba(255, 255, 255, 0.06)'
                : '1px solid rgba(0, 0, 0, 0.08)',
            }}
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            'relative p-1.5 rounded-md transition-all duration-300',
            theme === 'dark'
              ? 'text-text-muted hover:text-yellow-400 hover:bg-white/[0.03]'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          )}
          title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        {/* Notifications */}
        <button className={cn(
          'relative p-1.5 rounded-md transition-colors',
          theme === 'dark'
            ? 'text-text-muted hover:text-text-primary hover:bg-white/[0.03]'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
        )}>
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-accent-blue rounded-full" />
        </button>

        {/* User */}
        <div className={cn(
          'flex items-center gap-2.5 pl-2.5 border-l',
          theme === 'dark' ? 'border-white/[0.03]' : 'border-gray-200'
        )}>
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
            <span className="text-[10px] font-medium text-white">JD</span>
          </div>
          <div className="hidden sm:block">
            <p className={cn(
              'text-[11px] font-medium',
              theme === 'dark' ? 'text-text-primary' : 'text-gray-900'
            )}>John Doe</p>
            <p className={cn(
              'text-[9px]',
              theme === 'dark' ? 'text-text-muted' : 'text-gray-500'
            )}>Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
}
