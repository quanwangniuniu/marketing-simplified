'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CampaignAPI } from '@/lib/api/campaignApi';
import type { CampaignTemplate } from '@/types/campaign';

export interface TemplateListParams {
  sharing_scope?: string;
  project?: number | string;
  creator?: number | string;
}

export function useCampaignTemplates() {
  const [items, setItems] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastKeyRef = useRef<string>('');

  const refresh = useCallback(async (params?: TemplateListParams) => {
    const key = JSON.stringify(params || {});
    if (abortRef.current) abortRef.current.abort();
    if (key === lastKeyRef.current && items.length > 0) return items;
    lastKeyRef.current = key;
    const ctl = new AbortController();
    abortRef.current = ctl;
    setLoading(true);
    setError(null);
    try {
      const res = await CampaignAPI.getTemplates(
        params ? { ...params, project: params.project as any, creator: params.creator as any } : undefined
      );
      const list: CampaignTemplate[] =
        (res.data as any)?.results || (res.data as any) || [];
      setItems(list);
      return list;
    } catch (err) {
      if ((err as any)?.name === 'CanceledError' || (err as any)?.name === 'AbortError') return [];
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const archive = useCallback(async (id: string) => {
    await CampaignAPI.updateTemplate(id, { is_archived: true } as any);
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, is_archived: true } : t)));
  }, []);

  const unarchive = useCallback(async (id: string) => {
    await CampaignAPI.updateTemplate(id, { is_archived: false } as any);
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, is_archived: false } : t)));
  }, []);

  const destroy = useCallback(async (id: string) => {
    await CampaignAPI.deleteTemplate(id);
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { items, loading, error, refresh, archive, unarchive, destroy };
}
