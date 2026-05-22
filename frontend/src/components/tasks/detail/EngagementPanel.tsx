'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskAPI } from '@/lib/api/taskApi';
import { getTaskEngagement } from '@/lib/tracking/api';
import type { EngagementData } from '@/lib/tracking/types';
import type { TaskCollaborationMetrics } from '@/types/task';

function relativeTime(iso: string | null): string {
  if (!iso) return '—';

  const d = new Date(iso);

  if (isNaN(d.getTime())) return '—';

  const diff = Math.floor((Date.now() - d.getTime()) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

function metricValue(value: number | null | undefined): string {
  if (typeof value !== 'number') return '—';
  return value.toLocaleString();
}

function durationValue(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || seconds <= 0) return '—';
  return activeTime(seconds);
}

const ROW = 'grid grid-cols-[1fr_auto] items-baseline gap-2 py-1.5';
const LABEL = 'text-[11px] font-medium uppercase tracking-wide text-gray-500';
const VALUE = 'text-sm font-medium text-gray-900 text-right';

export default function EngagementPanel({
  taskId,
  loading: parentLoading = false,
  refreshKey = 0,
}: {
  taskId: number;
  loading?: boolean;
  refreshKey?: number;
}) {
  const [data, setData] = useState<EngagementData | null>(null);
  const [err, setErr] = useState(false);

  const [collaborationMetrics, setCollaborationMetrics] =
    useState<TaskCollaborationMetrics | null>(null);
  const [collaborationErr, setCollaborationErr] = useState(false);

  useEffect(() => {
    if (parentLoading || !taskId) return;

    let cancelled = false;

    setErr(false);

    getTaskEngagement(taskId)
      .then((d) => {
        if (!cancelled) {
          setData(d);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErr(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [taskId, parentLoading, refreshKey]);

  useEffect(() => {
    if (parentLoading || !taskId) return;

    let cancelled = false;

    setCollaborationErr(false);

    TaskAPI.getCollaborationMetrics(taskId)
      .then((metrics) => {
        if (!cancelled) {
          setCollaborationMetrics(metrics);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCollaborationMetrics(null);
          setCollaborationErr(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [taskId, parentLoading, refreshKey]);

  const collaborationSection = (
    <div className="mt-5 border-t border-gray-100 pt-4">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Collaboration &amp; Knowledge
      </h4>

      {collaborationErr ? (
        <p className="pt-1 text-xs text-gray-400">
          Collaboration metrics unavailable.
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Discussion
            </p>

            <div className={ROW}>
              <span className={LABEL}>Avg response time</span>
              <span className={VALUE}>
                {durationValue(
                  collaborationMetrics?.comment_response.average_response_time_secs
                )}
              </span>
            </div>

            <div className={ROW}>
              <span className={LABEL}>Clarifications</span>
              <span className={VALUE}>
                {metricValue(collaborationMetrics?.clarifications.request_count)}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Mentions &amp; Access
            </p>

            <div className={ROW}>
              <span className={LABEL}>Reviewer pings</span>
              <span className={VALUE}>
                {metricValue(
                  collaborationMetrics?.mentions.reviewer_ping_count
                )}
              </span>
            </div>

            <div className={ROW}>
              <span className={LABEL}>Cross-team mentions</span>
              <span className={VALUE}>
                {metricValue(
                  collaborationMetrics?.mentions.cross_team_mention_count
                )}
              </span>
            </div>

            <div className={ROW}>
              <span className={LABEL}>Shared access</span>
              <span className={VALUE}>
                {metricValue(collaborationMetrics?.shared_access.access_count)}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Knowledge
            </p>

            <div className={ROW}>
              <span className={LABEL}>Documentation revisits</span>
              <span className={VALUE}>
                {metricValue(
                  collaborationMetrics?.documentation_revisits.revisit_count
                )}
              </span>
            </div>

            <div className={ROW}>
              <span className={LABEL}>Internal searches</span>
              <span className={VALUE}>
                {metricValue(collaborationMetrics?.internal_searches.search_count)}
              </span>
            </div>

            <div className={ROW}>
              <span className={LABEL}>AI help requests</span>
              <span className={VALUE}>
                {metricValue(collaborationMetrics?.ai_help_requests.request_count)}
              </span>
            </div>

            <div className={ROW}>
              <span className={LABEL}>Snippet interactions</span>
              <span className={VALUE}>
                {metricValue(
                  collaborationMetrics?.snippet_interactions.interaction_count
                )}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Approvals
            </p>

            <div className={ROW}>
              <span className={LABEL}>Avg approval delay</span>
              <span className={VALUE}>
                {durationValue(
                  collaborationMetrics?.approval_delays.average_delay_secs
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

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
        <p className="pt-1 text-xs text-gray-400">
          Engagement data unavailable.
        </p>
      ) : data && data.open_count === 0 ? (
        <p className="pt-1 text-xs text-gray-400">
          No engagement recorded yet.
        </p>
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
            <span className={VALUE}>
              {relativeTime(data.first_interaction_at)}
            </span>
          </div>

          <div className={ROW}>
            <span className={LABEL}>Last opened by you</span>
            <span className={VALUE}>{relativeTime(data.last_open_at)}</span>
          </div>

          <div className={ROW}>
            <span className={LABEL}>Your active time</span>
            <span className={VALUE}>
              {activeTime(data.total_active_seconds)}
            </span>
          </div>
        </div>
      ) : null}

      {parentLoading ? null : collaborationSection}
    </section>
  );
}