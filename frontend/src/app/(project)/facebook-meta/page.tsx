'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import AdDraftStatusPill from '@/components/ads-draft/pills/AdDraftStatusPill';
import AdCreativeCreateModal, {
  type AdCreativeCreatePayload,
} from '@/components/ads-draft/facebook_meta/AdCreativeCreateModal';
import AdCreativeTableV2 from '@/components/ads-draft/facebook_meta/AdCreativeTableV2';
import CampaignScopeBanner from '@/components/ads-draft/CampaignScopeBanner';
import PlatformBadge from '@/components/ads-draft/PlatformBadge';
import BrandDialog from '@/components/tasks/detail/BrandDialog';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useFacebookMetaData } from '@/hooks/useFacebookMetaData';
import { FacebookMetaAPI } from '@/lib/api/facebookMetaApi';

const SECTION_CLS = 'rounded-xl bg-white shadow-sm ring-1 ring-gray-100';
const EYEBROW_CLS = 'text-[11px] font-medium uppercase tracking-wide text-gray-500';

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'IN_PROCESS', label: 'In process' },
  { value: 'WITH_ISSUES', label: 'With issues' },
  { value: 'DELETED', label: 'Deleted' },
];

function FacebookMetaV2Content() {
  const router = useRouter();
  const {
    adCreatives,
    loading,
    submitting,
    fetchAdCreatives,
    deleteAdCreative,
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
  } = useFacebookMetaData();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    fetchAdCreatives();
  }, [fetchAdCreatives]);

  const handleCreate = async (payload: AdCreativeCreatePayload) => {
    try {
      const result = await FacebookMetaAPI.createAdCreative(payload);
      setCreateOpen(false);
      const newId = result?.data?.id;
      if (newId) {
        router.push(`/facebook-meta/${newId}`);
      } else {
        fetchAdCreatives();
      }
    } catch {
      // useFacebookMetaData surfaces toast for errors; keep modal open for retry
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    await deleteAdCreative(deleteTargetId);
    setDeleteTargetId(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <CampaignScopeBanner />

        <header className={`${SECTION_CLS} flex items-start justify-between gap-4 px-5 py-4`}>
          <div className="min-w-0 space-y-1">
            <PlatformBadge platform="facebook_meta" />
            <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">
              Facebook Meta ad creatives
            </h1>
            <p className="text-xs text-gray-500">
              Manage draft Facebook Meta creatives, share preview links, and associate uploaded media.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:opacity-95"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            New Ad Creative
          </button>
        </header>

        <section className={`${SECTION_CLS} flex flex-wrap items-end gap-3 px-5 py-4`}>
          <div>
            <label className={EYEBROW_CLS} htmlFor="fb-filter-status">Status</label>
            <select
              id="fb-filter-status"
              value={filters.status ?? ''}
              onChange={(event) => applyFilters({ ...filters, status: event.target.value || undefined })}
              className="mt-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {(filters.status || filters.call_to_action_type) && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200 transition hover:ring-gray-300"
            >
              Clear filters
            </button>
          )}
          <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
            <span>Live preview</span>
            <AdDraftStatusPill platform="facebook_meta" status="ACTIVE" statusLabel="Active" />
          </div>
        </section>

        <AdCreativeTableV2
          creatives={adCreatives as any}
          loading={loading}
          onRowClick={(id) => router.push(`/facebook-meta/${id}`)}
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

        <AdCreativeCreateModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={handleCreate}
          submitting={submitting}
        />

        <BrandDialog
          open={!!deleteTargetId}
          onOpenChange={(open) => {
            if (!open) setDeleteTargetId(null);
          }}
          title="Delete ad creative?"
          subtitle="This action cannot be undone."
          width="max-w-sm"
        >
          <p className="text-sm text-gray-700">
            The creative and its preview links will be removed permanently.
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

export default function FacebookMetaV2Page() {
  return (
    <ProtectedRoute>
      <FacebookMetaV2Content />
    </ProtectedRoute>
  );
}
