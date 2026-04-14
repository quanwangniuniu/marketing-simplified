'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useCampaignData } from '@/hooks/useCampaignData';
import CampaignTable from '@/components/campaigns/CampaignTable';
import CampaignFilters from '@/components/campaigns/CampaignFilters';
import CreateCampaignModal from '@/components/campaigns/CreateCampaignModal';
import CreateCampaignFromTemplateModal from '@/components/campaigns/CreateCampaignFromTemplateModal';
import Button from '@/components/button/Button';
import { Plus, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CampaignsPage() {
  const router = useRouter();
  const { campaigns, loading, error, fetchCampaigns } = useCampaignData();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createFromTemplateModalOpen, setCreateFromTemplateModalOpen] = useState(false);

  // Fetch campaigns on mount and when filters change
  useEffect(() => {
    const params: any = {};
    
    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }
    
    if (statusFilter && statusFilter !== 'all') {
      params.status = statusFilter;
    }

    fetchCampaigns(params).catch((err) => {
      console.error('Failed to fetch campaigns:', err);
      toast.error('Failed to load campaigns');
    });
  }, [searchQuery, statusFilter, fetchCampaigns]);

  // Filter campaigns client-side as well (for immediate feedback)
  const filteredCampaigns = campaigns.filter((campaign) => {
    // Status filter
    if (statusFilter && statusFilter !== 'all' && campaign.status !== statusFilter) {
      return false;
    }

    // Search filter (name and hypothesis)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesName = campaign.name?.toLowerCase().includes(query);
      const matchesHypothesis = campaign.hypothesis?.toLowerCase().includes(query);
      if (!matchesName && !matchesHypothesis) {
        return false;
      }
    }

    return true;
  });

  const handleCreateClick = () => {
    setCreateModalOpen(true);
  };

  const handleCampaignClick = (campaign: any) => {
    router.push(`/campaigns/${campaign.id}`);
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage and track your advertising campaigns
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setCreateFromTemplateModalOpen(true)}
                leftIcon={<FileText className="h-4 w-4" />}
              >
                From Template
              </Button>
              <Button onClick={handleCreateClick} leftIcon={<Plus className="h-4 w-4" />}>
                Create Campaign
              </Button>
            </div>
          </div>

          {/* Filters */}
          <CampaignFilters
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            onSearchChange={setSearchQuery}
            onStatusChange={setStatusFilter}
          />

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading campaigns...</span>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <p className="text-red-800">Failed to load campaigns. Please try again.</p>
            </div>
          )}

          {/* Campaign Table */}
          {!loading && !error && (
            <CampaignTable
              campaigns={filteredCampaigns}
              onCampaignClick={handleCampaignClick}
            />
          )}

          {/* Empty State */}
          {!loading && !error && filteredCampaigns.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {campaigns.length === 0
                  ? 'No campaigns yet. Create your first campaign to get started.'
                  : 'No campaigns match your filters.'}
              </p>
              {campaigns.length === 0 && (
                <Button onClick={handleCreateClick} leftIcon={<Plus className="h-4 w-4" />}>
                  Create Campaign
                </Button>
              )}
            </div>
          )}

          {/* Create Campaign Modal */}
          <CreateCampaignModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />

          {/* Create Campaign from Template Modal */}
          <CreateCampaignFromTemplateModal
            isOpen={createFromTemplateModalOpen}
            onClose={() => setCreateFromTemplateModalOpen(false)}
          />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

