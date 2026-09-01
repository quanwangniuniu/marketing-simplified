'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '../../lib/authStore';
import toast from 'react-hot-toast';

// Props for AuthProvider component
interface AuthProviderProps {
  children: React.ReactNode;
}

// AuthProvider component that handles authentication state initialization
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { initializeAuth, hasHydrated, clearAuth } = useAuthStore();

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

  useEffect(() => {
    const handler = () => clearAuth();
    window.addEventListener('auth:session-evicted', handler);
    return () => window.removeEventListener('auth:session-evicted', handler);
  }, [clearAuth]);

  return <>{children}</>;
};
