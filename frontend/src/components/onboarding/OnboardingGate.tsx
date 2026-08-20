'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useBuildUrl } from '@/lib/buildUrl';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useAuthStore } from '@/lib/authStore';
import OnboardingProjectChooser from './OnboardingProjectChooser';
import OnboardingWizard from './OnboardingWizard';

type OnboardingOverlayMode = 'chooser' | 'classic';

const OnboardingGate = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const buildUrl = useBuildUrl();
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
  const isPublicSeoRoute =
    pathname?.startsWith('/docs') ||
    pathname === '/product' ||
    pathname === '/solutions' ||
    pathname === '/pricing' ||
    pathname === '/policy';
  const isQuickStartRoute = pathname?.startsWith('/projects/quick-start');
  const { needsOnboarding, checking } = useOnboarding();
  const [overlayMode, setOverlayMode] = useState<OnboardingOverlayMode>('chooser');

  const shouldShowOnboardingOverlay =
    !isAuthRoute &&
    !isRootRoute &&
    !isPublicSeoRoute &&
    !isQuickStartRoute &&
    needsOnboarding;

  const shouldShowBlockingCheck = false;
  const shouldBlockBackground = shouldShowOnboardingOverlay || shouldShowBlockingCheck;

  useEffect(() => {
    if (!needsOnboarding) {
      setOverlayMode('chooser');
    }
  }, [needsOnboarding]);

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

      {shouldShowOnboardingOverlay && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto px-4 py-8">
          {overlayMode === 'chooser' ? (
            <OnboardingProjectChooser
              onQuickStart={() => router.push(buildUrl('/projects/quick-start'))}
              onClassic={() => setOverlayMode('classic')}
            />
          ) : (
            <OnboardingWizard onExit={() => setOverlayMode('chooser')} />
          )}
        </div>
      )}
    </div>
  );
};

export default OnboardingGate;
