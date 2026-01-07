'use client';

import { type HTMLAttributes, forwardRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = 'md', ...props }, ref) => {
    const sizes = {
      sm: 'w-8 h-8 text-caption',
      md: 'w-10 h-10 text-body-sm',
      lg: 'w-12 h-12 text-body-md',
      xl: 'w-16 h-16 text-heading-sm',
    };

    const initials = fallback
      ? fallback
          .split(' ')
          .map((word) => word[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : '';

    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-full overflow-hidden bg-gradient-subtle flex items-center justify-center',
          'border border-border-subtle',
          sizes[size],
          className
        )}
        {...props}
      >
        {src ? (
          <Image
            src={src}
            alt={alt || 'Avatar'}
            fill
            className="object-cover"
          />
        ) : (
          <span className="font-medium text-text-secondary">{initials}</span>
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';
