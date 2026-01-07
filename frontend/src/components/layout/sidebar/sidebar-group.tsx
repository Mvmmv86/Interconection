'use client';

import { type ReactNode } from 'react';

interface SidebarGroupProps {
  label: string;
  children: ReactNode;
  isCollapsed?: boolean;
}

export function SidebarGroup({ label, children, isCollapsed = false }: SidebarGroupProps) {
  return (
    <div className="space-y-1">
      {!isCollapsed && (
        <span className="px-4 text-overline text-text-tertiary uppercase tracking-wider">
          {label}
        </span>
      )}
      {isCollapsed && (
        <div className="h-px bg-border-subtle mx-2 my-2" />
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
}
