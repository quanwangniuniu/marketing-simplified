'use client';

import { useCallback, useState } from 'react';
import { CampaignAPI } from '@/lib/api/campaignApi';
import type { CampaignActivityTimelineItem } from '@/types/campaign';

interface TimelineResponse {
  count: number;
  results: CampaignActivityTimelineItem[];
  page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
}

export function useCampaignActivity(campaignId: string | null) {
  const [items, setItems] = useState<CampaignActivityTimelineItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    async (opts?: { page?: number; page_size?: number }) => {
      if (!campaignId) return;
      const nextPage = opts?.page ?? page;
      const nextSize = opts?.page_size ?? pageSize;
      setLoading(true);
      setError(null);
      try {
        const res = await CampaignAPI.getActivityTimeline(campaignId, {
          page: nextPage,
          page_size: nextSize,
        });
        const body = res.data as unknown as TimelineResponse;
        setItems(body.results || []);
        setPage(body.page || nextPage);
        setPageSize(body.page_size || nextSize);
        setTotalCount(body.count || 0);
        setHasNext(!!body.next);
        setHasPrevious(!!body.previous);
        return body;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [campaignId, page, pageSize]
  );

  return {
    items,
    page,
    pageSize,
    totalCount,
    hasNext,
    hasPrevious,
    loading,
    error,
    load,
    setPage,
    setPageSize,
  };
}
