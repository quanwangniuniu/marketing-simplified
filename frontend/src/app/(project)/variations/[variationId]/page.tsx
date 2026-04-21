'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/dashboard-v2/DashboardLayout';
import ChatFAB from '@/components/global-chat/ChatFAB';
import BrandDialog from '@/components/tasks-v2/detail/BrandDialog';
import { AdVariationAPI } from '@/lib/api/adVariationApi';
import { useProjectStore } from '@/lib/projectStore';
import type {
  AdGroup,
  AdVariation,
  VariationPerformanceEntry,
  VariationStatusHistory,
} from '@/types/adVariation';
import VariationDetailHeader from '@/components/ad-variations-v2/detail/VariationDetailHeader';
import PreviewBlock from '@/components/ad-variations-v2/detail/PreviewBlock';
import ComposerBlock from '@/components/ad-variations-v2/detail/ComposerBlock';
import PerformanceBlock from '@/components/ad-variations-v2/detail/PerformanceBlock';
import PropertiesAside from '@/components/ad-variations-v2/detail/PropertiesAside';
import StatusHistoryAside from '@/components/ad-variations-v2/detail/StatusHistoryAside';

export default function VariationDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const variationId = params?.variationId ? Number(params.variationId) : null;
  const cidParam = searchParams?.get('cid');
  const activeProject = useProjectStore((s) => s.activeProject);
  const campaignId = cidParam ? Number(cidParam) : activeProject?.id ?? null;

  const [variation, setVariation] = useState<AdVariation | null>(null);
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [performanceEntries, setPerformanceEntries] = useState<VariationPerformanceEntry[]>([]);
  const [statusHistory, setStatusHistory] = useState<VariationStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!variationId || !campaignId) return;
    try {
      const [v, groups, perf, history] = await Promise.all([
        AdVariationAPI.getVariation(campaignId, variationId),
        AdVariationAPI.listAdGroups(campaignId),
        AdVariationAPI.listPerformance(campaignId, variationId, { limit: 50 }),
        AdVariationAPI.listStatusHistory(campaignId, variationId, { limit: 20 }),
      ]);
      setVariation(v);
      setAdGroups(groups);
      setPerformanceEntries(perf);
      setStatusHistory(history);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load variation');
    } finally {
      setLoading(false);
    }
  }, [campaignId, variationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onMutated = useCallback(async () => {
    await load();
  }, [load]);

  const doDelete = async () => {
    if (!variation || !campaignId) return;
    setDeleting(true);
    try {
      await AdVariationAPI.deleteVariation(campaignId, variation.id);
      toast.success('Variation deleted');
      router.push('/variations');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Delete failed');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (!variationId || !campaignId) {
    return (
      <DashboardLayout alerts={[]} upcomingMeetings={[]}>
        <div className="px-6 py-12 text-center text-sm text-rose-600">
          Invalid variation — project context missing. Open from the Variations board.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout alerts={[]} upcomingMeetings={[]}>
      <div className="bg-gray-50">
        {loading && (
          <div className="px-6 py-12 text-center text-sm text-gray-400">Loading variation…</div>
        )}
        {error && !loading && (
          <div className="px-6 py-12 text-center text-sm text-rose-600">{error}</div>
        )}
        {variation && !loading && !error && (
          <div className="mx-auto max-w-[1440px] px-6 py-4">
            <VariationDetailHeader
              variation={variation}
              adGroup={adGroups.find((g) => g.id === variation.adGroupId) || null}
              campaignId={campaignId}
              onMutated={onMutated}
              onDelete={() => setConfirmDelete(true)}
            />
            <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_360px]">
              <main className="space-y-5">
                <PreviewBlock variation={variation} />
                <ComposerBlock
                  variation={variation}
                  campaignId={campaignId}
                  onMutated={onMutated}
                />
                <PerformanceBlock entries={performanceEntries} />
              </main>
              <aside className="space-y-5">
                <PropertiesAside
                  variation={variation}
                  adGroups={adGroups}
                  campaignId={campaignId}
                  onMutated={onMutated}
                />
                <StatusHistoryAside entries={statusHistory} />
              </aside>
            </div>
          </div>
        )}
        <ChatFAB />
      </div>

      <BrandDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this variation?"
        subtitle="This removes the variation, its copy elements, and performance history. Cannot be undone."
      >
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={deleting}
            onClick={() => setConfirmDelete(false)}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={doDelete}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete variation'}
          </button>
        </div>
      </BrandDialog>
    </DashboardLayout>
  );
}
