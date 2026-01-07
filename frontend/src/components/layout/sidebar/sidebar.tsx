'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  PieChart,
  BarChart3,
  Bell,
  Settings,
  ChevronLeft,
  Menu,
  TrendingUp,
  Building2,
  Layers,
  HelpCircle,
  LogOut,
  HardDrive,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const mainNavItems: NavItem[] = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'Portfolio', href: '/portfolio', icon: PieChart },
  { label: 'Clients', href: '/clients', icon: Users },
];

const positionsNavItems: NavItem[] = [
  { label: 'Positions', href: '/positions', icon: Wallet },
  { label: 'Exchanges', href: '/positions/exchanges', icon: Building2 },
  { label: 'Wallets', href: '/positions/wallets', icon: HardDrive },
  { label: 'DeFi', href: '/positions/defi', icon: Layers },
  { label: 'Staking', href: '/positions/staking', icon: TrendingUp },
];

const analyticsNavItems: NavItem[] = [
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Alerts', href: '/alerts', icon: Bell },
];

const bottomNavItems: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Help', href: '/help', icon: HelpCircle },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;

    return (
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all duration-200',
          'text-[11px] font-medium',
          isActive
            ? 'bg-accent-blue/10 text-accent-blue'
            : 'text-text-muted hover:text-text-primary hover:bg-white/[0.02]'
        )}
      >
        <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-accent-blue')} />
        {!isCollapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen z-50',
        'backdrop-blur-xl border-r border-white/[0.06]',
        'flex flex-col transition-all duration-300',
        isCollapsed ? 'w-[52px]' : 'w-[200px]'
      )}
      style={{
        background: 'linear-gradient(180deg, rgba(18, 20, 28, 0.98) 0%, rgba(15, 17, 24, 0.98) 50%, rgba(13, 15, 22, 0.99) 100%)',
        boxShadow: '1px 0 0 rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-12 px-2.5 border-b border-white/[0.03]">
        <Link href="/" className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 50%, #06b6d4 100%)',
            }}
          >
            <span className="text-white font-bold text-[10px]">IC</span>
          </div>
          {!isCollapsed && (
            <span className="text-[11px] font-semibold text-text-primary tracking-tight uppercase">
              Interconection
            </span>
          )}
        </Link>
        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-white/[0.03] transition-colors"
          >
            <Menu className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-1.5 space-y-4">
        {/* Main */}
        <div className="space-y-0.5">
          {mainNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        {/* Positions */}
        <div className="space-y-0.5">
          {!isCollapsed && (
            <p className="px-2.5 py-1.5 text-[9px] font-semibold text-text-muted uppercase tracking-wider">
              Positions
            </p>
          )}
          {positionsNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        {/* Analytics */}
        <div className="space-y-0.5">
          {!isCollapsed && (
            <p className="px-2.5 py-1.5 text-[9px] font-semibold text-text-muted uppercase tracking-wider">
              Analytics
            </p>
          )}
          {analyticsNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/[0.03] py-2 px-1.5 space-y-0.5">
        {bottomNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <button
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-all duration-200',
            'text-[11px] font-medium text-status-error/60 hover:text-status-error hover:bg-status-error/5'
          )}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      {isCollapsed && (
        <div className="border-t border-white/[0.03] p-1.5">
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-full flex items-center justify-center p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-white/[0.03] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>
      )}
    </aside>
  );
}
