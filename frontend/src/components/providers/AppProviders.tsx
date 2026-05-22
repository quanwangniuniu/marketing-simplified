'use client';

import type { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './AuthProvider';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import OnboardingGate from '@/components/onboarding/OnboardingGate';
import { TrackingProvider } from '@/lib/tracking/TrackingProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TrackingProvider>
        <OnboardingProvider>
          <OnboardingGate>{children}</OnboardingGate>
        </OnboardingProvider>
      </TrackingProvider>
      <Toaster
        position="top-right"
        containerStyle={{
          zIndex: 999999,
        }}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </AuthProvider>
  );
}
