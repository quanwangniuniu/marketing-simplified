'use client';

import { useCallback, useState } from 'react';
import { CampaignAPI } from '@/lib/api/campaignApi';
import type {
  CampaignCheckIn,
  CreateCheckInData,
  UpdateCheckInData,
} from '@/types/campaign';

export function useCampaignCheckIns(campaignId: string | null) {
  const [items, setItems] = useState<CampaignCheckIn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(
    async (params?: { sentiment?: string }) => {
      if (!campaignId) return [];
      setLoading(true);
      setError(null);
      try {
        const res = await CampaignAPI.getCheckIns(campaignId, params);
        const list: CampaignCheckIn[] =
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
    async (payload: CreateCheckInData) => {
      if (!campaignId) throw new Error('No campaign id');
      const res = await CampaignAPI.createCheckIn(campaignId, payload);
      const created = res.data as CampaignCheckIn;
      setItems((prev) => [created, ...prev]);
      return created;
    },
    [campaignId]
  );

  const update = useCallback(
    async (id: string, payload: UpdateCheckInData) => {
      if (!campaignId) throw new Error('No campaign id');
      const res = await CampaignAPI.updateCheckIn(campaignId, id, payload);
      const updated = res.data as CampaignCheckIn;
      setItems((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    },
    [campaignId]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!campaignId) throw new Error('No campaign id');
      await CampaignAPI.deleteCheckIn(campaignId, id);
      setItems((prev) => prev.filter((c) => c.id !== id));
    },
    [campaignId]
  );

  return { items, loading, error, refresh, create, update, remove };
}
