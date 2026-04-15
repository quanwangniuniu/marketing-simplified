'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
import AdVariationManagement from '@/components/ad-variations/AdVariationManagement';
import Button from '@/components/button/Button';
import { ArrowLeft, Target, Mail, Tv } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type CampaignTab = 'overview' | 'ad-variations' | 'email-drafts' | 'ad-drafts';

const TABS: { id: CampaignTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'ad-variations', label: 'Ad Variations' },
  { id: 'email-drafts', label: 'Email Drafts' },
  { id: 'ad-drafts', label: 'Ad Drafts' },
];

// ─── Email Drafts Tab ────────────────────────────────────────────────────────

interface MailchimpDraftItem {
  id: number;
  title: string;
  status: string;
  platform: 'mailchimp';
}

interface KlaviyoDraftItem {
  id: number;
  title: string;
  status: string;
  platform: 'klaviyo';
}

type EmailDraftItem = MailchimpDraftItem | KlaviyoDraftItem;

function EmailDraftsTab({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<EmailDraftItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [mailchimpRes, klaviyoRes] = await Promise.allSettled([
          api.get(`/api/mailchimp/email-drafts/?campaign_id=${campaignId}`),
          api.get(`/api/klaviyo/klaviyo-drafts/?campaign_id=${campaignId}`),
        ]);

        const mailchimpDrafts: MailchimpDraftItem[] =
          mailchimpRes.status === 'fulfilled'
            ? (mailchimpRes.value.data?.results ?? mailchimpRes.value.data ?? []).map((d: any) => ({
                id: d.id,
                title: d.settings?.subject_line || d.subject || 'Untitled',
                status: d.status || 'draft',
                platform: 'mailchimp' as const,
              }))
            : [];

        const klaviyoDrafts: KlaviyoDraftItem[] =
          klaviyoRes.status === 'fulfilled'
            ? (klaviyoRes.value.data?.results ?? klaviyoRes.value.data ?? []).map((d: any) => ({
                id: d.id,
                title: d.name || d.subject || 'Untitled',
                status: d.status || 'draft',
                platform: 'klaviyo' as const,
              }))
            : [];

        setDrafts([...mailchimpDrafts, ...klaviyoDrafts]);
      } catch {
        toast.error('Failed to load email drafts');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [campaignId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-600">Loading email drafts…</span>
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Mail className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm">No email drafts linked to this campaign yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drafts.map((draft) => (
        <div
          key={`${draft.platform}-${draft.id}`}
          onClick={() =>
            router.push(
              `/campaigns/${campaignId}/email-drafts/${draft.platform}/${draft.id}`
            )
          }
          className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">{draft.title}</p>
              <p className="text-xs text-gray-500 capitalize">
                {draft.platform} · {draft.status}
              </p>
            </div>
          </div>
          <span className="text-xs text-blue-600 font-medium">Open →</span>
        </div>
      ))}
    </div>
  );
}

// ─── Ad Drafts Tab ───────────────────────────────────────────────────────────

interface AdDraftItem {
  id: string;
  name: string;
  status: string;
  platform: 'facebook' | 'tiktok' | 'google';
}

function AdDraftsTab({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<AdDraftItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [fbRes, googleRes, tiktokRes] = await Promise.allSettled([
          api.get(`/api/facebook_meta/adcreatives/?campaign_id=${campaignId}`),
          api.get(`/api/google_ads/ads/?campaign_id=${campaignId}`),
          api.get(
            `/api/tiktok/creation/sidebar/brief_info_list/?campaign_id=${campaignId}`
          ),
        ]);

        const fbDrafts: AdDraftItem[] =
          fbRes.status === 'fulfilled'
            ? (fbRes.value.data?.results ?? fbRes.value.data ?? []).map((d: any) => ({
                id: String(d.id),
                name: d.name || 'Untitled Creative',
                status: d.status || '',
                platform: 'facebook' as const,
              }))
            : [];

        const googleDrafts: AdDraftItem[] =
          googleRes.status === 'fulfilled'
            ? (googleRes.value.data?.results ?? googleRes.value.data ?? []).map((d: any) => ({
                id: String(d.id),
                name: d.name || 'Untitled Ad',
                status: d.status || '',
                platform: 'google' as const,
              }))
            : [];

        const tiktokDrafts: AdDraftItem[] =
          tiktokRes.status === 'fulfilled'
            ? (tiktokRes.value.data?.data?.ad_group_brief_info_list ?? []).flatMap(
                (group: any) =>
                  (group.items ?? []).map((item: any) => ({
                    id: String(item.ad_draft_id),
                    name: item.name || 'Untitled Draft',
                    status: item.status || '',
                    platform: 'tiktok' as const,
                  }))
              )
            : [];

        setDrafts([...fbDrafts, ...googleDrafts, ...tiktokDrafts]);
      } catch {
        toast.error('Failed to load ad drafts');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [campaignId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-600">Loading ad drafts…</span>
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Tv className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm">No ad drafts linked to this campaign yet.</p>
      </div>
    );
  }

  const platformLabel: Record<AdDraftItem['platform'], string> = {
    facebook: 'Facebook Meta',
    tiktok: 'TikTok',
    google: 'Google Ads',
  };

  return (
    <div className="space-y-2">
      {drafts.map((draft) => (
        <div
          key={`${draft.platform}-${draft.id}`}
          onClick={() =>
            router.push(
              `/campaigns/${campaignId}/ad-drafts/${draft.platform}/${draft.id}`
            )
          }
          className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Target className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">{draft.name}</p>
              <p className="text-xs text-gray-500">
                {platformLabel[draft.platform]}
                {draft.status ? ` · ${draft.status}` : ''}
              </p>
            </div>
          </div>
          <span className="text-xs text-blue-600 font-medium">Open →</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const activeTab = (searchParams.get('tab') as CampaignTab) || 'overview';

  const handleTabChange = (tab: CampaignTab) => {
    router.replace(`/campaigns/${campaignId}?tab=${tab}`, { scroll: false });
  };

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
      await fetchCampaign(campaignId);
    } catch (err: any) {
      console.error('Failed to update campaign:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update campaign';
      toast.error(errorMessage);
      throw err;
    }
  };

  const handleBack = () => {
    router.push('/campaigns');
  };

  const handleStatusChangeSuccess = () => {
    fetchCampaign(campaignId).catch((err) => {
      console.error('Failed to refresh campaign:', err);
    });
    setRefreshKey((prev) => prev + 1);
    toast.success('Campaign status updated successfully');
  };

  const handleCheckInEdit = (checkIn: any) => {
    if (currentCampaign?.status === 'ARCHIVED') {
      toast.error('Archived campaigns cannot be edited. Use restore() to move back to Completed status.');
      return;
    }
    if (checkIn && checkIn.id) {
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
    setCheckInsRefreshKey((prev) => prev + 1);
  };

  const handleSnapshotEdit = (snapshot: any) => {
    if (currentCampaign?.status === 'ARCHIVED') {
      toast.error('Archived campaigns cannot be edited. Use restore() to move back to Completed status.');
      return;
    }
    if (snapshot && snapshot.id) {
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
    setSnapshotsRefreshKey((prev) => prev + 1);
  };

  const handleSnapshotDelete = () => {
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

          {/* Tab Navigation */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-6">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'overview' && (
              <>
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
              </>
            )}

            {activeTab === 'ad-variations' && (
              <AdVariationManagement campaignId={currentCampaign.project.id} />
            )}

            {activeTab === 'email-drafts' && (
              <EmailDraftsTab campaignId={campaignId} />
            )}

            {activeTab === 'ad-drafts' && (
              <AdDraftsTab campaignId={campaignId} />
            )}
          </div>

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
