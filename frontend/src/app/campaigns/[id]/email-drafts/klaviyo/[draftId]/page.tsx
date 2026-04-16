'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Nested route: /campaigns/[id]/email-drafts/klaviyo/[draftId]
 * Redirects to the Klaviyo editor with returnTo pointing back to this campaign's
 * Email Drafts tab.
 */
export default function CampaignKlaviyoDraftPage() {
  const { id: campaignId, draftId } = useParams();
  const router = useRouter();

  useEffect(() => {
    const returnTo = `/campaigns/${campaignId}?tab=email-drafts`;
    router.replace(`/klaviyo/${draftId}?returnTo=${encodeURIComponent(returnTo)}`);
  }, [campaignId, draftId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
