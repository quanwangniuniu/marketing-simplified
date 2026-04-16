'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { EmailDraftsWorkspace } from '@/components/email-drafts/EmailDraftsWorkspace';
import AdCreativeTable from '@/components/facebook_meta/AdCreativeTable';
import AdCreativeModal from '@/components/facebook_meta/AdCreativeModal';
import AdTable from '@/components/google_ads/AdTable';
import AdModal from '@/components/google_ads/AdModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useFacebookMetaData } from '@/hooks/useFacebookMetaData';
import { useGoogleAdsData } from '@/hooks/useGoogleAdsData';
import { mailchimpApi } from '@/lib/api/mailchimpApi';
import { klaviyoApi } from '@/lib/api/klaviyoApi';
import Button from '@/components/button/Button';
import { AlertTriangle, ArrowLeft, Tv } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type CampaignTab = 'overview' | 'ad-variations' | 'email-drafts' | 'ad-drafts';

const TABS: { id: CampaignTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'ad-variations', label: 'Ad Variations' },
  { id: 'email-drafts', label: 'Email Drafts' },
  { id: 'ad-drafts', label: 'Ad Drafts' },
];

const VALID_TABS = new Set<string>(TABS.map((t) => t.id));

// ─── Sub-tab pill navigation ──────────────────────────────────────────────────

function SubTabNav<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex space-x-1 rounded-lg bg-gray-100 p-1 mb-6 w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            active === tab.id
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Delete confirm toast helper ─────────────────────────────────────────────

function showDeleteConfirmToast(title: string, onConfirm: () => void) {
  toast(
    (t) => (
      <div className="w-[340px] rounded-xl border border-red-100 bg-white p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-red-50 p-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-gray-900">Delete draft?</p>
            <p className="text-sm text-gray-600">
              This will permanently delete{' '}
              <span className="font-semibold">{`"${title}"`}</span>.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              onConfirm();
            }}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    ),
    {
      duration: 10000,
      style: { padding: 0, background: 'transparent', boxShadow: 'none', border: 'none' },
    }
  );
}

// ─── Mailchimp Drafts Sub-tab ────────────────────────────────────────────────

function MailchimpDraftsSubTab({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [rawDrafts, setRawDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/api/mailchimp/email-drafts/?campaign_id=${campaignId}`)
      .then((res) => setRawDrafts(res.data?.results ?? res.data ?? []))
      .catch(() => setError('Failed to load Mailchimp drafts'))
      .finally(() => setLoading(false));
  }, [campaignId]);

  const handleDelete = async (draftId: number, draftTitle: string) => {
    try {
      await mailchimpApi.deleteEmailDraft(draftId);
      setRawDrafts((prev) => prev.filter((d) => d.id !== draftId));
      toast.success(`Deleted "${draftTitle}"`);
    } catch {
      toast.error('Failed to delete email draft. Please try again.');
    }
  };

  const drafts = useMemo(
    () =>
      rawDrafts.map((d: any) => ({
        id: d.id,
        title: d.settings?.subject_line || d.subject || 'Untitled Email',
        previewText: d.settings?.preview_text || d.preview_text || '',
        fromName: d.settings?.from_name || d.from_name || '',
        status: d.status || 'draft',
        typeLabel: d.type || 'Regular email',
        sendTime: d.send_time || d.updated_at,
        recipients: d.recipients || 0,
      })),
    [rawDrafts]
  );

  return (
    <EmailDraftsWorkspace
      pageTitle="Mailchimp Drafts"
      searchPlaceholder="Search Mailchimp drafts"
      drafts={drafts}
      loading={loading}
      error={error}
      initialView="list"
      loadingMessage="Loading Mailchimp drafts..."
      emptyStateTitle="No Mailchimp drafts linked to this campaign."
      emptyStateDescription="Go to the Mailchimp page to create and link a draft to this campaign."
      noSearchResultMessage="No drafts match your search."
      showListPreview
      onCreate={() => router.push('/mailchimp/templates')}
      onOpen={(draft) =>
        router.push(`/campaigns/${campaignId}/email-drafts/mailchimp/${draft.id}`)
      }
      onEdit={(draft) =>
        router.push(`/campaigns/${campaignId}/email-drafts/mailchimp/${draft.id}`)
      }
      onSend={(draft) =>
        router.push(`/campaigns/${campaignId}/email-drafts/mailchimp/${draft.id}`)
      }
      onDelete={(draft) =>
        showDeleteConfirmToast(draft.title, () =>
          handleDelete(Number(draft.id), draft.title)
        )
      }
    />
  );
}

// ─── Klaviyo Drafts Sub-tab ──────────────────────────────────────────────────

function KlaviyoDraftsSubTab({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [rawDrafts, setRawDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/api/klaviyo/klaviyo-drafts/?campaign_id=${campaignId}`)
      .then((res) => setRawDrafts(res.data?.results ?? res.data ?? []))
      .catch(() => setError('Failed to load Klaviyo drafts'))
      .finally(() => setLoading(false));
  }, [campaignId]);

  const handleDelete = async (draftId: number, draftTitle: string) => {
    try {
      await klaviyoApi.deleteEmailDraft(draftId);
      setRawDrafts((prev) => prev.filter((d) => d.id !== draftId));
      toast.success(`Deleted "${draftTitle}"`);
    } catch {
      toast.error('Failed to delete email draft. Please try again.');
    }
  };

  const drafts = useMemo(
    () =>
      rawDrafts.map((d: any) => ({
        id: d.id,
        title: d.name || d.subject || 'Untitled email template',
        previewText: d.subject || '',
        fromName: d.name || '',
        status: d.status || 'draft',
        typeLabel: 'Email template',
        sendTime: d.updated_at || d.created_at,
        recipients: 0,
      })),
    [rawDrafts]
  );

  return (
    <EmailDraftsWorkspace
      pageTitle="Klaviyo Drafts"
      searchPlaceholder="Search Klaviyo drafts"
      drafts={drafts}
      loading={loading}
      error={error}
      initialView="list"
      loadingMessage="Loading Klaviyo drafts..."
      emptyStateTitle="No Klaviyo drafts linked to this campaign."
      emptyStateDescription="Go to the Klaviyo page to create and link a draft to this campaign."
      noSearchResultMessage="No drafts match your search."
      showListPreview
      onCreate={() => router.push('/klaviyo')}
      onOpen={(draft) =>
        router.push(`/campaigns/${campaignId}/email-drafts/klaviyo/${draft.id}`)
      }
      onEdit={(draft) =>
        router.push(`/campaigns/${campaignId}/email-drafts/klaviyo/${draft.id}`)
      }
      onSend={(draft) =>
        router.push(`/campaigns/${campaignId}/email-drafts/klaviyo/${draft.id}`)
      }
      onDelete={(draft) =>
        showDeleteConfirmToast(draft.title, () =>
          handleDelete(Number(draft.id), draft.title)
        )
      }
    />
  );
}

// ─── Email Drafts Tab ────────────────────────────────────────────────────────

type EmailSubTab = 'mailchimp' | 'klaviyo';

const EMAIL_SUB_TABS: { id: EmailSubTab; label: string }[] = [
  { id: 'mailchimp', label: 'Mailchimp' },
  { id: 'klaviyo', label: 'Klaviyo' },
];

function EmailDraftsTab({ campaignId }: { campaignId: string }) {
  const [activeSubTab, setActiveSubTab] = useState<EmailSubTab>('mailchimp');

  return (
    <div>
      <SubTabNav tabs={EMAIL_SUB_TABS} active={activeSubTab} onChange={setActiveSubTab} />
      {activeSubTab === 'mailchimp' && <MailchimpDraftsSubTab campaignId={campaignId} />}
      {activeSubTab === 'klaviyo' && <KlaviyoDraftsSubTab campaignId={campaignId} />}
    </div>
  );
}

// ─── Facebook Meta Ad Drafts Sub-tab ─────────────────────────────────────────

function FacebookDraftsSubTab({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [selectedCreative, setSelectedCreative] = useState<any>(null);

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

  useEffect(() => {
    fetchAdCreatives({ campaign_id: campaignId } as any);
  }, [campaignId, fetchAdCreatives]);

  const handleCreate = async (formData: any) => {
    await createAdCreative({ ...formData, media_campaign: formData?.media_campaign ?? campaignId });
    setShowCreateModal(false);
  };

  const handleUpdate = async (formData: any) => {
    if (selectedCreative) {
      await updateAdCreative(selectedCreative.id, formData);
      setShowUpdateModal(false);
      setSelectedCreative(null);
    }
  };

  const confirmDelete = async () => {
    if (deleteTargetId) {
      await deleteAdCreative(deleteTargetId);
      setDeleteTargetId(null);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-gray-700">Facebook Meta Ad Creatives</h3>
        <button
          className="btn btn-primary text-sm"
          onClick={() => setShowCreateModal(true)}
          disabled={submitting}
        >
          New Ad Creative
        </button>
      </div>

      <AdCreativeTable
        creatives={adCreatives}
        loading={loading}
        onView={(id) => router.push(`/campaigns/${campaignId}/ad-drafts/facebook/${id}`)}
        onEdit={(id) => {
          const creative = adCreatives.find((c: any) => c.id === id);
          if (creative) {
            setSelectedCreative(creative);
            setShowUpdateModal(true);
          }
        }}
        onDelete={(id) => {
          setDeleteTargetId(id);
          setShowDeleteModal(true);
        }}
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

      <AdCreativeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        submitting={submitting}
      />

      <AdCreativeModal
        isOpen={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false);
          setSelectedCreative(null);
        }}
        onSubmit={handleUpdate}
        submitting={submitting}
        mode="update"
        adCreative={selectedCreative}
      />

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
  );
}

// ─── Google Ads Sub-tab ──────────────────────────────────────────────────────

function GoogleAdsDraftsSubTab({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  useEffect(() => {
    fetchAds({ campaign_id: campaignId } as any);
  }, [campaignId, fetchAds]);

  const handleCreate = async (formData: any) => {
    const createdAd = await createAd({ ...formData, media_campaign: campaignId });
    setShowCreateModal(false);
    router.push(`/campaigns/${campaignId}/ad-drafts/google/${createdAd.id}/design`);
    return createdAd;
  };

  const handleUpdate = async (formData: any) => {
    if (selectedAd) {
      const updatedAd = await updateAd(selectedAd.id, formData);
      setShowUpdateModal(false);
      setSelectedAd(null);
      return updatedAd;
    }
    throw new Error('No ad selected for update');
  };

  const confirmDelete = async () => {
    if (deleteTargetId !== null) {
      await deleteAd(deleteTargetId);
      setDeleteTargetId(null);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-gray-700">Google Ads</h3>
        <button
          className="btn btn-primary text-sm"
          onClick={() => setShowCreateModal(true)}
          disabled={submitting}
        >
          New Ad
        </button>
      </div>

      <AdTable
        ads={ads}
        loading={loading}
        onView={(id) => router.push(`/campaigns/${campaignId}/ad-drafts/google/${id}`)}
        onEdit={(id) => {
          const ad = ads.find((a: any) => a.id === id);
          if (ad) {
            setSelectedAd(ad);
            setShowUpdateModal(true);
          }
        }}
        onDelete={(id) => {
          setDeleteTargetId(id);
          setShowDeleteModal(true);
        }}
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

      <AdModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        submitting={submitting}
        mode="create"
        existingAds={ads}
      />

      <AdModal
        isOpen={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false);
          setSelectedAd(null);
        }}
        onSubmit={handleUpdate}
        submitting={submitting}
        mode="update"
        ad={selectedAd}
        existingAds={ads}
      />

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
  );
}

// ─── TikTok Drafts Sub-tab ───────────────────────────────────────────────────

function TikTokDraftsSubTab({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(
        `/api/tiktok/creation/sidebar/brief_info_list/?campaign_id=${campaignId}`
      )
      .then((res) => {
        const list =
          res.data?.data?.ad_group_brief_info_list ?? res.data?.results ?? res.data ?? [];
        setGroups(list);
      })
      .catch(() => toast.error('Failed to load TikTok drafts'))
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-600">Loading TikTok drafts…</span>
      </div>
    );
  }

  const allItems = groups.flatMap((g: any) =>
    (g.creative_brief_info_item_list ?? []).map((item: any) => ({
      ...item,
      groupName: g.group_name || g.name,
    }))
  );

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Tv className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm">No TikTok drafts linked to this campaign yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {allItems.map((item: any) => (
        <div
          key={item.id ?? item.ad_draft_id}
          onClick={() =>
            router.push(
              `/campaigns/${campaignId}/ad-drafts/tiktok/${item.id ?? item.ad_draft_id}`
            )
          }
          className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <div>
            <p className="text-sm font-medium text-gray-900">
              {item.name || 'Untitled Draft'}
            </p>
            {item.groupName && (
              <p className="text-xs text-gray-500">{item.groupName}</p>
            )}
          </div>
          <span className="text-xs text-blue-600 font-medium">Open →</span>
        </div>
      ))}
    </div>
  );
}

// ─── Ad Drafts Tab ───────────────────────────────────────────────────────────

type AdSubTab = 'facebook' | 'google' | 'tiktok';

const AD_SUB_TABS: { id: AdSubTab; label: string }[] = [
  { id: 'facebook', label: 'Facebook Meta' },
  { id: 'google', label: 'Google Ads' },
  { id: 'tiktok', label: 'TikTok' },
];

function AdDraftsTab({ campaignId }: { campaignId: string }) {
  const [activeSubTab, setActiveSubTab] = useState<AdSubTab>('facebook');

  return (
    <div>
      <SubTabNav tabs={AD_SUB_TABS} active={activeSubTab} onChange={setActiveSubTab} />
      {activeSubTab === 'facebook' && (
        <FacebookDraftsSubTab campaignId={campaignId} />
      )}
      {activeSubTab === 'google' && (
        <GoogleAdsDraftsSubTab campaignId={campaignId} />
      )}
      {activeSubTab === 'tiktok' && (
        <TikTokDraftsSubTab campaignId={campaignId} />
      )}
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

  const tabParam = searchParams.get('tab') ?? '';
  const activeTab: CampaignTab = VALID_TABS.has(tabParam) ? (tabParam as CampaignTab) : 'overview';

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
