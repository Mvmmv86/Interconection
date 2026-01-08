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
import { useTheme } from '@/contexts/theme-context';

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
  const { theme } = useTheme();

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;

    return (
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200',
          'text-[11px] font-medium',
          isActive
            ? 'text-accent-blue'
            : theme === 'dark'
              ? 'text-text-muted hover:text-text-primary'
              : 'text-slate-500 hover:text-slate-900'
        )}
        style={{
          background: isActive
            ? theme === 'dark'
              ? 'linear-gradient(145deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%)'
              : 'linear-gradient(145deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.05) 100%)'
            : 'transparent',
          border: isActive
            ? theme === 'dark'
              ? '1px solid rgba(59, 130, 246, 0.2)'
              : '1px solid rgba(59, 130, 246, 0.15)'
            : '1px solid transparent',
          boxShadow: isActive
            ? '0 2px 8px rgba(59, 130, 246, 0.15)'
            : 'none',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = theme === 'dark'
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)'
              : 'linear-gradient(145deg, rgba(203, 213, 225, 0.3) 0%, rgba(203, 213, 225, 0.15) 100%)';
            e.currentTarget.style.border = theme === 'dark'
              ? '1px solid rgba(255, 255, 255, 0.06)'
              : '1px solid rgba(203, 213, 225, 0.4)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.border = '1px solid transparent';
          }
        }}
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
        'backdrop-blur-xl',
        'flex flex-col transition-all duration-300',
        isCollapsed ? 'w-[52px]' : 'w-[200px]'
      )}
      style={{
        background: theme === 'dark'
          ? 'linear-gradient(180deg, rgba(18, 20, 28, 0.98) 0%, rgba(15, 17, 24, 0.98) 50%, rgba(13, 15, 22, 0.99) 100%)'
          : 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 30%, #e8ecf1 60%, #e2e8f0 100%)',
        boxShadow: theme === 'dark'
          ? '1px 0 0 rgba(255, 255, 255, 0.05)'
          : '2px 0 8px rgba(0, 0, 0, 0.04), 1px 0 0 rgba(203, 213, 225, 0.5)',
        borderRight: theme === 'dark'
          ? '1px solid rgba(255, 255, 255, 0.06)'
          : '1px solid rgba(203, 213, 225, 0.6)',
      }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center justify-between h-12 px-2.5 border-b',
        theme === 'dark' ? 'border-white/[0.03]' : 'border-gray-100'
      )}>
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
            <span className={cn(
              'text-[11px] font-semibold tracking-tight uppercase',
              theme === 'dark' ? 'text-text-primary' : 'text-gray-900'
            )}>
              Interconection
            </span>
          )}
        </Link>
        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            className={cn(
              'p-1 rounded transition-colors',
              theme === 'dark'
                ? 'text-text-muted hover:text-text-primary hover:bg-white/[0.03]'
                : 'text-gray-400 hover:text-gray-600 hover:bg-black/[0.03]'
            )}
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
            <p className={cn(
              'px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wider',
              theme === 'dark' ? 'text-text-muted' : 'text-gray-400'
            )}>
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
            <p className={cn(
              'px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wider',
              theme === 'dark' ? 'text-text-muted' : 'text-gray-400'
            )}>
              Analytics
            </p>
          )}
          {analyticsNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </nav>

      {/* Bottom */}
      <div className={cn(
        'border-t py-2 px-1.5 space-y-0.5',
        theme === 'dark' ? 'border-white/[0.03]' : 'border-gray-100'
      )}>
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
        <div className={cn(
          'border-t p-1.5',
          theme === 'dark' ? 'border-white/[0.03]' : 'border-gray-100'
        )}>
          <button
            onClick={() => setIsCollapsed(false)}
            className={cn(
              'w-full flex items-center justify-center p-1.5 rounded transition-colors',
              theme === 'dark'
                ? 'text-text-muted hover:text-text-primary hover:bg-white/[0.03]'
                : 'text-gray-400 hover:text-gray-600 hover:bg-black/[0.03]'
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>
      )}
    </aside>
  );
}
