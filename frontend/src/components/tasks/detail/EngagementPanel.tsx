'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskAPI } from '@/lib/api/taskApi';
import { TaskEngagementAPI } from '@/lib/api/taskEngagementApi';
import { getTaskEngagement } from '@/lib/tracking/api';
import type { TaskEngagementSummary } from '@/types/taskEngagement';
import type { TaskCollaborationMetrics } from '@/types/task';
import type { EngagementData } from '@/lib/tracking/types';

const SKELETON_ROWS = 7;

/** Match PropertiesPanel / ApprovalTimelinePanel sidebar typography */
const CARD_TITLE =
  'mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500';
const ROW_LABEL = 'text-[11px] font-medium uppercase tracking-wide text-gray-500';
const GROUP_LABEL =
  'shrink-0 text-[10px] font-medium uppercase tracking-wider text-gray-400';
const BODY_MUTED = 'text-xs text-gray-400';

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const countFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
  useGrouping: true,
});

function formatCount(n: number): string {
  return countFormatter.format(n);
}

function formatDurationMs(ms: number): string {
  if (ms <= 0) return '0s';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return remSec > 0 ? `${min}m ${remSec}s` : `${min}m`;
  const h = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin > 0 ? `${h}h ${remMin}m` : `${h}h`;
}


function metricValue(value: number | null | undefined): string {
  if (typeof value !== 'number') return '—';
  return value.toLocaleString();
}

function durationValue(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || seconds <= 0) return '—';
  return formatDurationMs(seconds * 1000);
}

function GroupLabel({ children }: { children: string }) {
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

  return (
    <div className="flex items-center gap-2 py-2">
      <div className="h-px flex-1 bg-gray-100" aria-hidden />
      <span className={GROUP_LABEL}>{children}</span>
      <div className="h-px flex-1 bg-gray-100" aria-hidden />
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-2 py-1.5">
      <span className={ROW_LABEL}>{label}</span>
      <span
        className={`text-right text-xs font-normal tabular-nums ${
          highlight ? 'text-primary' : 'text-gray-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function EngagementPanel({
  taskId,
  refreshKey,
  loading: parentLoading = false,
}: {
  taskId: number;
  refreshKey: number;
  loading?: boolean;
}) {
  const [tracking, setTracking] = useState<EngagementData | null>(null);
  const [trackingErr, setTrackingErr] = useState(false);
  const [summary, setSummary] = useState<TaskEngagementSummary | null>(null);
  const [summaryErr, setSummaryErr] = useState(false);

  const [collaborationMetrics, setCollaborationMetrics] =
    useState<TaskCollaborationMetrics | null>(null);
  const [collaborationErr, setCollaborationErr] = useState(false);

  useEffect(() => {
    if (parentLoading || !taskId) {
      setTracking(null);
      setTrackingErr(false);
      return;
    }

    let cancelled = false;
    setTracking(null);
    setTrackingErr(false);

    getTaskEngagement(taskId)
      .then((d) => {
        if (!cancelled) setTracking(d);
      })
      .catch(() => {
        if (!cancelled) setTrackingErr(true);
      });

    return () => {
      cancelled = true;
    };
  }, [parentLoading, taskId, refreshKey]);

  useEffect(() => {
    if (parentLoading || !taskId) {
      setSummary(null);
      setSummaryErr(false);
      return;
    }

    let cancelled = false;
    setSummary(null);
    setSummaryErr(false);

    const timer = window.setTimeout(() => {
      TaskEngagementAPI.getEngagementSummary(taskId)
        .then((d) => {
          if (!cancelled) setSummary(d);
        })
        .catch(() => {
          if (!cancelled) setSummaryErr(true);
        });
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [parentLoading, taskId, refreshKey]);

  const trackingReady = tracking !== null || trackingErr;
  const summaryReady = summary !== null || summaryErr;
  const showSkeleton =
    parentLoading || !trackingReady || !summaryReady;

  const hasSummaryMetrics =
    summary !== null &&
    (summary.estimated_active_ms > 0 ||
      summary.write_operations_count > 0 ||
      summary.last_operated_at !== null);

  const showEmptyState =
    trackingReady &&
    !trackingErr &&
    tracking !== null &&
    tracking.open_count === 0 &&
    !hasSummaryMetrics;

  const showVisits =
    !showEmptyState && (trackingErr || (tracking !== null && !trackingErr));
  const showOperations =
    !showEmptyState && (summaryErr || summary !== null);

  return (
    <section className="min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <h3 className={CARD_TITLE}>Focus insights</h3>

      {showSkeleton && (
        <div className="space-y-2">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton key={`engagement-skel-${i}`} className="h-3.5 w-full" />
          ))}
        </div>
      )}

      {!showSkeleton && trackingErr && summaryErr && (
        <p className={BODY_MUTED}>Activity data unavailable.</p>
      )}

      {!showSkeleton && !(trackingErr && summaryErr) && (
        <>
          {showEmptyState ? (
            <p className={BODY_MUTED}>No engagement recorded yet.</p>
          ) : (
            <div className="space-y-0.5">
              {showVisits && (
                <>
                  <GroupLabel>Visits</GroupLabel>
                  {trackingErr ? (
                    <p className={`py-1 ${BODY_MUTED}`}>
                      Visit history unavailable.
                    </p>
                  ) : tracking ? (
                    <>
                      <StatRow
                        label="Opens"
                        value={formatCount(tracking.open_count)}
                      />
                      <StatRow
                        label="First interaction"
                        value={relativeTime(tracking.first_interaction_at)}
                      />
                      <StatRow
                        label="Last opened"
                        value={relativeTime(tracking.last_open_at)}
                      />
                    </>
                  ) : null}
                </>
              )}

              {showOperations && (
                <>
                  <GroupLabel>Operations</GroupLabel>
                  {summaryErr ? (
                    <p className={`py-1 ${BODY_MUTED}`}>
                      Operation metrics unavailable.
                    </p>
                  ) : summary ? (
                    <>
                      <StatRow
                        label="Estimated active time"
                        value={formatDurationMs(summary.estimated_active_ms)}
                        highlight
                      />
                      <StatRow
                        label="Write operations"
                        value={formatCount(summary.write_operations_count)}
                      />
                      <StatRow
                        label="Last operate"
                        value={relativeTime(summary.last_operated_at)}
                      />
                    </>
                  ) : null}
                </>
              )}

              <GroupLabel>Collaboration &amp; Knowledge</GroupLabel>

              {collaborationErr ? (
                <p className={`py-1 ${BODY_MUTED}`}>
                  Collaboration metrics unavailable.
                </p>
              ) : (
                <>
                  <StatRow
                    label="Avg response time"
                    value={durationValue(
                      collaborationMetrics?.comment_response.average_response_time_secs
                    )}
                  />
                  <StatRow
                    label="Clarifications"
                    value={metricValue(collaborationMetrics?.clarifications.request_count)}
                  />
                  <StatRow
                    label="Reviewer pings"
                    value={metricValue(
                      collaborationMetrics?.mentions.reviewer_ping_count
                    )}
                  />
                  <StatRow
                    label="Cross-team mentions"
                    value={metricValue(
                      collaborationMetrics?.mentions.cross_team_mention_count
                    )}
                  />
                  <StatRow
                    label="Shared access"
                    value={metricValue(collaborationMetrics?.shared_access.access_count)}
                  />
                  <StatRow
                    label="Documentation revisits"
                    value={metricValue(
                      collaborationMetrics?.documentation_revisits.revisit_count
                    )}
                  />
                  <StatRow
                    label="Internal searches"
                    value={metricValue(
                      collaborationMetrics?.internal_searches.search_count
                    )}
                  />
                  <StatRow
                    label="AI help requests"
                    value={metricValue(
                      collaborationMetrics?.ai_help_requests.request_count
                    )}
                  />
                  <StatRow
                    label="Snippet interactions"
                    value={metricValue(
                      collaborationMetrics?.snippet_interactions.interaction_count
                    )}
                  />
                  <StatRow
                    label="Avg approval delay"
                    value={durationValue(
                      collaborationMetrics?.approval_delays.average_delay_secs
                    )}
                  />
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
