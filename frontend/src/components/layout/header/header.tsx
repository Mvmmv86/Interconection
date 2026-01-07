'use client';

import { Search, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  return (
    <header
      className={cn(
        'h-12',
        'border-b border-white/[0.04]',
        'flex items-center justify-between px-5',
        'sticky top-0 z-40 backdrop-blur-md',
        className
      )}
      style={{
        background: 'rgba(4, 4, 6, 0.8)',
      }}
    >
      {/* Search */}
      <div className="flex items-center gap-2.5 flex-1 max-w-xs">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full h-8 pl-8 pr-3 rounded-md text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none transition-colors"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2.5">
        {/* Notifications */}
        <button className="relative p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-white/[0.03] transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-accent-blue rounded-full" />
        </button>

        {/* User */}
        <div className="flex items-center gap-2.5 pl-2.5 border-l border-white/[0.03]">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
            <span className="text-[10px] font-medium text-white">JD</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-[11px] font-medium text-text-primary">John Doe</p>
            <p className="text-[9px] text-text-muted">Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
}
