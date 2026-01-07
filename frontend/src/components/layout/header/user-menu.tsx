'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-3 p-2 rounded-lg',
          'hover:bg-white/5 transition-all duration-base'
        )}
      >
        <Avatar fallback="John Doe" size="sm" />
        <div className="hidden md:block text-left">
          <p className="text-body-sm text-text-primary font-medium">John Doe</p>
          <p className="text-caption text-text-tertiary">Admin</p>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-text-tertiary transition-transform duration-base hidden md:block',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute right-0 top-full mt-2 w-56',
            'bg-background-elevated border border-border-default rounded-xl',
            'shadow-lg overflow-hidden',
            'animate-in fade-in-0 zoom-in-95'
          )}
        >
          <div className="p-4 border-b border-border-subtle">
            <p className="text-body-sm text-text-primary font-medium">John Doe</p>
            <p className="text-caption text-text-tertiary">john@interconection.io</p>
          </div>

          <div className="p-2">
            <Link
              href="/settings/profile"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md',
                'text-body-sm text-text-secondary',
                'hover:bg-white/5 hover:text-text-primary transition-all duration-base'
              )}
              onClick={() => setIsOpen(false)}
            >
              <User className="w-4 h-4" />
              Profile
            </Link>
            <Link
              href="/settings"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md',
                'text-body-sm text-text-secondary',
                'hover:bg-white/5 hover:text-text-primary transition-all duration-base'
              )}
              onClick={() => setIsOpen(false)}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </div>

          <div className="p-2 border-t border-border-subtle">
            <button
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md',
                'text-body-sm text-status-error',
                'hover:bg-status-error/10 transition-all duration-base'
              )}
              onClick={() => setIsOpen(false)}
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
