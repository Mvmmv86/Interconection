'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BlockchainBackground } from '@/components/auth/blockchain-background';
import { AnimatedBlocksLogo } from '@/components/auth/animated-blocks-logo';
import { LoginForm } from '@/components/auth/login-form';
import { LoginTransition } from '@/components/auth/login-transition';
import { useAuth } from '@/contexts/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [showTransition, setShowTransition] = useState(false);

  const handleLoginSuccess = useCallback(() => {
    setShowTransition(true);
  }, []);

  const handleTransitionComplete = useCallback(() => {
    router.push('/');
  }, [router]);

  // Redirect if already authenticated (from a previous session),
  // but NOT if we're showing the login transition animation
  useEffect(() => {
    if (isAuthenticated && !isLoading && !showTransition) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router, showTransition]);

  // Don't render login if already authed (previous session)
  // but keep rendering if transition is playing
  if (isAuthenticated && !isLoading && !showTransition) return null;

  // Show transition overlay on successful login
  if (showTransition) {
    return <LoginTransition onComplete={handleTransitionComplete} />;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#040406]">
      {/* Blockchain animated background */}
      <BlockchainBackground />

      {/* Content overlay */}
      <div className="relative z-10 flex min-h-screen">
        {/* Left side — Logo + tagline (hidden on mobile) */}
        <div className="hidden lg:flex lg:w-[55%] items-center justify-center p-12">
          <AnimatedBlocksLogo />
        </div>

        {/* Right side — Login form */}
        <div className="w-full lg:w-[45%] flex flex-col items-center justify-center p-6 md:p-12">
          {/* Mobile logo (compact) */}
          <div className="lg:hidden mb-10">
            <h1 className="text-2xl font-bold text-center bg-gradient-to-r from-[#8b5cf6] via-[#3b82f6] to-[#06b6d4] bg-clip-text text-transparent mb-1">
              Connecticoin
            </h1>
            <p className="text-xs tracking-[0.25em] uppercase text-white/30 text-center">
              Treasury Management
            </p>
          </div>

          {/* Login form */}
          <LoginForm onLoginSuccess={handleLoginSuccess} />

          {/* Bottom status indicators */}
          <div className="mt-8 flex items-center gap-4 text-[10px] text-white/20">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 animate-pulse" />
              Systems operational
            </span>
            <span>v1.0.0</span>
            <span>256-bit encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
