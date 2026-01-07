'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Notification {
  id: string;
  type: 'price_up' | 'price_down' | 'alert' | 'success';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'price_up',
    title: 'BTC Price Alert',
    message: 'Bitcoin crossed $100,000',
    time: '5m ago',
    read: false,
  },
  {
    id: '2',
    type: 'success',
    title: 'Sync Complete',
    message: 'Binance positions synced successfully',
    time: '15m ago',
    read: false,
  },
  {
    id: '3',
    type: 'alert',
    title: 'Health Factor Warning',
    message: 'Aave position HF below 1.5',
    time: '1h ago',
    read: true,
  },
  {
    id: '4',
    type: 'price_down',
    title: 'ETH Price Alert',
    message: 'Ethereum dropped 5% in 1h',
    time: '2h ago',
    read: true,
  },
];

const notificationIcons = {
  price_up: TrendingUp,
  price_down: TrendingDown,
  alert: AlertTriangle,
  success: CheckCircle,
};

const notificationColors = {
  price_up: 'text-status-success bg-status-success/10',
  price_down: 'text-status-error bg-status-error/10',
  alert: 'text-status-warning bg-status-warning/10',
  success: 'text-status-success bg-status-success/10',
};

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications] = useState<Notification[]>(mockNotifications);
  const menuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

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
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="text-text-secondary relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-status-error rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 top-full mt-2 w-80',
            'bg-background-elevated border border-border-default rounded-xl',
            'shadow-lg overflow-hidden',
            'animate-in fade-in-0 zoom-in-95'
          )}
        >
          {/* Header */}
          <div className="p-4 border-b border-border-subtle flex items-center justify-between">
            <h3 className="text-heading-sm text-text-primary">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="purple" size="sm">
                {unreadCount} new
              </Badge>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => {
                const Icon = notificationIcons[notification.type];
                const colorClass = notificationColors[notification.type];

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-4 border-b border-border-subtle hover:bg-white/5 transition-colors cursor-pointer',
                      !notification.read && 'bg-white/[0.02]'
                    )}
                  >
                    <div className="flex gap-3">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                          colorClass
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-body-sm text-text-primary font-medium truncate">
                            {notification.title}
                          </p>
                          <span className="text-caption text-text-tertiary shrink-0">
                            {notification.time}
                          </span>
                        </div>
                        <p className="text-caption text-text-secondary mt-0.5">
                          {notification.message}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-accent-purple shrink-0 mt-2" />
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-body-sm text-text-tertiary">No notifications</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-border-subtle">
              <Button variant="ghost" className="w-full text-accent-purple">
                View all notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
