'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import useAuth from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useBuildUrl } from '@/lib/buildUrl';
import AdCreativeModal from '@/components/facebook_meta/AdCreativeModal';
import AdCreativeTable from '@/components/facebook_meta/AdCreativeTable';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useFacebookMetaData } from '@/hooks/useFacebookMetaData';

function FacebookMetaPageContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const [showModal, setShowModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [selectedAdCreative, setSelectedAdCreative] = useState<any>(null);
  
  const {
    adCreatives,
    loading,
    submitting,
    fetchAdCreatives,
    createAdCreative,
    updateAdCreative,
    deleteAdCreative,
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
  } = useFacebookMetaData();

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

  // Fetch ad creatives on component mount
  useEffect(() => {
    fetchAdCreatives();
  }, [fetchAdCreatives]);

  const handleCreateAdCreative = async (formData: any) => {
    await createAdCreative(formData);
    setShowModal(false);
  };

  const handleUpdateAdCreative = async (formData: any) => {
    if (selectedAdCreative) {
      await updateAdCreative(selectedAdCreative.id, formData);
      setShowUpdateModal(false);
      setSelectedAdCreative(null);
    }
  };

  const handleViewCreative = (id: string) => {
    const adCreative = adCreatives.find(creative => creative.id === id);
    router.push(buildUrl(`/facebook-meta/${adCreative?.slug ?? id}`));
  };

  const handleEditCreative = (id: string) => {
    const adCreative = adCreatives.find(creative => creative.id === id);
    if (adCreative) {
      setSelectedAdCreative(adCreative);
      setShowUpdateModal(true);
    }
  };

  const handleDeleteCreative = (id: string) => {
    setDeleteTargetId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (deleteTargetId) {
      await deleteAdCreative(deleteTargetId);
      setDeleteTargetId(null);
    }
  };

  return (
    <Layout user={layoutUser} onUserAction={handleUserAction}>
      <div className="container">
        <div className="campaigns-header">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Facebook Meta Ad Creatives</h1>
          </div>
          <div className="campaigns-header-actions">
            <button 
              className="btn btn-primary"
              onClick={() => setShowModal(true)}
              disabled={submitting}
            >
              New Ad Creative
            </button>
          </div>
        </div>
        
        {/* Ad Creatives Table */}
        <div className="mt-6">
          <AdCreativeTable
            creatives={adCreatives}
            loading={loading}
            onView={handleViewCreative}
            onEdit={handleEditCreative}
            onDelete={handleDeleteCreative}
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

        {/* Ad Creative Modal */}
        <AdCreativeModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSubmit={handleCreateAdCreative}
          submitting={submitting}
        />

        {/* Update Ad Creative Modal */}
        <AdCreativeModal
          isOpen={showUpdateModal}
          onClose={() => {
            setShowUpdateModal(false);
            setSelectedAdCreative(null);
          }}
          onSubmit={handleUpdateAdCreative}
          submitting={submitting}
          mode="update"
          adCreative={selectedAdCreative}
        />

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteTargetId(null);
          }}
          onConfirm={confirmDelete}
          title="Delete Ad Creative"
          message="Are you sure you want to delete this ad creative? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          loading={submitting}
        />
      </div>
    </Layout>
  );
}

export default function FacebookMetaPage() {
  return (
    <ProtectedRoute>
      <FacebookMetaPageContent />
    </ProtectedRoute>
  );
}