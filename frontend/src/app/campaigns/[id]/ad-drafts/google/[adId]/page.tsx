'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import useAuth from '@/hooks/useAuth';
import { useGoogleAdsData } from '@/hooks/useGoogleAdsData';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function GoogleAdsDetailPageContent() {
  const { adId, id: campaignId } = useParams();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { currentAd, loading, fetchAd } = useGoogleAdsData();

  const layoutUser = user
    ? { name: user.username || 'User', email: user.email || '', role: user.roles?.[0] || 'user' }
    : undefined;

  const handleUserAction = async (action: string) => {
    if (action === 'settings') router.push('/profile/settings');
    else if (action === 'logout') await logout();
  };

  useEffect(() => {
    if (adId) fetchAd(parseInt(adId as string));
  }, [adId, fetchAd]);

  const handleBack = () => router.push(`/campaigns/${campaignId}?tab=ad-drafts`);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(dateString));
  };

  const getStatusDisplay = (status?: string) => {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getTypeDisplay = (type?: string) => {
    if (!type) return 'Unknown';
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING_REVIEW: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      REJECTED: 'bg-red-100 text-red-800',
      PUBLISHED: 'bg-green-100 text-green-800',
    };
    return colors[status || ''] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <Layout user={layoutUser} onUserAction={handleUserAction}>
        <div className="container"><LoadingSpinner /></div>
      </Layout>
    );
  }

  if (!currentAd) {
    return (
      <Layout user={layoutUser} onUserAction={handleUserAction}>
        <div className="container">
          <h1 className="text-3xl font-bold text-gray-900">Ad Not Found</h1>
          <p className="mt-2 text-gray-600">The requested ad could not be found.</p>
          <button onClick={handleBack} className="btn btn-secondary mt-4">Back to Campaign</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={layoutUser} onUserAction={handleUserAction}>
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Ad Details: {currentAd.name || 'Unnamed Ad'}
          </h1>
          <div className="flex gap-2">
            <button onClick={handleBack} className="btn btn-secondary">Back to Campaign</button>
            <button
              onClick={() => router.push(`/campaigns/${campaignId}/ad-drafts/google/${adId}/design`)}
              className="btn btn-primary"
            >
              Edit Design
            </button>
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Ad Information</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Details about the Google Ad.</p>
          </div>
          <div className="border-t border-gray-200">
            <dl>
              {[
                { label: 'Ad ID', value: currentAd.id, bg: true },
                { label: 'Name', value: currentAd.name || '-', bg: false },
                {
                  label: 'Status', bg: true,
                  value: (
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(currentAd.status)}`}>
                      {getStatusDisplay(currentAd.status)}
                    </span>
                  ),
                },
                { label: 'Ad Type', value: getTypeDisplay(currentAd.type), bg: false },
                { label: 'Resource Name', value: <span className="font-mono">{(currentAd as any).resource_name || '-'}</span>, bg: true },
                { label: 'Google Ads ID', value: currentAd.google_ads_id || '-', bg: false },
                { label: 'Created At', value: formatDate(currentAd.created_at), bg: true },
                { label: 'Updated At', value: formatDate(currentAd.updated_at), bg: false },
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

export default function CampaignGoogleAdsDetailPage() {
  return (
    <ProtectedRoute>
      <GoogleAdsDetailPageContent />
    </ProtectedRoute>
  );
}
