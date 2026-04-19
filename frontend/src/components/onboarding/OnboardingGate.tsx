'use client';

import React from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useAuthStore } from '@/lib/authStore';
// Legacy blue-CTA modal wizard. Replaced by redirect to /select-project,
// which uses the new QuickCreateProjectModal aligned with brand teal/lime gradient.
// Keep the file untouched so the flow can be restored if the new card-based
// onboarding needs to fall back to a multi-step wizard later.
// import OnboardingWizard from './OnboardingWizard';
import { getAuthLoadingRoutePolicy } from '@/lib/authLoadingPolicy';

const OnboardingGate = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
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
  const isSelectProjectRoute = pathname?.startsWith('/select-project');
  const isAcceptInvitationRoute = pathname?.startsWith('/accept-invitation');
  const { needsOnboarding, checking } = useOnboarding();
  const { delegateOnboardingCheckLoadingToRoute } =
    getAuthLoadingRoutePolicy(pathname);
  // When the user has no project, send them to /select-project (new card flow)
  // instead of opening the legacy modal wizard. Skip the redirect when the user
  // is already on /select-project or /accept-invitation to avoid a render loop.
  const shouldRedirectToSelectProject =
    !isAuthRoute &&
    !isSelectProjectRoute &&
    !isAcceptInvitationRoute &&
    needsOnboarding;
  // Legacy "Preparing your workspace" blue spinner. Each page already shows its
  // own skeleton/loading via dashboard-v2 components, so this gate-level
  // overlay is double UX. Kept as a computed flag for the commented block below
  // so the logic can be restored if needed.
  const shouldShowBlockingCheck = false; // was: !isAuthRoute && checking && !needsOnboarding && !delegateOnboardingCheckLoadingToRoute;
  const shouldBlockBackground = shouldRedirectToSelectProject;

  useEffect(() => {
    // Requirement: after signup, entering localhost should reset to logged-out
    // while staying on localhost (no redirect to /login).
    if (!isRootRoute || checking || !needsOnboarding) return;
    clearAuth();
  }, [checking, clearAuth, isRootRoute, needsOnboarding]);

  useEffect(() => {
    if (shouldRedirectToSelectProject) {
      router.replace('/select-project');
    }
  }, [shouldRedirectToSelectProject, router]);

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

      {/*
        Legacy blue "Preparing your workspace" overlay — commented out per G-09.
        Page-level skeletons (dashboard-v2 + tasks-v2) already cover the brief
        check window, and showing two overlays in a row was jarring.

        {shouldShowBlockingCheck && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-x-hidden px-4">
            <div className="rounded-xl border border-white/40 bg-white/35 px-6 py-5 shadow-xl backdrop-blur-sm flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <div>
                <div className="text-sm font-semibold text-gray-900">Preparing your workspace</div>
                <div className="text-xs text-gray-600">Checking your project access...</div>
              </div>
            </div>
          </div>
        )}
      */}

      {shouldRedirectToSelectProject && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-x-hidden px-4">
          <div className="flex min-w-[280px] items-center gap-3 rounded-xl border border-white/40 bg-white/40 px-6 py-5 shadow-xl backdrop-blur-md">
            <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-[#3CCED7]" />
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Just a moment — setting up your workspace
              </div>
              <div className="mt-0.5 text-xs text-gray-600">
                We&apos;re taking you to project setup so you can pick or create a project.
              </div>
            </div>
          </div>
        </div>
      )}

      {/*
        Legacy 6-step onboarding wizard mount — replaced by redirect above.
        Kept here as a comment so the flow can be restored if needed.

        {shouldShowOnboardingWizard && (
          <div className="relative z-[9999] -mt-[100vh] flex min-h-screen w-full items-center justify-center px-4 py-8">
            <OnboardingWizard />
          </div>
        )}
      */}
    </div>
  );
};

export default OnboardingGate;
