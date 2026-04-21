'use client';

import React from 'react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useAuthStore } from '@/lib/authStore';
import OnboardingWizard from './OnboardingWizard';

const OnboardingGate = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const isPublicAuthRoute =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/verify') ||
    pathname?.startsWith('/forgot-password') ||
    pathname?.startsWith('/set-password');
  const isOAuthCallbackRoute =
    pathname?.startsWith('/auth/google/callback') ||
    pathname?.startsWith('/google/callback');
  const isAuthRoute = isPublicAuthRoute || isOAuthCallbackRoute;
  const isRootRoute = pathname === '/';
  const { needsOnboarding, checking } = useOnboarding();
  const shouldShowOnboardingWizard = !isAuthRoute && needsOnboarding;
  // Legacy "Preparing your workspace" blue spinner is intentionally disabled
  // (G-09): per-page skeletons in dashboard-v2 already cover the brief check
  // window, and stacking two overlays in a row was jarring.
  const shouldShowBlockingCheck = false;
  const shouldBlockBackground = shouldShowOnboardingWizard || shouldShowBlockingCheck;

  useEffect(() => {
    // Requirement: after signup, entering localhost should reset to logged-out
    // while staying on localhost (no redirect to /login).
    if (!isRootRoute || checking || !needsOnboarding) return;
    clearAuth();
  }, [checking, clearAuth, isRootRoute, needsOnboarding]);

  return (
    <div className="relative">
      <div
        className={`min-h-screen transition duration-200 ${
          shouldBlockBackground ? 'pointer-events-none select-none blur-sm overflow-hidden' : ''
        }`}
      >
        {children}
      </div>

      {shouldBlockBackground && (
        <div className="pointer-events-none fixed inset-0 z-[9998] bg-white/30 backdrop-blur-md" />
      )}

      {shouldShowOnboardingWizard && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto px-4 py-8">
          <OnboardingWizard />
        </div>
      )}
    </div>
  );
};

export default OnboardingGate;
