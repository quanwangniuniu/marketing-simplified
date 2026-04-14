'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CampaignObjective, CampaignPlatform } from '@/types/campaign';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useCampaignData } from '@/hooks/useCampaignData';
import CampaignHeader from '@/components/campaigns/CampaignHeader';
import ActivityTimeline from '@/components/campaigns/ActivityTimeline';
import CampaignCheckIns from '@/components/campaigns/CampaignCheckIns';
import CampaignSnapshots from '@/components/campaigns/CampaignSnapshots';
import CampaignStatusHistory from '@/components/campaigns/CampaignStatusHistory';
import ChangeStatusModal from '@/components/campaigns/ChangeStatusModal';
import CreateCheckInModal from '@/components/campaigns/CreateCheckInModal';
import EditCheckInModal from '@/components/campaigns/EditCheckInModal';
import CreateSnapshotModal from '@/components/campaigns/CreateSnapshotModal';
import EditSnapshotModal from '@/components/campaigns/EditSnapshotModal';
import CampaignTasks from '@/components/campaigns/CampaignTasks';
import SaveAsTemplateModal from '@/components/campaigns/SaveAsTemplateModal';
import Button from '@/components/button/Button';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;
  const { currentCampaign, loading, error, fetchCampaign, updateCampaign } = useCampaignData();
  const [changeStatusModalOpen, setChangeStatusModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [createCheckInModalOpen, setCreateCheckInModalOpen] = useState(false);
  const [editCheckInModalOpen, setEditCheckInModalOpen] = useState(false);
  const [selectedCheckIn, setSelectedCheckIn] = useState<any>(null);
  const [checkInsRefreshKey, setCheckInsRefreshKey] = useState(0);
  const [createSnapshotModalOpen, setCreateSnapshotModalOpen] = useState(false);
  const [editSnapshotModalOpen, setEditSnapshotModalOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any>(null);
  const [snapshotsRefreshKey, setSnapshotsRefreshKey] = useState(0);
  const [saveAsTemplateModalOpen, setSaveAsTemplateModalOpen] = useState(false);

  useEffect(() => {
    if (campaignId) {
      fetchCampaign(campaignId).catch((err) => {
        console.error('Failed to fetch campaign:', err);
        toast.error('Failed to load campaign');
      });
    }
  }, [campaignId, fetchCampaign]);

  const handleUpdate = async (data: {
    name?: string;
    objective?: CampaignObjective;
    platforms?: CampaignPlatform[];
    start_date?: string;
    end_date?: string;
    hypothesis?: string;
    owner_id?: number;
  }) => {
    if (!campaignId) return;

    try {
      await updateCampaign(campaignId, data);
      toast.success('Campaign updated successfully');
      // Refresh campaign data to get updated values
      await fetchCampaign(campaignId);
    } catch (err: any) {
      console.error('Failed to update campaign:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update campaign';
      toast.error(errorMessage);
      throw err; // Re-throw to let InlineEditController handle it
    }
  };

  const handleBack = () => {
    router.push('/campaigns');
  };

  const handleStatusChangeSuccess = () => {
    // Refresh campaign data and status history
    fetchCampaign(campaignId).catch((err) => {
      console.error('Failed to refresh campaign:', err);
    });
    // Force refresh of status history component
    setRefreshKey((prev) => prev + 1);
    toast.success('Campaign status updated successfully');
  };

  const handleCheckInEdit = (checkIn: any) => {
    if (currentCampaign?.status === 'ARCHIVED') {
      toast.error('Archived campaigns cannot be edited. Use restore() to move back to Completed status.');
      return;
    }
    if (checkIn && checkIn.id) {
      // Edit mode
      setSelectedCheckIn(checkIn);
      setEditCheckInModalOpen(true);
    }
  };

  const handleCheckInCreate = () => {
    if (currentCampaign?.status === 'ARCHIVED') {
      toast.error('Archived campaigns cannot be edited. Use restore() to move back to Completed status.');
      return;
    }
    setCreateCheckInModalOpen(true);
  };

  const handleCheckInSuccess = () => {
    // Refresh check-ins list
    setCheckInsRefreshKey((prev) => prev + 1);
  };

  const handleSnapshotEdit = (snapshot: any) => {
    if (currentCampaign?.status === 'ARCHIVED') {
      toast.error('Archived campaigns cannot be edited. Use restore() to move back to Completed status.');
      return;
    }
    if (snapshot && snapshot.id) {
      // Edit mode
      setSelectedSnapshot(snapshot);
      setEditSnapshotModalOpen(true);
    }
  };

  const handleSnapshotCreate = () => {
    if (currentCampaign?.status === 'ARCHIVED') {
      toast.error('Archived campaigns cannot be edited. Use restore() to move back to Completed status.');
      return;
    }
    setCreateSnapshotModalOpen(true);
  };

  const handleSnapshotSuccess = () => {
    // Refresh snapshots list
    setSnapshotsRefreshKey((prev) => prev + 1);
  };

  const handleSnapshotDelete = () => {
    // Refresh snapshots list after delete
    setSnapshotsRefreshKey((prev) => prev + 1);
  };

  if (loading) {
  return (
      <ProtectedRoute>
        <Layout>
          <div className="p-6">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading campaign...</span>
            </div>
            </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (error || !currentCampaign) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="p-6">
            <Button
              variant="secondary"
              onClick={handleBack}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              className="mb-4"
            >
              Back to Campaigns
            </Button>
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800">
                {error?.response?.data?.error || error?.message || 'Failed to load campaign'}
              </p>
        </div>
      </div>
    </Layout>
      </ProtectedRoute>
  );
}

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          {/* Back Button */}
          <Button
            variant="secondary"
            onClick={handleBack}
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            className="mb-4"
          >
            Back to Campaigns
          </Button>

          {/* Campaign Header */}
          <CampaignHeader
            campaign={currentCampaign}
            onUpdate={handleUpdate}
            loading={loading}
            onChangeStatus={() => setChangeStatusModalOpen(true)}
            onSaveAsTemplate={() => setSaveAsTemplateModalOpen(true)}
          />

          {/* Performance Snapshots */}
          <CampaignSnapshots
            campaignId={campaignId}
            onEdit={handleSnapshotEdit}
            onDelete={handleSnapshotDelete}
            onCreate={handleSnapshotCreate}
            refreshTrigger={snapshotsRefreshKey}
            isArchived={currentCampaign?.status === 'ARCHIVED'}
          />

          {/* Activity Timeline */}
          <ActivityTimeline campaignId={campaignId} />

          {/* Check-ins */}
          <CampaignCheckIns
            campaignId={campaignId}
            onEdit={handleCheckInEdit}
            onDelete={handleCheckInSuccess}
            onCreate={handleCheckInCreate}
            refreshTrigger={checkInsRefreshKey}
            isArchived={currentCampaign?.status === 'ARCHIVED'}
          />

          {/* Status History */}
          <CampaignStatusHistory key={refreshKey} campaignId={campaignId} />

          {/* Related Tasks */}
          <CampaignTasks campaignId={campaignId} />

          {/* Change Status Modal */}
          {currentCampaign && (
            <ChangeStatusModal
              isOpen={changeStatusModalOpen}
              onClose={() => setChangeStatusModalOpen(false)}
              campaign={currentCampaign}
              onSuccess={handleStatusChangeSuccess}
            />
          )}

          {/* Create Check-in Modal */}
          <CreateCheckInModal
            isOpen={createCheckInModalOpen}
            onClose={() => setCreateCheckInModalOpen(false)}
            campaignId={campaignId}
            onSuccess={handleCheckInSuccess}
          />

          {/* Edit Check-in Modal */}
          <EditCheckInModal
            isOpen={editCheckInModalOpen}
            onClose={() => {
              setEditCheckInModalOpen(false);
              setSelectedCheckIn(null);
            }}
            campaignId={campaignId}
            checkIn={selectedCheckIn}
            onSuccess={handleCheckInSuccess}
          />

          {/* Create Snapshot Modal */}
          <CreateSnapshotModal
            isOpen={createSnapshotModalOpen}
            onClose={() => setCreateSnapshotModalOpen(false)}
            campaignId={campaignId}
            onSuccess={handleSnapshotSuccess}
          />

          {/* Edit Snapshot Modal */}
          <EditSnapshotModal
            isOpen={editSnapshotModalOpen}
            onClose={() => {
              setEditSnapshotModalOpen(false);
              setSelectedSnapshot(null);
            }}
            campaignId={campaignId}
            snapshot={selectedSnapshot}
            onSuccess={handleSnapshotSuccess}
            onDelete={handleSnapshotDelete}
          />

          {/* Save as Template Modal */}
          <SaveAsTemplateModal
            isOpen={saveAsTemplateModalOpen}
            onClose={() => setSaveAsTemplateModalOpen(false)}
            campaignId={campaignId}
            campaignName={currentCampaign.name}
          />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

