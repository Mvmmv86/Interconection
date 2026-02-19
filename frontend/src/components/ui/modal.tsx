'use client';

import { type HTMLAttributes, forwardRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { useTheme } from '@/contexts/theme-context';

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({ className, isOpen, onClose, title, size = 'md', showCloseButton = true, children, ...props }, ref) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const sizes = {
      sm: 'max-w-md',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl',
    };

    // Handle escape key
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };

      if (isOpen) {
        document.addEventListener('keydown', handleEscape);
        document.body.style.overflow = 'hidden';
      }

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
      };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50">
        {/* Overlay */}
        <div
          className={cn(
            "fixed inset-0 backdrop-blur-sm",
            isDark ? "bg-black/70" : "bg-black/40"
          )}
          onClick={onClose}
        />

        {/* Modal */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              ref={ref}
              className={cn(
                'relative w-full backdrop-blur-xl rounded-2xl shadow-xl',
                'p-6 md:p-8',
                'animate-in fade-in-0 zoom-in-95',
                isDark
                  ? 'bg-[rgba(26,26,36,0.98)] border border-[rgba(255,255,255,0.08)]'
                  : 'bg-white border border-gray-200 shadow-2xl',
                sizes[size],
                className
              )}
              {...props}
            >
              {/* Header */}
              {(title || showCloseButton) && (
                <div className="flex items-center justify-between mb-6">
                  {title && (
                    <h2 className={cn(
                      "text-xl font-semibold",
                      isDark ? "text-white" : "text-gray-900"
                    )}>
                      {title}
                    </h2>
                  )}
                  {showCloseButton && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      className={cn(
                        "ml-auto",
                        isDark
                          ? "text-white/50 hover:text-white hover:bg-white/10"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              )}

              {/* Content */}
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

Modal.displayName = 'Modal';

export type ModalFooterProps = HTMLAttributes<HTMLDivElement>;

export const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, children, ...props }, ref) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-end gap-3 mt-6 pt-6 border-t',
          isDark ? 'border-white/[0.06]' : 'border-gray-200',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ModalFooter.displayName = 'ModalFooter';
