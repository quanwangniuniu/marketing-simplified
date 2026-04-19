'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Nested route: /campaigns/[id]/ad-drafts/google/[adId]/design
 * Redirects to the Google Ads design editor with returnTo pointing back to
 * this campaign's Ad Drafts tab.
 */
export default function CampaignGoogleAdsDesignPage() {
  const { id: campaignId, adId } = useParams();
  const router = useRouter();

  useEffect(() => {
    const returnTo = `/campaigns/${campaignId}?tab=ad-drafts`;
    router.replace(
      `/google_ads/${adId}/design?returnTo=${encodeURIComponent(returnTo)}`
    );
  }, [campaignId, adId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
