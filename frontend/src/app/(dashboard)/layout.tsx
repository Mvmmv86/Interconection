'use client';

import { type ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background-primary">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="pl-[260px] transition-all duration-slow">
        {/* Header */}
        <Header />

        {/* Page Content */}
        <main className="min-h-[calc(100vh-64px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
