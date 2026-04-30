'use client';

import { useCallback, useState } from 'react';
import { CampaignAPI } from '@/lib/api/campaignApi';
import type {
  CreateSnapshotData,
  PerformanceSnapshot,
  UpdateSnapshotData,
} from '@/types/campaign';

export function useCampaignSnapshots(campaignId: string | null) {
  const [items, setItems] = useState<PerformanceSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(
    async (params?: { milestone_type?: string; metric_type?: string }) => {
      if (!campaignId) return [];
      setLoading(true);
      setError(null);
      try {
        const res = await CampaignAPI.getSnapshots(campaignId, params);
        const list: PerformanceSnapshot[] =
          (res.data as any)?.results || (res.data as any) || [];
        setItems(list);
        return list;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [campaignId]
  );

  const create = useCallback(
    async (payload: CreateSnapshotData) => {
      if (!campaignId) throw new Error('No campaign id');
      const res = await CampaignAPI.createSnapshot(campaignId, payload);
      const created = res.data as PerformanceSnapshot;
      setItems((prev) => [created, ...prev]);
      return created;
    },
    [campaignId]
  );

  const update = useCallback(
    async (id: string, payload: UpdateSnapshotData) => {
      if (!campaignId) throw new Error('No campaign id');
      const res = await CampaignAPI.updateSnapshot(campaignId, id, payload);
      const updated = res.data as PerformanceSnapshot;
      setItems((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return updated;
    },
    [campaignId]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!campaignId) throw new Error('No campaign id');
      await CampaignAPI.deleteSnapshot(campaignId, id);
      setItems((prev) => prev.filter((s) => s.id !== id));
    },
    [campaignId]
  );

  const uploadScreenshot = useCallback(
    async (id: string, file: File) => {
      if (!campaignId) throw new Error('No campaign id');
      const res = await CampaignAPI.uploadScreenshot(campaignId, id, file);
      const updated = res.data as PerformanceSnapshot;
      setItems((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return updated;
    },
    [campaignId]
  );

  return { items, loading, error, refresh, create, update, remove, uploadScreenshot };
}
