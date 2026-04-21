'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../lib/authStore';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { getAuthLoadingRoutePolicy } from '@/lib/authLoadingPolicy';

// Props for AuthProvider component
interface AuthProviderProps {
  children: React.ReactNode;
}

const AUTH_BOOT_MIN_SPINNER_MS = 1800;

// AuthProvider component that handles authentication state initialization
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { initializeAuth, loading, initialized, hasHydrated } = useAuthStore();
  const pathname = usePathname();
  const [shouldRenderSpinner, setShouldRenderSpinner] = useState(false);
  const spinnerStartedAtRef = useRef<number | null>(null);

  // Initialize authentication state on component mount
  useEffect(() => {
    if (!hasHydrated) return;

    const initAuth = async () => {
      try {
        await initializeAuth();
      } catch (error) {
        console.error('Failed to initialize authentication:', error);
        toast.error('Failed to initialize authentication');
      }
    };

    initAuth();
  }, [initializeAuth, hasHydrated]);

  const { deferGlobalAuthBlock } = getAuthLoadingRoutePolicy(pathname);
  const shouldDeferGlobalBlocking = Boolean(deferGlobalAuthBlock);
  const shouldShowBlockingSpinner =
    (!initialized || loading) && !shouldDeferGlobalBlocking;

  useEffect(() => {
    if (shouldShowBlockingSpinner) {
      if (spinnerStartedAtRef.current === null) {
        spinnerStartedAtRef.current = Date.now();
      }
      setShouldRenderSpinner(true);
      return;
    }

    if (!shouldRenderSpinner) {
      spinnerStartedAtRef.current = null;
      return;
    }

    const elapsed = spinnerStartedAtRef.current
      ? Date.now() - spinnerStartedAtRef.current
      : AUTH_BOOT_MIN_SPINNER_MS;
    const remaining = Math.max(0, AUTH_BOOT_MIN_SPINNER_MS - elapsed);

    const timeoutId = window.setTimeout(() => {
      setShouldRenderSpinner(false);
      spinnerStartedAtRef.current = null;
    }, remaining);

    return () => window.clearTimeout(timeoutId);
  }, [shouldRenderSpinner, shouldShowBlockingSpinner]);

  return (
    <div className="relative min-h-screen">
      <div
        className={`min-h-screen transition duration-200 ${
          shouldRenderSpinner ? 'pointer-events-none select-none blur-sm overflow-hidden' : ''
        }`}
      >
        {children}
      </div>

      {shouldRenderSpinner && (
        <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-white/30 backdrop-blur-md">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/35 backdrop-blur-sm">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[rgba(60,206,215,0.22)] border-r-[rgba(60,206,215,0.72)] border-t-[rgba(166,230,97,0.9)]" />
          </div>
        </div>
      )}
    </div>
  );
}; 
