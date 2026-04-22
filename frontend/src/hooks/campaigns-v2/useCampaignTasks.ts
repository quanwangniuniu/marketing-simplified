'use client';

import { useCallback, useState } from 'react';
import { CampaignAPI } from '@/lib/api/campaignApi';
import { TaskAPI } from '@/lib/api/taskApi';
import type { CampaignTaskLink } from '@/types/campaign';
import type { TaskData } from '@/types/task';

export interface EnrichedTaskLink {
  link: CampaignTaskLink;
  task: TaskData | null;
}

export function useCampaignTasks(campaignId: string | null) {
  const [items, setItems] = useState<EnrichedTaskLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    if (!campaignId) return [];
    setLoading(true);
    setError(null);
    try {
      const linksRes = await CampaignAPI.getTaskLinks(campaignId);
      const links: CampaignTaskLink[] =
        (linksRes.data as any)?.results || (linksRes.data as any) || [];
      const tasks = await Promise.all(
        links.map((l) =>
          TaskAPI.getTask(l.task)
            .then((r) => r.data as TaskData)
            .catch(() => null)
        )
      );
      const enriched: EnrichedTaskLink[] = links.map((l, i) => ({
        link: l,
        task: tasks[i] ?? null,
      }));
      setItems(enriched);
      return enriched;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  const link = useCallback(
    async (_taskId: number, _linkType?: string): Promise<CampaignTaskLink> => {
      throw new Error(
        'useCampaignTasks.link not implemented yet; add CampaignAPI.createTaskLink first'
      );
    },
    []
  );

  const unlink = useCallback(async (_linkId: string): Promise<void> => {
    throw new Error(
      'useCampaignTasks.unlink not implemented yet; add CampaignAPI.deleteTaskLink first'
    );
  }, []);

  return { items, loading, error, refresh, link, unlink };
}
