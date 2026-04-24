'use client';

import OrganizationPlans from './OrganizationPlans';

interface PlansSectionProps {
  showHeader?: boolean;
  loading?: boolean;
}

export default function PlansSection({
  showHeader = true,
  loading = false,
}: PlansSectionProps) {
  return (
    <div>
      {/* Page Header */}
      {showHeader && (
        <div className="plan-header py-[clamp(3rem,calc((3-((5-3)/(90-20))*20)*1rem+((5-3)/(90-20))*100vw),5rem)]">
          <div className="plan-header-container max-w-[1440px] w-[90%] mx-auto">
            <div className="max-w-[80ch]">
              <p
                className="font-medium text-[#5a5a5a] mb-[clamp(calc(.625*1rem),calc((.625-((1-.625)/(90-20)*20))*1rem+((1-.625)/(90-20))*100vw),1rem)] text-[clamp(calc(1.125*1rem),calc((1.125-((1.25-1.125)/(90-20)*20))*1rem+((1.25-1.125)/(90-20))*100vw),1.25rem)] transform-gpu will-change-[transform,opacity]"
                style={{
                  animationName: 'scale',
                  animationDuration: '0.75s',
                  animationDelay: '0s',
                  animationFillMode: 'both',
                  animationTimingFunction: 'cubic-bezier(0.455, 0.03, 0.515, 0.955)',
                }}
              >
                Our pricing
              </p>
              <h1
                className="font-semibold leading-[1.04] text-[clamp(calc(2.75*1rem),calc((2.75-((5-2.75)/(90-20)*20))*1rem+((5-2.75)/(90-20))*100vw),5rem)] transform-gpu will-change-[transform,opacity]"
                style={{
                  fontFamily: "'WF Visual Sans Variable', Arial, sans-serif",
                  animationName: 'scale',
                  animationDuration: '1.2s',
                  animationDelay: '0.3s',
                  animationFillMode: 'both',
                  animationTimingFunction: 'cubic-bezier(0.455, 0.03, 0.515, 0.955)',
                }}
              >
                Get started with Marketing Simplified
              </h1>
            </div>
          </div>
        </div>
      )}
      <OrganizationPlans loading={loading} />
    </div>
  );
}
