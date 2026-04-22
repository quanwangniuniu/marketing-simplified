'use client';

import { useCallback, useState } from 'react';
import { CampaignAPI } from '@/lib/api/campaignApi';
import type { CampaignStatusHistoryItem } from '@/types/campaign';

export function useCampaignStatusHistory(campaignId: string | null) {
  const [items, setItems] = useState<CampaignStatusHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    if (!campaignId) return [];
    setLoading(true);
    setError(null);
    try {
      const res = await CampaignAPI.getStatusHistory(campaignId);
      const list = Array.isArray(res.data)
        ? (res.data as CampaignStatusHistoryItem[])
        : [];
      setItems(list);
      return list;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  return { items, loading, error, refresh };
}
