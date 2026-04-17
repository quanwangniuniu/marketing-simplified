'use client';

import React from 'react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useAuthStore } from '@/lib/authStore';
import OnboardingWizard from './OnboardingWizard';
import { getAuthLoadingRoutePolicy } from '@/lib/authLoadingPolicy';

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
  const showOverlay = !isAuthRoute && (needsOnboarding || checking);
  const { deferOnboardingCheckBlock } = getAuthLoadingRoutePolicy(pathname);
  const shouldUseNonBlockingCheck = Boolean(
    deferOnboardingCheckBlock && checking && !needsOnboarding,
  );
  const shouldBlockBackground = showOverlay && !shouldUseNonBlockingCheck;

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
        <div className="pointer-events-none absolute inset-0 z-[9998] bg-slate-900/70 backdrop-blur-sm" />
      )}

      {!isAuthRoute && checking && !needsOnboarding && (
        shouldUseNonBlockingCheck ? (
          <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex max-w-xs items-center gap-3 rounded-xl border border-teal-100 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-sm">
            <Loader2 className="h-4 w-4 animate-spin text-[#3CCED7]" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Preparing your workspace</div>
              <div className="text-xs text-gray-600">Checking your project access...</div>
            </div>
          </div>
        ) : (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-x-hidden px-4">
            <div className="bg-white rounded-xl shadow-xl border border-gray-100 px-6 py-5 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <div>
                <div className="text-sm font-semibold text-gray-900">Preparing your workspace</div>
                <div className="text-xs text-gray-600">Checking your project access...</div>
              </div>
            </div>
          </div>
        )
      )}

      {!isAuthRoute && needsOnboarding && (
        <div className="relative z-[9999] -mt-[100vh] flex min-h-screen w-full items-center justify-center px-4 py-8">
          <OnboardingWizard />
        </div>
      )}
    </div>
  );
};

export default OnboardingGate;
