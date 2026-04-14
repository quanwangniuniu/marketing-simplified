import React from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import AiWorkflowsSection from '../../components/home/AiWorkflowsSection';
import CtaSection from '../../components/home/CtaSection';
import FeatureCarousel from '../../components/home/FeatureCarousel';
import FeatureShowcaseSection from '../../components/home/FeatureShowcaseSection';
import FooterSection from '../../components/home/FooterSection';
import HeaderSection from '../../components/home/HeaderSection';
import HeroSection from '../../components/home/HeroSection';
import HowItWorksSection from '../../components/home/HowItWorksSection';
import IntegrationsSection from '../../components/home/IntegrationsSection';
import SmartWorkflowSection from '../../components/home/SmartWorkflowSection';
import TestimonialsSection from '../../components/home/TestimonialsSection';
import WhyMarketingSimplifiedSection from '../../components/home/WhyMarketingSimplifiedSection';

const mockRouter = {
  back: () => {},
  forward: () => {},
  prefetch: async () => {},
  push: () => {},
  refresh: () => {},
  replace: () => {},
};

const meta = {
  title: 'Home/FullPage',
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      disableSnapshot: true,
      viewports: [320, 768, 1024, 1280],
    },
    docs: {
      description: {
        component: 'Full home page layout (matches app landing page composition).',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;

export const Default = {
  render: () => {
    const handleLoginClick = () => {};
    const handleGetStartedClick = () => {};
    const redirectToLogin = () => {};

    return (
      <AppRouterContext.Provider value={mockRouter}>
        <div
          onClickCapture={(event) => {
            const target = event.target as HTMLElement | null;
            const clickable = target?.closest?.('a, button');
            if (clickable) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <div className="min-h-screen bg-white scroll-smooth relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 z-0">
              <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-100/60 blur-[120px]" />
              <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-violet-100/50 blur-[120px]" />
              <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-50/60 blur-[100px]" />
            </div>
            <div className="relative z-10">
              <HeaderSection
                isAuthenticated={false}
                displayName="User"
                displayRole="Member"
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
        </div>
      </AppRouterContext.Provider>
    );
  },
};
