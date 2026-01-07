'use client';

import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  isCollapsed?: boolean;
}

export function SidebarItem({
  href,
  icon: Icon,
  label,
  isActive = false,
  isCollapsed = false,
}: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-md',
        'transition-all duration-base',
        'text-text-secondary hover:text-text-primary hover:bg-white/5',
        isActive && [
          'bg-gradient-subtle text-text-primary',
          'border-l-[3px] border-accent-purple -ml-[3px]',
        ],
        isCollapsed && 'justify-center px-3'
      )}
      title={isCollapsed ? label : undefined}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {!isCollapsed && <span className="text-body-sm">{label}</span>}
    </Link>
  );
}
