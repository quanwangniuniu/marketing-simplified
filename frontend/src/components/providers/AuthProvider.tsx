'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '../../lib/authStore';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { getAuthLoadingRoutePolicy } from '@/lib/authLoadingPolicy';

// Props for AuthProvider component
interface AuthProviderProps {
  children: React.ReactNode;
}

// AuthProvider component that handles authentication state initialization
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { initializeAuth, loading, initialized, hasHydrated } = useAuthStore();
  const pathname = usePathname();

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

  return (
    <div className="relative min-h-screen">
      <div
        className={`min-h-screen transition duration-200 ${
          shouldShowBlockingSpinner ? 'pointer-events-none select-none blur-sm overflow-hidden' : ''
        }`}
      >
        {children}
      </div>

      {shouldShowBlockingSpinner && (
        <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-white/30 backdrop-blur-md">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/35 backdrop-blur-sm">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[rgba(60,206,215,0.22)] border-r-[rgba(60,206,215,0.72)] border-t-[rgba(166,230,97,0.9)]" />
          </div>
        </div>
      )}
    </div>
  );
};
