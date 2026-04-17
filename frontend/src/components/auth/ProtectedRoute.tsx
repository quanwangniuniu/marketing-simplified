'use client';

import React from 'react';
import { useAuthStore } from '../../lib/authStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Props for ProtectedRoute component
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredAuth?: boolean; // Whether authentication is required
  requiredRoles?: string[]; // Required roles for access
  fallback?: string; // Redirect path if access is denied
  loadingComponent?: React.ReactNode; // Custom loading component
}

// ProtectedRoute component that handles authentication and role-based access control
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredAuth = true,
  requiredRoles = [],
  fallback = '/login',
  loadingComponent
}) => {
  const { isAuthenticated, user, loading, initialized } = useAuthStore();
  const router = useRouter();

  const hasRequiredRoles =
    requiredRoles.length === 0 ||
    Boolean(user?.roles && requiredRoles.some(role => user.roles.includes(role)));

  // Handle authentication and role checks
  useEffect(() => {
    // Wait for authentication to be initialized
    if (!initialized || loading) return;

    // If authentication is required but user is not authenticated
    if (requiredAuth && !isAuthenticated) {
      router.push(fallback);
      return;
    }

    // If roles are required but user doesn't have them
    if (requiredRoles.length > 0 && !hasRequiredRoles) {
      // Redirect to unauthorized page or show error
      router.push('/unauthorized');
      return;
    }
  }, [isAuthenticated, initialized, loading, requiredAuth, requiredRoles, router, fallback, hasRequiredRoles]);

  // Show loading while authentication is being initialized
  if (!initialized || loading) {
    return loadingComponent ? <>{loadingComponent}</> : null;
  }

  // If authentication is required but user is not authenticated, don't render children
  if (requiredAuth && !isAuthenticated) {
    return null;
  }

  // If roles are required but user doesn't have them, don't render children
  if (requiredRoles.length > 0 && !hasRequiredRoles) {
    return null;
  }

  // Render children if all checks pass
  return <>{children}</>;
}; 
