'use client';

import { type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/contexts/auth-context';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Loading skeleton while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#8b5cf6]/30 border-t-[#8b5cf6] rounded-full animate-spin" />
          <p className="text-sm text-white/30">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="pl-[260px] transition-all duration-slow">
        {/* Header */}
        <Header />

        {/* Page Content */}
        <main className="min-h-[calc(100vh-64px)] bg-background-primary">
          {children}
        </main>
      </div>
    </div>
  );
}
