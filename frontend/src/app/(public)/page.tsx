'use client'

import React from 'react';
import { useAuthStore } from '@/lib/authStore';
import HeaderSection from '@/components/home/HeaderSection';
import HeroSection from '@/components/home/HeroSection';
import WhyMarketingSimplifiedSection from '@/components/home/WhyMarketingSimplifiedSection';
import SmartWorkflowSection from '@/components/home/SmartWorkflowSection';
import FeatureCarousel from '@/components/home/FeatureCarousel';
import HowItWorksSection from '@/components/home/HowItWorksSection';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import IntegrationsSection from '@/components/home/IntegrationsSection';
import CtaSection from '@/components/home/CtaSection';
import FooterSection from '@/components/home/FooterSection';
import AiWorkflowsSection from '@/components/home/AiWorkflowsSection';
import FeatureShowcaseSection from '@/components/home/FeatureShowcaseSection';

export default function Page() {
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
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-100/60 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-violet-100/50 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-50/60 blur-[100px]" />
      </div>

      <div className="relative z-10">
        <HeaderSection
          isAuthenticated={isAuthenticated}
          displayName={displayName}
          displayRole={displayRole}
          onLoginClick={handleLoginClick}
          onGetStartedClick={handleGetStartedClick}
          onRedirectToLogin={redirectToLogin}
        />
        <HeroSection onGetStartedClick={handleGetStartedClick} />
        <AiWorkflowsSection />
        <WhyMarketingSimplifiedSection />
        <SmartWorkflowSection />
        <FeatureCarousel />
        <FeatureShowcaseSection />
        <HowItWorksSection onGetStartedClick={handleGetStartedClick} />
        <TestimonialsSection />
        <IntegrationsSection />
        <CtaSection onGetStartedClick={handleGetStartedClick} />
        <FooterSection />
      </div>
    </div>
  );
}
