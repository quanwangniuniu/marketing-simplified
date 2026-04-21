'use client';

import { CheckCircle2, Pencil, Rocket, Share2, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import AdDraftActionBar, {
  type ActionSpec,
} from '@/components/ads-draft-v2/AdDraftActionBar';
import CampaignScopeBanner from '@/components/ads-draft-v2/CampaignScopeBanner';
import PlatformBadge from '@/components/ads-draft-v2/PlatformBadge';
import SharePreviewModal from '@/components/ads-draft-v2/SharePreviewModal';
import AdDraftStatusPill from '@/components/ads-draft-v2/pills/AdDraftStatusPill';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ResponsiveDisplayAdForm from '@/components/google_ads/design/ResponsiveDisplayAdForm';
import ResponsiveSearchAdForm from '@/components/google_ads/design/ResponsiveSearchAdForm';
import VideoResponsiveAdForm from '@/components/google_ads/design/VideoResponsiveAdForm';
import AdPreviewPanel from '@/components/google_ads/preview/AdPreviewPanel';
import BrandDialog from '@/components/tasks-v2/detail/BrandDialog';
import InlineSelect from '@/components/tasks-v2/detail/InlineSelect';
import { useGoogleAdsDesign } from '@/hooks/useGoogleAdsDesign';
import { FacebookMetaAPI } from '@/lib/api/facebookMetaApi';
import {
  GoogleAdsAPI,
  type AdStatus,
  type DeviceType,
  type GoogleAd,
} from '@/lib/api/googleAdsApi';

const SECTION_CLS = 'rounded-xl bg-white shadow-sm ring-1 ring-gray-100';
const H2_CLS = 'text-[13px] font-semibold uppercase tracking-wide text-gray-900';
const EYEBROW_CLS = 'text-[11px] font-medium uppercase tracking-wide text-gray-500';
const ROW_CLS = 'grid grid-cols-[108px_1fr] items-start gap-3 py-2';

const STATUS_LABEL: Record<AdStatus, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PUBLISHED: 'Published',
  PAUSED: 'Paused',
};

const STATUS_OPTIONS: Array<{ value: AdStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'PAUSED', label: 'Paused' },
];

const TYPE_LABEL: Record<string, string> = {
  RESPONSIVE_SEARCH_AD: 'Responsive Search Ad',
  RESPONSIVE_DISPLAY_AD: 'Responsive Display Ad',
  VIDEO_RESPONSIVE_AD: 'Video Responsive Ad',
  VIDEO_AD: 'Video Ad',
  IMAGE_AD: 'Image Ad',
};

function AdForm({ ad, onUpdate, saving }: { ad: GoogleAd; onUpdate: (data: any) => Promise<void>; saving: boolean }) {
  switch (ad.type) {
    case 'RESPONSIVE_SEARCH_AD':
      return <ResponsiveSearchAdForm ad={ad} onUpdate={onUpdate} saving={saving} />;
    case 'RESPONSIVE_DISPLAY_AD':
      return <ResponsiveDisplayAdForm ad={ad} onUpdate={onUpdate} saving={saving} />;
    case 'VIDEO_RESPONSIVE_AD':
      return <VideoResponsiveAdForm ad={ad} onUpdate={onUpdate} saving={saving} />;
    default:
      return (
        <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
          This ad type ({ad.type || 'unknown'}) is not editable in this workspace.
        </div>
      );
  }
}

function GoogleAdsDetailContent() {
  const router = useRouter();
  const params = useParams<{ adId: string }>();
  const adId = params?.adId ? Number(params.adId) : null;

  const {
    ad,
    loading,
    saving,
    error,
    fetchAd,
    updateAd,
    publishAd,
    completenessPercentage,
    isComplete,
    missingFields,
  } = useGoogleAdsDesign(adId ?? undefined);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (adId) fetchAd(adId);
  }, [adId, fetchAd]);

  useEffect(() => {
    if (ad?.name) setDraftName(ad.name);
  }, [ad?.name]);

  const completeness = useMemo(() => completenessPercentage(), [completenessPercentage]);
  const complete = useMemo(() => isComplete(), [isComplete]);
  const missing = useMemo(() => missingFields(), [missingFields]);

  const handleNameSave = useCallback(async () => {
    if (!ad?.id) return;
    const trimmed = draftName.trim();
    if (!trimmed) {
      setDraftName(ad.name ?? '');
      setEditingName(false);
      return;
    }
    if (trimmed === ad.name) {
      setEditingName(false);
      return;
    }
    try {
      setSavingName(true);
      await GoogleAdsAPI.updateAdGlobal(ad.id, { name: trimmed } as any);
      await fetchAd(ad.id);
      toast.success('Name updated');
      setEditingName(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  }, [ad, draftName, fetchAd]);

  const handleStatusChange = useCallback(
    async (next: string) => {
      if (!ad?.id || next === ad.status) return;
      try {
        await GoogleAdsAPI.updateAdGlobal(ad.id, { status: next } as any);
        await fetchAd(ad.id);
        toast.success(`Status set to ${STATUS_LABEL[next as AdStatus] ?? next}`);
      } catch (err: any) {
        toast.error(err?.response?.data?.detail ?? 'Failed to update status');
      }
    },
    [ad, fetchAd]
  );

  const handleShare = useCallback(
    async () => {
      if (!ad?.id) throw new Error('Missing ad id');
      const device: DeviceType = 'DESKTOP';
      const response = await GoogleAdsAPI.createPreview(ad.id, { device_type: device });
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = response.preview_url?.startsWith('http')
        ? response.preview_url
        : `${origin}${response.preview_url ?? `/google_ads/preview/${response.token}/`}`;
      return url;
    },
    [ad]
  );

  const handlePublish = useCallback(async () => {
    if (!ad?.id) return;
    try {
      await publishAd();
      toast.success('Ad published');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to publish');
    }
  }, [ad, publishAd]);

  const handleDelete = useCallback(async () => {
    if (!ad?.id) return;
    try {
      setDeleting(true);
      // gg-6 DELETE preferred; use GoogleAdsAPI.deleteAd
      await (GoogleAdsAPI as any).deleteAd(ad.id);
      toast.success('Ad deleted');
      router.push('/google-ads');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to delete');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }, [ad, router]);

  const actions: ActionSpec[] = useMemo(
    () => [
      {
        label: saving ? 'Publishing…' : 'Publish',
        variant: 'primary',
        icon: Rocket,
        onClick: handlePublish,
        disabled: !ad || saving || !complete || ad?.status === 'PUBLISHED',
        loading: saving,
        title: !complete ? `Missing: ${missing.join(', ')}` : undefined,
      },
      {
        label: 'Share preview',
        variant: 'ghost',
        icon: Share2,
        onClick: () => setShareOpen(true),
        disabled: !ad,
      },
      {
        label: 'Delete',
        variant: 'danger',
        icon: Trash2,
        onClick: () => setDeleteOpen(true),
        disabled: !ad,
      },
    ],
    [ad, saving, complete, missing, handlePublish]
  );

  if (loading && !ad) {
    return (
      <DashboardLayout>
        <div className={`${SECTION_CLS} p-10 text-center text-xs text-gray-400`}>Loading ad…</div>
      </DashboardLayout>
    );
  }

  if (error || !ad) {
    return (
      <DashboardLayout>
        <div className={`${SECTION_CLS} space-y-3 p-10 text-center`}>
          <h2 className="text-sm font-medium text-gray-900">Unable to load ad</h2>
          <p className="text-xs text-gray-500">{error ?? 'Not found'}</p>
          <button
            type="button"
            onClick={() => router.push('/google-ads')}
            className="inline-flex rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-95"
          >
            Back to list
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const statusValue = (ad.status as AdStatus | undefined) ?? 'DRAFT';
  const typeDisplay = ad.type ? TYPE_LABEL[ad.type] ?? ad.type.replace(/_/g, ' ') : '—';

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <CampaignScopeBanner />

        <header className={`${SECTION_CLS} space-y-3 px-5 py-4`}>
          <div className="flex items-center gap-3">
            <PlatformBadge platform="google_ads" />
            <AdDraftStatusPill
              platform="google_ads"
              status={statusValue}
              statusLabel={STATUS_LABEL[statusValue]}
            />
            <span className="text-[11px] text-gray-400">{typeDisplay}</span>
            <span className="text-[11px] text-gray-400">· ID {ad.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {editingName ? (
              <input
                autoFocus
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleNameSave();
                  }
                  if (event.key === 'Escape') {
                    setDraftName(ad.name ?? '');
                    setEditingName(false);
                  }
                }}
                disabled={savingName}
                className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xl font-semibold text-gray-900 outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              />
            ) : (
              <>
                <h1 className="min-w-0 flex-1 truncate text-xl font-semibold text-gray-900">
                  {ad.name || 'Untitled ad'}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(ad.name ?? '');
                    setEditingName(true);
                  }}
                  aria-label="Edit name"
                  title="Edit name"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          <AdDraftActionBar actions={actions} />
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main>
            <section className={`${SECTION_CLS} space-y-4 p-5`}>
              <div>
                <h2 className={H2_CLS}>Ad content</h2>
                <p className="mt-1 text-[11px] text-gray-500">
                  Edits auto-save to the backend. Required fields are highlighted in the form.
                </p>
              </div>
              <AdForm ad={ad} onUpdate={updateAd} saving={saving} />
            </section>
          </main>

          <aside className="space-y-4">
            <section className={`${SECTION_CLS} p-5`}>
              <h2 className={H2_CLS}>Properties</h2>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <div className={EYEBROW_CLS}>Status</div>
                  <InlineSelect
                    ariaLabel="Status"
                    value={statusValue}
                    onValueChange={handleStatusChange}
                    options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                  />
                </div>
                <div className={ROW_CLS}>
                  <div className={EYEBROW_CLS}>Customer</div>
                  <div className="min-w-0 text-gray-900">
                    {ad.customer_account?.descriptive_name || ad.customer_account?.customer_id || <span className="text-gray-400">—</span>}
                  </div>
                </div>
                <div className={ROW_CLS}>
                  <div className={EYEBROW_CLS}>Resource</div>
                  <div className="min-w-0 break-all font-mono text-[11px] text-gray-600">
                    {(ad as any).resource_name || <span className="text-gray-400 font-sans">—</span>}
                  </div>
                </div>
                <div className={ROW_CLS}>
                  <div className={EYEBROW_CLS}>Created</div>
                  <div className="min-w-0 text-gray-700 text-xs">
                    {ad.created_at ? new Date(ad.created_at).toLocaleString() : '—'}
                  </div>
                </div>
              </div>
            </section>

            <section className={`${SECTION_CLS} p-5`}>
              <h2 className={H2_CLS}>Completeness</h2>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Progress</span>
                  <span className="font-medium text-gray-900">{completeness}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661] transition-all"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
                {complete ? (
                  <div className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Ready to publish
                  </div>
                ) : (
                  <div>
                    <div className={EYEBROW_CLS}>Missing</div>
                    <ul className="mt-1 space-y-0.5 text-[11px] text-gray-600">
                      {missing.length === 0 ? (
                        <li className="text-gray-400">—</li>
                      ) : (
                        missing.map((field) => (
                          <li key={field}>· {field}</li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            <section className={`${SECTION_CLS} p-5`}>
              <h2 className={H2_CLS}>Preview</h2>
              <div className="mt-3">
                <AdPreviewPanel ad={ad} />
              </div>
            </section>
          </aside>
        </div>

        <SharePreviewModal
          open={shareOpen}
          onOpenChange={setShareOpen}
          platform="google_ads"
          onShare={handleShare}
          title="Share Google Ad preview"
          subtitle="Generate a public read-only preview link"
        />

        <BrandDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            if (!deleting) setDeleteOpen(open);
          }}
          title="Delete this ad?"
          subtitle="This action cannot be undone."
          width="max-w-sm"
        >
          <p className="text-sm text-gray-700">
            The ad, its preview links, and associated assets will be removed permanently.
          </p>
          <div className="-mx-5 -mb-5 mt-5 flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        </BrandDialog>
      </div>
    </DashboardLayout>
  );
}

export default function GoogleAdsDetailPage() {
  return (
    <ProtectedRoute>
      <GoogleAdsDetailContent />
    </ProtectedRoute>
  );
}
