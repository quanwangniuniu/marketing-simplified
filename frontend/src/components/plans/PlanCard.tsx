'use client';

import { useState } from 'react';
import { Info, Check, Loader2 } from 'lucide-react';

interface PlanFeature {
  category?: string; // Feature category like "TEAM", "USAGE", etc.
  label: string;
  value: string | number;
  tooltip: string;
}

interface PlanCardProps {
  name: string;
  price: number | null;
  priceLabel: string; // e.g., "Free" or "$23/mo"
  priceSubtext?: string; // e.g., "billed monthly"
  badge?: string; // e.g., "Popular"
  description: string;
  features: PlanFeature[];
  ctaText: string;
  isLast?: boolean; // indicates if this is the last card in the row
  planId?: number; // Plan ID for checkout
  stripePriceId?: string; // Stripe price ID for checkout
  onSubscribe?: (planId: number) => Promise<void>; // Callback for subscribe button click
  isCurrentPlan?: boolean; // indicates if this is the current plan
  canManagePlans?: boolean; // whether current user can act on plans (Org Admin)
}

export default function PlanCard({ name, price, priceLabel, priceSubtext, badge, description, features, ctaText, isLast, planId, stripePriceId, onSubscribe, isCurrentPlan, canManagePlans = true }: PlanCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Group features by category
  const groupedFeatures = features.reduce((acc, feat) => {
    const category = feat.category || 'FEATURES';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(feat);
    return acc;
  }, {} as Record<string, PlanFeature[]>);

  const handleSubscribe = async () => {
    if (!stripePriceId || !planId || !onSubscribe || isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      await onSubscribe(planId);
      // Reset loading state after successful action
      setIsLoading(false);
    } catch (error) {
      console.error('Error subscribing:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="relative bg-white border-r border-b border-gray-300">
      {badge && (
        <div className="absolute top-4 right-4 z-10">
          <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-full bg-green-600 text-white">{badge}</span>
        </div>
      )}

      <div>
        <div className='space-y-2 plan-card-title px-[clamp(1.25*1rem,((1.25-((1.5-1.25)/(90-20)*20))*1rem+((1.5-1.25)/(90-20))*100vw),1.5*1rem)] py-[clamp(1.25*1rem,((1.25-((1.5-1.25)/(90-20)*20))*1rem+((1.5-1.25)/(90-20))*100vw),1.5*1rem)]'>
          <div className='font-medium text-[clamp(1.25*1rem,((1.25-((1.5-1.25)/(90-20)*20))*1rem+((1.5-1.25)/(90-20))*100vw),1.5*1rem)]'>
            {name}
          </div>
          <div className='text-base font-normal h-[4.5rem]'>
            <p className='mb-4'>{description}</p>
          </div>
        </div>

        {/* Price */}
        <div className='plan-card-price px-[clamp(1.25*1rem,((1.25-((1.5-1.25)/(90-20)*20))*1rem+((1.5-1.25)/(90-20))*100vw),1.5*1rem)] pt-[clamp(1.25*1rem,((1.25-((1.5-1.25)/(90-20)*20))*1rem+((1.5-1.25)/(90-20))*100vw),1.5*1rem)]'>
          <p className='leading-[1.2] font-semibold text-[clamp(1.375*1rem,((1.375-((2-1.375)/(90-20)*20))*1rem+((2-1.375)/(90-20))*100vw),2*1rem)]'>{price === 0 ? "Free" : <>{price} <span className='text-[75%] align-top text-gray-600'>/mo</span></>}</p>
          {priceSubtext ? (
            <p className='leading-[1.6] text-sm font-normal text-gray-500'>{priceSubtext}</p>
          ) : <p className='leading-[1.6] text-sm text-gray-500'>&nbsp;</p>}
        </div>

        {/* CTA Button */}
        <div className='plan-card-cta p-[clamp(1.25*1rem,((1.25-((1.5-1.25)/(90-20)*20))*1rem+((1.5-1.25)/(90-20))*100vw),1.5*1rem)]'>
          <button
            onClick={handleSubscribe}
            disabled={isLoading || isCurrentPlan}
            className='w-full py-3 text-base font-medium rounded-lg transition-opacity bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white shadow-sm hover:opacity-95 disabled:opacity-50 disabled:bg-gray-200 disabled:bg-none disabled:cursor-not-allowed disabled:text-gray-500 flex items-center justify-center gap-2'
          >
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isCurrentPlan ? 'Current plan' : ctaText}
          </button>
        </div>

        {/* Features */}
        <div className='plan-card-features border-t border-gray-200 p-[clamp(1.25*1rem,((1.25-((1.5-1.25)/(90-20)*20))*1rem+((1.5-1.25)/(90-20))*100vw),1.5*1rem)]'>
          {/* Features grouped by category */}
          <div className="flex-1 space-y-3">
            {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
              <div key={category} className='space-y-2'>
                {/* Feature Category Title */}
                <div className="text-[.8rem] font-[550] text-gray-500 uppercase ">{category}</div>

                {/* Feature List */}
                <ul className="space-y-2">
                  {categoryFeatures.map((feat, idx) => (
                    <li key={idx} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Check className="w-5 h-5 text-green-600 mr-2" />
                        <span className="text-base text-gray-900">
                          {feat.label}: <span className="font-medium">{feat.value}</span>
                        </span>
                      </div>
                      <div className="relative">
                        <div className="group/icon">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center cursor-pointer hover:text-[#3CCED7] transition-colors">
                            <Info className="w-4 h-4 text-gray-400 group-hover/icon:text-[#3CCED7]" />
                          </div>
                          <div className="absolute right-0 bottom-6 z-100 hidden group-hover/icon:block w-56 p-2 rounded-md bg-white border border-gray-200 shadow-lg text-[12px] text-gray-700">
                            {feat.tooltip}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


