'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '../../lib/authStore';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';

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

  const isAgentRoute = pathname?.startsWith('/agent');
  const deferToAgentSkeletons = Boolean(isAgentRoute);

  // Show loading screen while initializing authentication unless the agent shell
  // should take over loading presentation for an authenticated session.
  if ((!initialized || loading) && !deferToAgentSkeletons) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}; 
