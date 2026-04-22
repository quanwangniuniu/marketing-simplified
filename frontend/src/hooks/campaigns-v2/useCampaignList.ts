'use client';

import { useCallback, useState } from 'react';
import { CampaignAPI } from '@/lib/api/campaignApi';
import type { CampaignData, CreateCampaignData } from '@/types/campaign';

export interface CampaignListParams {
  project?: string | number;
  status?: string;
  owner?: string | number;
  assignee?: string | number;
  search?: string;
}

export function useCampaignList() {
  const [items, setItems] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async (params?: CampaignListParams) => {
    setLoading(true);
    setError(null);
    try {
      const normalized = params
        ? Object.fromEntries(
            Object.entries(params)
              .filter(([, v]) => v !== undefined && v !== null && v !== '')
              .map(([k, v]) => [k, String(v)])
          )
        : undefined;
      const res = await CampaignAPI.getCampaigns(normalized as any);
      const list: CampaignData[] =
        (res.data as any)?.results || (res.data as any) || [];
      setItems(list);
      return list;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (payload: CreateCampaignData) => {
    const res = await CampaignAPI.createCampaign(payload);
    const created = res.data as CampaignData;
    setItems((prev) => [created, ...prev]);
    return created;
  }, []);

  return {
    items,
    loading,
    error,
    refresh,
    create,
  };
}
