'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import useAuth from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useBuildUrl } from '@/lib/buildUrl';
import AdModal from '@/components/google_ads/AdModal';
import AdTable from '@/components/google_ads/AdTable';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useGoogleAdsData } from '@/hooks/useGoogleAdsData';
import { AdCreateRequest, GoogleAd, GoogleAdsAPI } from '@/lib/api/googleAdsApi';
import { checkAdCompleteness } from '@/utils/googleAdsValidation';
import { toast } from 'react-hot-toast';

function GoogleAdsPageContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const [showModal, setShowModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [selectedAd, setSelectedAd] = useState<any>(null);
  
  const {
    ads,
    loading,
    submitting,
    fetchAds,
    createAd,
    updateAd,
    deleteAd,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    hasNext,
    hasPrevious,
    nextPage,
    previousPage,
    goToPage,
    sortBy,
    sortOrder,
    filters,
    sortByField,
    applyFilters,
    clearFilters,
  } = useGoogleAdsData();

  const layoutUser = user
    ? {
        name: user.username || 'User',
        email: user.email || '',
        role: user.roles?.[0] || 'user',
      }
    : undefined;

  const handleUserAction = async (action: string) => {
    if (action === 'settings') {
      router.push('/profile/settings');
    } else if (action === 'logout') {
      await logout();
    }
  };

  // Fetch ads on component mount
  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const handleCreateAd = async (formData: AdCreateRequest): Promise<GoogleAd> => {
    const createdAd = await createAd(formData);
    setShowModal(false);
    // Redirect to design page after creation
    router.push(buildUrl(`/google-ads/${createdAd.slug ?? createdAd.id}/design`));
    return createdAd;
  };

  const handleUpdateAd = async (formData: AdCreateRequest): Promise<GoogleAd> => {
    if (selectedAd) {
      const updatedAd = await updateAd(selectedAd.id, formData);
      setShowUpdateModal(false);
      setSelectedAd(null);
      return updatedAd;
    }
    throw new Error('No ad selected for update');
  };

  const handleViewAd = (id: number) => {
    const ad = ads.find((ad: GoogleAd) => ad.id === id);
    router.push(buildUrl(`/google-ads/${ad?.slug ?? id}`));
  };

  const handleEditAd = (id: number) => {
    const ad = ads.find((ad: GoogleAd) => ad.id === id);
    if (ad) {
      // Check completeness on frontend
      const completeness = checkAdCompleteness(ad);
      if (!completeness.is_complete) {
        // Redirect to the ad detail page (design form is embedded there) if incomplete
        router.push(buildUrl(`/google-ads/${ad.slug ?? id}`));
      } else {
        // Show update modal if complete
        setSelectedAd(ad);
        setShowUpdateModal(true);
      }
    }
  };

  const handleDeleteAd = (id: number) => {
    setDeleteTargetId(id);
    setShowDeleteModal(true);
  };

  const handlePauseAd = async (id: number) => {
    try {
      // Update ad status to PAUSED
      await GoogleAdsAPI.updateAdGlobal(id, { status: 'PAUSED' });
      
      // Show success message
      toast.success('Ad paused successfully!');
      
      // Refresh the ads list to show updated status
      await fetchAds();
    } catch (error: any) {
      console.error('Error pausing ad:', error);
      
      if (error.response?.status === 404) {
        toast.error('Ad not found');
      } else if (error.response?.status === 401) {
        toast.error('Authentication required. Please log in again.');
      } else {
        toast.error('Failed to pause ad');
      }
    }
  };

  const confirmDelete = async () => {
    if (deleteTargetId) {
      await deleteAd(deleteTargetId);
      setDeleteTargetId(null);
    }
  };

  return (
    <Layout user={layoutUser} onUserAction={handleUserAction}>
      <div className="container">
        <div className="campaigns-header">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Google Ads</h1>
            <p className="mt-2 text-gray-600">Manage your Google Ads campaigns</p>
          </div>
          <div className="campaigns-header-actions">
            <button 
              className="btn btn-primary"
              onClick={() => setShowModal(true)}
              disabled={submitting}
            >
              New Ad
            </button>
          </div>
        </div>
        
        {/* Ads Table */}
        <div className="mt-6">
          <AdTable
            ads={ads}
            loading={loading}
            onView={handleViewAd}
            onEdit={handleEditAd}
            onDelete={handleDeleteAd}
            onPause={handlePauseAd}
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            hasNext={hasNext}
            hasPrevious={hasPrevious}
            onNextPage={nextPage}
            onPreviousPage={previousPage}
            onPageChange={goToPage}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={sortByField}
            filters={filters}
            onFilterChange={applyFilters}
            onClearFilters={clearFilters}
          />
        </div>

        {/* Create Ad Modal */}
        <AdModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSubmit={handleCreateAd}
          submitting={submitting}
          mode="create"
          existingAds={ads}
        />

        {/* Update Ad Modal */}
        <AdModal
          isOpen={showUpdateModal}
          onClose={() => {
            setShowUpdateModal(false);
            setSelectedAd(null);
          }}
          onSubmit={handleUpdateAd}
          submitting={submitting}
          mode="update"
          ad={selectedAd}
          existingAds={ads}
        />

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteTargetId(null);
          }}
          onConfirm={confirmDelete}
          title="Delete Ad"
          message="Are you sure you want to delete this ad? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          loading={submitting}
        />
      </div>
    </Layout>
  );
}

export default function GoogleAdsPage() {
  return (
    <ProtectedRoute>
      <GoogleAdsPageContent />
    </ProtectedRoute>
  );
}
