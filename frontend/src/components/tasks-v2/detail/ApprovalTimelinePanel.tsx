'use client';

import { useEffect, useState } from 'react';
import { TaskAPI } from '@/lib/api/taskApi';
import { Skeleton } from '@/components/ui/skeleton';

interface HistoryEntry {
  id?: number;
  action?: string;
  approved_by?: { username?: string; email?: string; id?: number };
  user?: { username?: string; email?: string; id?: number };
  comment?: string | null;
  created_at?: string;
  decided_time?: string;
  is_approved?: boolean;
  step_number?: number;
  role_name?: string;
}

function fmtTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US');
}

function entryLabel(e: HistoryEntry): string {
  if (e.action) return e.action;
  if (e.is_approved === true) return 'Approved';
  if (e.is_approved === false) return 'Rejected';
  return e.role_name ? `Step ${e.step_number ?? '?'} · ${e.role_name}` : 'Event';
}

function entryUser(e: HistoryEntry): string {
  const u = e.approved_by || e.user;
  if (!u) return '';
  return u.username || u.email || `User ${u.id ?? ''}`;
}

export default function ApprovalTimelinePanel({
  taskId,
  refreshKey,
  loading = false,
}: {
  taskId: number;
  refreshKey: number;
  loading?: boolean;
}) {
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    TaskAPI.getApprovalHistory(taskId)
      .then((resp) => {
        if (cancelled) return;
        const data = resp.data as any;
        const list: HistoryEntry[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data?.history)
              ? data.history
              : [];
        setItems(list);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr((e as any)?.response?.data?.detail || 'Failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, [loading, taskId, refreshKey]);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Approval Timeline
      </h3>
      {err && <p className="text-xs text-rose-600">{err}</p>}
      {(loading || (!err && items === null)) ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`task-approval-skeleton-${index}`} className="flex gap-2.5">
              <Skeleton className="mt-1.5 h-2 w-2 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {items && items.length === 0 && (
        <p className="text-xs text-gray-400">No approval history yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((e, idx) => (
            <li key={e.id ?? idx} className="flex gap-2.5">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  e.is_approved === true
                    ? 'bg-emerald-500'
                    : e.is_approved === false
                      ? 'bg-rose-500'
                      : 'bg-gray-300'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-900">{entryLabel(e)}</p>
                <p className="truncate text-[11px] text-gray-500">
                  {entryUser(e)} · {fmtTime(e.created_at || e.decided_time)}
                </p>
                {e.comment && (
                  <p className="mt-1 rounded-md bg-gray-50 px-2 py-1 text-[11px] text-gray-700">
                    {e.comment}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
