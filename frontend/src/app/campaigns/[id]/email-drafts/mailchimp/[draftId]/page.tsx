'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Nested route: /campaigns/[id]/email-drafts/mailchimp/[draftId]
 * Redirects to the Mailchimp editor with returnTo pointing back to this campaign's
 * Email Drafts tab, so the back button returns to the correct campaign view.
 */
export default function CampaignMailchimpDraftPage() {
  const { id: campaignId, draftId } = useParams();
  const router = useRouter();

  useEffect(() => {
    const returnTo = `/campaigns/${campaignId}?tab=email-drafts`;
    router.replace(`/mailchimp/${draftId}?returnTo=${encodeURIComponent(returnTo)}`);
  }, [campaignId, draftId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
