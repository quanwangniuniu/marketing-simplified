'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getTaskEngagement } from '@/lib/tracking/api';
import type { EngagementData } from '@/lib/tracking/types';

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function activeTime(seconds: number): string {
  if (seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

const ROW = 'grid grid-cols-[1fr_auto] items-baseline gap-2 py-1.5';
const LABEL = 'text-[11px] font-medium uppercase tracking-wide text-gray-500';
const VALUE = 'text-sm font-medium text-gray-900 text-right';

export default function EngagementPanel({
  taskId,
  loading: parentLoading = false,
}: {
  taskId: number;
  loading?: boolean;
}) {
  const [data, setData] = useState<EngagementData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (parentLoading || !taskId) return;
    let cancelled = false;
    setErr(false);
    getTaskEngagement(taskId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setErr(true); });
    return () => { cancelled = true; };
  }, [taskId, parentLoading]);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Engagement
      </h3>

      {parentLoading || (!data && !err) ? (
        <div className="space-y-2 pt-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : err ? (
        <p className="pt-1 text-xs text-gray-400">Engagement data unavailable.</p>
      ) : data && data.open_count === 0 ? (
        <p className="pt-1 text-xs text-gray-400">No engagement recorded yet.</p>
      ) : data ? (
        <div className="pt-0.5">
          <div className="py-1.5 text-sm text-gray-700">
            You&apos;ve opened this{' '}
            <span className="font-semibold text-gray-900">
              {data.open_count === 1 ? '1 time' : `${data.open_count} times`}
            </span>
          </div>
          <div className={ROW}>
            <span className={LABEL}>Your first interaction</span>
            <span className={VALUE}>{relativeTime(data.first_interaction_at)}</span>
          </div>
          <div className={ROW}>
            <span className={LABEL}>Last opened by you</span>
            <span className={VALUE}>{relativeTime(data.last_open_at)}</span>
          </div>
          <div className={ROW}>
            <span className={LABEL}>Your active time</span>
            <span className={VALUE}>{activeTime(data.total_active_seconds)}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
