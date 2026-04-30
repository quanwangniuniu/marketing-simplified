'use client';

import { useCallback, useMemo, useState } from 'react';
import { CampaignAPI } from '@/lib/api/campaignApi';
import type { CampaignData, UpdateCampaignData } from '@/types/campaign';

export function useCampaign(campaignId: string | null) {
  const [data, setData] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    if (!campaignId) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await CampaignAPI.getCampaign(campaignId);
      setData(res.data);
      return res.data as CampaignData;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  const update = useCallback(
    async (payload: UpdateCampaignData) => {
      if (!campaignId) throw new Error('No campaign id');
      const res = await CampaignAPI.updateCampaign(campaignId, payload);
      setData(res.data);
      return res.data as CampaignData;
    },
    [campaignId]
  );

  const softDelete = useCallback(async () => {
    if (!campaignId) throw new Error('No campaign id');
    await CampaignAPI.deleteCampaign(campaignId);
    setData(null);
  }, [campaignId]);

  const transition = useCallback(
    async (action: string, statusNote?: string) => {
      if (!campaignId) throw new Error('No campaign id');
      const res = await CampaignAPI.transitionStatus(campaignId, action, statusNote);
      setData(res.data as CampaignData);
      return res.data as CampaignData;
    },
    [campaignId]
  );

  const isEditable = useMemo(() => {
    if (!data) return false;
    return data.status !== 'ARCHIVED';
  }, [data]);

  const assertEditable = useCallback(() => {
    if (!isEditable) {
      throw new Error('Archived campaigns cannot be edited. Use restore() first.');
    }
  }, [isEditable]);

  return {
    data,
    setData,
    loading,
    error,
    refresh,
    update,
    softDelete,
    transition,
    isEditable,
    assertEditable,
  };
}
