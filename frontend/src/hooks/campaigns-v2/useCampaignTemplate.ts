'use client';

import { useCallback, useState } from 'react';
import { CampaignAPI } from '@/lib/api/campaignApi';
import type { CampaignTemplate, UpdateTemplateData } from '@/types/campaign';

function sanitizePayload(payload: UpdateTemplateData): UpdateTemplateData {
  const clone: UpdateTemplateData = { ...payload };
  delete (clone as any).project_id;
  delete (clone as any).sharing_scope;
  return clone;
}

export function useCampaignTemplate(templateId: string | null) {
  const [data, setData] = useState<CampaignTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    if (!templateId) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await CampaignAPI.getTemplate(templateId);
      setData(res.data);
      return res.data as CampaignTemplate;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  const update = useCallback(
    async (payload: UpdateTemplateData) => {
      if (!templateId) throw new Error('No template id');
      const safe = sanitizePayload(payload);
      const res = await CampaignAPI.updateTemplate(templateId, safe);
      setData(res.data);
      return res.data as CampaignTemplate;
    },
    [templateId]
  );

  const archive = useCallback(async () => {
    if (!templateId) throw new Error('No template id');
    const res = await CampaignAPI.updateTemplate(templateId, { is_archived: true } as any);
    setData(res.data);
    return res.data as CampaignTemplate;
  }, [templateId]);

  const unarchive = useCallback(async () => {
    if (!templateId) throw new Error('No template id');
    const res = await CampaignAPI.updateTemplate(templateId, { is_archived: false } as any);
    setData(res.data);
    return res.data as CampaignTemplate;
  }, [templateId]);

  const destroy = useCallback(async () => {
    if (!templateId) throw new Error('No template id');
    await CampaignAPI.deleteTemplate(templateId);
    setData(null);
  }, [templateId]);

  return { data, setData, loading, error, refresh, update, archive, unarchive, destroy };
}
