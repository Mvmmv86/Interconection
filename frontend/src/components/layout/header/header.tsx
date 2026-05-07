'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Bell, Sun, Moon, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/theme-context';
import { useAuth } from '@/contexts/auth-context';
import { getInitials, formatRole } from '@/lib/utils/user-display';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const initials = getInitials(user?.name);
  const displayName = user?.name || 'Carregando...';
  const displayRole = formatRole(user?.role);

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

        {/* User menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              'flex items-center gap-2.5 pl-2.5 border-l rounded-md py-1 pr-2 transition-colors',
              theme === 'dark'
                ? 'border-white/[0.03] hover:bg-white/[0.03]'
                : 'border-gray-200 hover:bg-gray-50'
            )}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
              <span className="text-[10px] font-medium text-white">{initials}</span>
            </div>
            <div className="hidden sm:block text-left">
              <p className={cn(
                'text-[11px] font-medium',
                theme === 'dark' ? 'text-text-primary' : 'text-gray-900'
              )}>{displayName}</p>
              <p className={cn(
                'text-[9px]',
                theme === 'dark' ? 'text-text-muted' : 'text-gray-500'
              )}>{displayRole}</p>
            </div>
          </button>

          {menuOpen && user && (
            <div
              role="menu"
              className={cn(
                'absolute right-0 top-full mt-1 w-64 rounded-lg shadow-xl z-50 overflow-hidden',
                theme === 'dark'
                  ? 'bg-bg-secondary border border-white/[0.06]'
                  : 'bg-white border border-gray-200'
              )}
            >
              {/* Header: full name + email */}
              <div className={cn(
                'px-3 py-3 border-b',
                theme === 'dark' ? 'border-white/[0.04]' : 'border-gray-100'
              )}>
                <p className={cn(
                  'text-[12px] font-medium',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {user.name}
                </p>
                <p className={cn(
                  'text-[10px] mt-0.5 truncate',
                  theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                )}>
                  {user.email}
                </p>
                <span
                  className={cn(
                    'inline-block mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium',
                    theme === 'dark'
                      ? 'bg-accent-purple/15 text-accent-purple'
                      : 'bg-accent-purple/10 text-accent-purple'
                  )}
                >
                  {displayRole}
                </span>
              </div>

              {/* Actions */}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                role="menuitem"
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors',
                  theme === 'dark'
                    ? 'text-status-error hover:bg-status-error/10'
                    : 'text-status-error hover:bg-red-50'
                )}
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
