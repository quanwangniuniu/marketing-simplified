'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import useAuth from '@/hooks/useAuth';
import api from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ArrowLeft, ExternalLink } from 'lucide-react';

interface TikTokAdDraft {
  id: string;
  aid?: string;
  name?: string;
  ad_text?: string;
  call_to_action?: string;
  creative_type?: string;
  created_at: string;
  updated_at: string;
}

function TikTokAdDraftDetailContent() {
  const { id: campaignId, adDraftId } = useParams();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [draft, setDraft] = useState<TikTokAdDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const layoutUser = user
    ? { name: user.username || 'User', email: user.email || '', role: user.roles?.[0] || 'user' }
    : undefined;

  const handleUserAction = async (action: string) => {
    if (action === 'settings') router.push('/profile/settings');
    else if (action === 'logout') await logout();
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const draftId = String(adDraftId);
        const res = await api.post('/api/tiktok/creation/detail/', { ad_draft_ids: [draftId] });
        const drafts: TikTokAdDraft[] = res.data?.data?.ad_drafts || [];
        const matched = drafts.find((item) => String(item.id) === draftId) || drafts[0] || null;
        if (!matched) throw new Error('Draft not found');
        setDraft(matched);
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || 'Failed to load TikTok ad draft');
      } finally {
        setLoading(false);
      }
    };
    if (adDraftId) load();
  }, [adDraftId]);

  const handleBack = () => router.push(`/campaigns/${campaignId}?tab=ad-drafts`);

  const handleOpenEditor = () => {
    // Store the draft selection for the TikTok builder
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'tiktok-selected-ad-selection',
        JSON.stringify({ adDraftId: String(adDraftId), groupId: draft?.id || null })
      );
    }
    router.push('/tiktok');
  };

  if (loading) {
    return (
      <Layout user={layoutUser} onUserAction={handleUserAction}>
        <div className="container"><LoadingSpinner /></div>
      </Layout>
    );
  }

  if (error || !draft) {
    return (
      <Layout user={layoutUser} onUserAction={handleUserAction}>
        <div className="container p-6">
          <button onClick={handleBack} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Campaign
          </button>
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error || 'Ad draft not found.'}</p>
          </div>
        </div>
      </Layout>
    );
  }

  const formatDate = (s?: string) =>
    s ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(s)) : '-';

  return (
    <Layout user={layoutUser} onUserAction={handleUserAction}>
      <div className="container p-6">
        <button onClick={handleBack} className="flex items-center text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Campaign
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{draft.name || 'Untitled TikTok Draft'}</h1>
          <button
            onClick={handleOpenEditor}
            className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Open in TikTok Editor
          </button>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Draft Details</h3>
          </div>
          <div className="border-t border-gray-200">
            <dl>
              {[
                { label: 'Draft ID', value: draft.aid || draft.id, bg: true },
                { label: 'Name', value: draft.name || '-', bg: false },
                { label: 'Ad Text', value: draft.ad_text || '-', bg: true },
                { label: 'Call to Action', value: draft.call_to_action || '-', bg: false },
                { label: 'Creative Type', value: draft.creative_type || '-', bg: true },
                { label: 'Created At', value: formatDate(draft.created_at), bg: false },
                { label: 'Updated At', value: formatDate(draft.updated_at), bg: true },
              ].map(({ label, value, bg }) => (
                <div key={label} className={`${bg ? 'bg-gray-50' : 'bg-white'} px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6`}>
                  <dt className="text-sm font-medium text-gray-500">{label}</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function CampaignTikTokAdDraftPage() {
  return (
    <ProtectedRoute>
      <TikTokAdDraftDetailContent />
    </ProtectedRoute>
  );
}
