'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import AdCreateModal, {
  type AdCreateRequestV2,
} from '@/components/ads-draft/google_ads/AdCreateModal';
import AdTableV2 from '@/components/ads-draft/google_ads/AdTableV2';
import CampaignScopeBanner from '@/components/ads-draft/CampaignScopeBanner';
import PlatformBadge from '@/components/ads-draft/PlatformBadge';
import BrandDialog from '@/components/tasks/detail/BrandDialog';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useGoogleAdsData } from '@/hooks/useGoogleAdsData';
import type { AdStatus, AdType } from '@/lib/api/googleAdsApi';

const SECTION_CLS = 'rounded-xl bg-white shadow-sm ring-1 ring-gray-100';
const EYEBROW_CLS = 'text-[11px] font-medium uppercase tracking-wide text-gray-500';

const STATUS_OPTIONS: Array<{ value: AdStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'PAUSED', label: 'Paused' },
];

const TYPE_OPTIONS: Array<{ value: AdType | ''; label: string }> = [
  { value: '', label: 'All types' },
  { value: 'RESPONSIVE_SEARCH_AD', label: 'Responsive Search' },
  { value: 'RESPONSIVE_DISPLAY_AD', label: 'Responsive Display' },
  { value: 'VIDEO_RESPONSIVE_AD', label: 'Video Responsive' },
];

function GoogleAdsV2Content() {
  const router = useRouter();
  const {
    ads,
    loading,
    submitting,
    fetchAds,
    createAd,
    deleteAd,
    currentPage,
    totalPages,
    totalCount,
    hasNext,
    hasPrevious,
    nextPage,
    previousPage,
    filters,
    applyFilters,
    clearFilters,
  } = useGoogleAdsData();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const existingNames = useMemo(() => ads.map((ad) => ad.name ?? '').filter(Boolean), [ads]);

  const handleCreate = async (payload: AdCreateRequestV2) => {
    try {
      const created = await createAd({ name: payload.name, type: payload.type });
      setCreateOpen(false);
      if (created?.id) {
        router.push(`/google-ads/${created.id}`);
      }
    } catch {
      // useGoogleAdsData shows toast on error; keep modal open
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    await deleteAd(deleteTargetId);
    setDeleteTargetId(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <CampaignScopeBanner />

        <header className={`${SECTION_CLS} flex items-start justify-between gap-4 px-5 py-4`}>
          <div className="min-w-0 space-y-1">
            <PlatformBadge platform="google_ads" />
            <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">
              Google Ads
            </h1>
            <p className="text-xs text-gray-500">
              Draft Responsive Search, Display, and Video Responsive ads with live previews.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:opacity-95"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            New Ad
          </button>
        </header>

        <section className={`${SECTION_CLS} flex flex-wrap items-end gap-3 px-5 py-4`}>
          <div>
            <label className={EYEBROW_CLS} htmlFor="ga-filter-status">Status</label>
            <select
              id="ga-filter-status"
              value={filters.status ?? ''}
              onChange={(event) =>
                applyFilters({ ...filters, status: (event.target.value || undefined) as AdStatus | undefined })
              }
              className="mt-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={EYEBROW_CLS} htmlFor="ga-filter-type">Type</label>
            <select
              id="ga-filter-type"
              value={filters.type ?? ''}
              onChange={(event) =>
                applyFilters({ ...filters, type: (event.target.value || undefined) as AdType | undefined })
              }
              className="mt-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {(filters.status || filters.type) && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200 transition hover:ring-gray-300"
            >
              Clear filters
            </button>
          )}
        </section>

        <AdTableV2
          ads={ads}
          loading={loading}
          onRowClick={(id) => router.push(`/google-ads/${id}`)}
          onDelete={(id) => setDeleteTargetId(id)}
        />

        {totalCount > 0 && (
          <div className="flex items-center justify-between px-1 text-xs text-gray-500">
            <span>
              Page {currentPage} of {Math.max(totalPages, 1)} · {totalCount} total
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={previousPage}
                disabled={!hasPrevious}
                className="rounded-md bg-white px-2.5 py-1 text-xs text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={nextPage}
                disabled={!hasNext}
                className="rounded-md bg-white px-2.5 py-1 text-xs text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        <AdCreateModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          existingNames={existingNames}
          submitting={submitting}
          onSubmit={handleCreate}
        />

        <BrandDialog
          open={!!deleteTargetId}
          onOpenChange={(open) => {
            if (!open) setDeleteTargetId(null);
          }}
          title="Delete ad?"
          subtitle="This action cannot be undone."
          width="max-w-sm"
        >
          <p className="text-sm text-gray-700">
            The ad and its preview links will be removed permanently.
          </p>
          <div className="-mx-5 -mb-5 mt-5 flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
            <button
              type="button"
              onClick={() => setDeleteTargetId(null)}
              disabled={submitting}
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={submitting}
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

export default function GoogleAdsV2Page() {
  return (
    <ProtectedRoute>
      <GoogleAdsV2Content />
    </ProtectedRoute>
  );
}
