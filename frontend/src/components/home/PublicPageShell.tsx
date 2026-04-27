'use client';

import React from 'react';
import { useAuthStore } from '@/lib/authStore';
import HeaderSection from '@/components/home/HeaderSection';
import FooterSection from '@/components/home/FooterSection';

type PublicPageShellProps = {
  children: React.ReactNode;
};

export default function PublicPageShell({ children }: PublicPageShellProps) {
  const { initialized, isAuthenticated, user } = useAuthStore();

  const redirectToLogin = () => {
    window.location.href = '/login';
  };

  const handleLoginClick = () => {
    if (!initialized) return;
    if (isAuthenticated) {
      window.location.href = '/profile';
      return;
    }
    window.location.href = '/login';
  };

  const handleGetStartedClick = () => {
    if (!initialized) return;
    if (isAuthenticated) {
      window.location.href = '/tasks';
      return;
    }
    window.location.href = '/login';
  };

  const displayName = user?.username || user?.email || 'User';
  const displayRole = user?.roles?.[0] || 'Member';

  return (
    <div className="min-h-screen bg-white scroll-smooth relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(60,206,215,0.10),transparent_32%),radial-gradient(circle_at_85%_20%,rgba(166,230,97,0.10),transparent_28%)]" />
      <div className="relative z-10">
        <HeaderSection
          isAuthenticated={isAuthenticated}
          displayName={displayName}
          displayRole={displayRole}
          onLoginClick={handleLoginClick}
          onGetStartedClick={handleGetStartedClick}
          onRedirectToLogin={redirectToLogin}
        />
        <main>{children}</main>
        <FooterSection />
      </div>
    </div>
  );
}
