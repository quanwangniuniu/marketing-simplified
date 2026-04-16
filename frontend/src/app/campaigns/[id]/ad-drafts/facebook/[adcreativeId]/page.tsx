'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Eye, Pencil } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import useAuth from '@/hooks/useAuth';
import { FacebookMetaAPI, AdCreative } from '@/lib/api/facebookMetaApi';
import EditAdCreativePage from '@/components/facebook_meta/EditAdCreativePage';
import ReviewAdCreativePage from '@/components/facebook_meta/ReviewAdCreativePage';

function AdCreativeDetailPageContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;
  const adCreativeId = params.adcreativeId as string;

  const [adCreative, setAdCreative] = useState<AdCreative | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'review'>('edit');

  const layoutUser = user
    ? { name: user.username || 'User', email: user.email || '', role: user.roles?.[0] || 'user' }
    : undefined;

  const handleUserAction = async (action: string) => {
    if (action === 'settings') router.push('/profile/settings');
    else if (action === 'logout') await logout();
  };

  useEffect(() => {
    const fetchAdCreative = async () => {
      if (!adCreativeId) return;
      try {
        setLoading(true);
        setError(null);
        const data = await FacebookMetaAPI.getAdCreative(adCreativeId);
        setAdCreative(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load ad creative details');
      } finally {
        setLoading(false);
      }
    };
    fetchAdCreative();
  }, [adCreativeId]);

  const handleBack = () => {
    router.push(`/campaigns/${campaignId}?tab=ad-drafts`);
  };

  if (loading) {
    return (
      <Layout user={layoutUser} onUserAction={handleUserAction}>
        <div className="container">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading ad creative details...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !adCreative) {
    return (
      <Layout user={layoutUser} onUserAction={handleUserAction}>
        <div className="container">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                {error ? 'Error Loading Ad Creative' : 'Ad Creative Not Found'}
              </h2>
              <p className="text-gray-600 mb-6">{error || 'The requested ad creative could not be found.'}</p>
              <button
                onClick={handleBack}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Back to Campaign
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={layoutUser} onUserAction={handleUserAction}>
      <div className="min-h-screen">
        <div className="bg-white border-b border-gray-200">
          <div className="container py-6">
            <div className="flex items-center">
              <div className="flex-1">
                <button
                  onClick={handleBack}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Campaign
                </button>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setActiveTab('edit')}
                  className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
                    activeTab === 'edit' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                  style={{ fontSize: '14px', fontWeight: 700 }}
                >
                  <Pencil className={`h-5 w-5 mr-2 ${activeTab === 'edit' ? 'text-blue-500' : 'text-gray-500'}`} />
                  Edit
                </button>
                <button
                  onClick={() => setActiveTab('review')}
                  className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
                    activeTab === 'review' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                  style={{ fontSize: '14px', fontWeight: 700 }}
                >
                  <Eye className={`h-5 w-5 mr-2 ${activeTab === 'review' ? 'text-blue-500' : 'text-gray-500'}`} />
                  Review
                </button>
              </div>

              <div className="flex-1 flex justify-end">
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 rounded-full mr-2" style={{ borderColor: '#006b4e' }}></div>
                  <span className="text-gray-700" style={{ fontSize: '14px', fontWeight: 400 }}>In Draft</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="min-h-screen"
          style={{
            backgroundImage:
              'radial-gradient(103.89% 81.75% at 95.41% 106.34%, rgb(234, 248, 239) 6%, rgba(234, 248, 239, 0) 79.68%), radial-gradient(297.85% 151.83% at -21.39% 8.81%, rgb(250, 241, 241) 0%, rgb(250, 241, 241) 15.29%, rgb(243, 237, 245) 21.39%, rgb(229, 240, 250) 40.79%)',
            backgroundColor: '#fff',
            isolation: 'isolate',
          }}
        >
          <div className="pl-3 pr-3 pt-3">
            {activeTab === 'edit' && <EditAdCreativePage adCreative={adCreative} />}
            {activeTab === 'review' && <ReviewAdCreativePage adCreative={adCreative} />}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function CampaignFacebookAdPage() {
  return (
    <ProtectedRoute>
      <AdCreativeDetailPageContent />
    </ProtectedRoute>
  );
}
