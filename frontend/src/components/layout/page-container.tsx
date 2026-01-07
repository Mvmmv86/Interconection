'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('p-6 md:p-8 max-w-container mx-auto', className)}>
      {children}
    </div>
  );
}
