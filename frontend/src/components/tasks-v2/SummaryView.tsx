'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  RefreshCcw,
  Plus,
  AlarmClock,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import KpiCard from './KpiCard';
import WorkTypeDonut from './WorkTypeDonut';
import { TASK_TYPES } from './TYPE_META';

type UserField = string | { id?: number; username?: string; email?: string; name?: string } | null | undefined;

interface RecentActivity {
  id: number | string;
  event_type?: string;
  user?: UserField;
  task?: { id?: number; key?: string; summary?: string; status?: string; type?: string; priority?: string } | null;
  timestamp?: string;
  human_readable?: string;
  field_changed?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  comment_body?: string | null;
}

interface SummaryPayload {
  time_metrics?: {
    completed_last_7_days?: number;
    updated_last_7_days?: number;
    created_last_7_days?: number;
    due_soon?: number;
  };
  status_overview?: {
    total_work_items?: number;
    breakdown?: { status: string; display_name?: string; count: number; color?: string }[];
  };
  priority_breakdown?: { priority: string; count: number }[];
  types_of_work?: { type: string; display_name?: string; count: number; percentage?: number }[];
  recent_activity?: RecentActivity[];
}

const renderUserName = (u: UserField): string => {
  if (!u) return 'Someone';
  if (typeof u === 'string') return u;
  return u.username || u.name || u.email || 'Someone';
};

const eventLabel = (eventType?: string): string => {
  if (!eventType) return 'updated';
  return eventType
    .replace(/^task_/, '')
    .replace(/_/g, ' ');
};

interface SummaryViewProps {
  projectId: number | null;
}

export default function SummaryView({ projectId }: SummaryViewProps) {
  const [data, setData] = useState<SummaryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setData(null);
      return;
    }
    setLoading(true);
    api
      .get('/api/dashboard/summary/', { params: { project_id: projectId } })
      .then((r) => {
        setData(r.data as SummaryPayload);
        setError(null);
      })
      .catch((e) => {
        setError(
          e?.response?.data?.detail ||
            e?.response?.data?.error ||
            'Failed to load summary'
        );
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="rounded-xl bg-white p-12 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">
        Select a project to see its summary.
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-white p-16 text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading summary…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-rose-50 p-6 text-sm text-rose-600 ring-1 ring-rose-100">
        {error}
      </div>
    );
  }

  const tm = data?.time_metrics ?? {};
  const types = data?.types_of_work ?? [];
  const typeCounts: Record<string, number> = {};
  for (const t of types) typeCounts[t.type] = t.count;
  // Fallback: if backend returns empty but we want to show all 11 type slots,
  // donut renders an empty grey ring with total 0 — handled by WorkTypeDonut.

  const recent = data?.recent_activity ?? [];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={CheckCircle2}
          iconGradient="bg-gradient-to-br from-emerald-400 to-teal-500"
          value={tm.completed_last_7_days ?? 0}
          label="Completed"
          hint="last 7 days"
        />
        <KpiCard
          icon={RefreshCcw}
          iconGradient="bg-gradient-to-br from-sky-400 to-cyan-500"
          value={tm.updated_last_7_days ?? 0}
          label="Updated"
          hint="last 7 days"
        />
        <KpiCard
          icon={Plus}
          iconGradient="bg-gradient-to-br from-[#3CCED7] to-[#A6E661]"
          value={tm.created_last_7_days ?? 0}
          label="Created"
          hint="last 7 days"
        />
        <KpiCard
          icon={AlarmClock}
          iconGradient="bg-gradient-to-br from-amber-400 to-orange-500"
          value={tm.due_soon ?? 0}
          label="Due soon"
          hint="next 7 days"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Work type overview</h2>
            <span className="text-[11px] uppercase tracking-wider text-gray-400">
              {types.length} of {TASK_TYPES.length} types
            </span>
          </header>
          <WorkTypeDonut counts={typeCounts} />
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Types breakdown</h2>
            <span className="text-[11px] uppercase tracking-wider text-gray-400">
              {Object.keys(typeCounts).length || 0} active
            </span>
          </header>
          {types.length === 0 ? (
            <p className="text-sm text-gray-400">No type data yet.</p>
          ) : (
            <ul className="space-y-2">
              {TASK_TYPES.map((t) => {
                const count = typeCounts[t.value] || 0;
                const total = types.reduce((acc, x) => acc + x.count, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <li key={t.value} className="flex items-center gap-3 text-xs">
                    <span
                      className="inline-block h-2 w-2 flex-shrink-0 rounded-sm"
                      style={{ backgroundColor: t.hex }}
                    />
                    <span className="w-32 truncate text-gray-700">{t.label}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: t.hex }}
                      />
                    </div>
                    <span className="w-8 text-right text-gray-500">{count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Recent activity</h2>
          <span className="text-[11px] uppercase tracking-wider text-gray-400">
            last 14 days
          </span>
        </header>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="truncate">
                  <span className="font-medium text-gray-900">{renderUserName(item.user)}</span>
                  <span className="text-gray-500"> {eventLabel(item.event_type)} </span>
                  <span className="font-medium text-gray-700">{item.task?.summary ?? ''}</span>
                </div>
                <span className="flex-shrink-0 text-[11px] text-gray-400">
                  {item.human_readable ??
                    (item.timestamp
                      ? new Date(item.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      : '')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
