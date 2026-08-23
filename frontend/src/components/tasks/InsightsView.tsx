'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, Clock, ShieldAlert, Hourglass, Flame,
  CheckCircle2, Circle, TrendingUp, History, ChevronDown, ChevronUp,
  Plus, Lock, User, Flag, CalendarDays, RefreshCw, Info,
} from 'lucide-react';
import { TaskAPI } from '@/lib/api/taskApi';
import type {
  TaskIntelligencePayload,
  IntelligenceTaskStub,
  IntelligenceVelocityPoint,
  WorkCycleHistoryPayload,
  WorkCycleTaskStub,
  WorkCycleFieldEntry,
} from '@/types/task';
import { Skeleton } from '@/components/ui/skeleton';
import { Id } from '@/types/common';
import { useBuildUrl } from '@/lib/buildUrl';

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved', LOCKED: 'Locked', REJECTED: 'Rejected', CANCELLED: 'Cancelled',
};

const PRIORITY_CLS: Record<string, string> = {
  HIGHEST: 'text-rose-600', HIGH: 'text-orange-500',
  MEDIUM: 'text-gray-400', LOW: 'text-sky-500', LOWEST: 'text-gray-300',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatWeek(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fieldLabel(field: string) {
  return field.replace(/_/g, ' ');
}

// ── Progress strip ────────────────────────────────────────────────────────────

function ProgressStrip({ data }: { data: TaskIntelligencePayload }) {
  const { progress, overdue, blocked, due_soon } = data;
  const pct = progress.completion_pct;

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">Progress</h2>
        <span className="text-2xl font-bold text-gray-900">{pct}%</span>
      </div>

      {/* Completion bar */}
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Status buckets */}
      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xl font-bold text-gray-900">{progress.todo}</p>
          <p className="text-[11px] text-gray-400">To do</p>
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{progress.in_progress}</p>
          <p className="text-[11px] text-gray-400">In progress</p>
        </div>
        <div>
          <p className="text-xl font-bold text-[#3CCED7]">{progress.done}</p>
          <p className="text-[11px] text-gray-400">Done</p>
        </div>
      </div>

      {/* Signal pills */}
      <div className="flex flex-wrap gap-2">
        {overdue.count > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-600">
            <AlertTriangle className="h-3 w-3" /> {overdue.count} overdue
          </span>
        )}
        {blocked.count > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-600">
            <ShieldAlert className="h-3 w-3" /> {blocked.count} blocked
          </span>
        )}
        {due_soon.count > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-600">
            <Clock className="h-3 w-3" /> {due_soon.count} due soon
          </span>
        )}
        {overdue.count === 0 && blocked.count === 0 && due_soon.count === 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> On track
          </span>
        )}
      </div>
    </section>
  );
}

// ── Task stub row ─────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: IntelligenceTaskStub }) {
  const buildUrl = useBuildUrl();
  return (
    <li className="flex min-w-0 items-center gap-2 py-1.5">
      {task.priority && (
        <span className={`shrink-0 text-[10px] font-bold ${PRIORITY_CLS[task.priority] ?? 'text-gray-400'}`}>
          {task.priority[0]}
        </span>
      )}
      <Link
        href={buildUrl(`/tasks/${task.slug}`)}
        className="min-w-0 flex-1 truncate text-sm text-gray-800 hover:text-[#3CCED7] hover:underline"
      >
        {task.summary}
      </Link>
      {task.due_date && (
        <span className="shrink-0 text-[11px] text-gray-400">{formatDate(task.due_date)}</span>
      )}
      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
        {STATUS_LABEL[task.status] ?? task.status}
      </span>
    </li>
  );
}

// ── Info tooltip ──────────────────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="flex h-4 w-4 items-center justify-center rounded-full text-gray-300 hover:text-gray-500 focus:outline-none"
        aria-label="More info"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute left-1/2 top-5 z-30 w-56 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] font-medium leading-relaxed text-gray-700 shadow-lg">
          <div className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-l border-t border-gray-200 bg-white" />
          <p className="relative">{text}</p>
        </div>
      )}
    </div>
  );
}

// ── Health signal card ────────────────────────────────────────────────────────

function SignalCard({
  icon: Icon,
  label,
  count,
  tasks,
  iconCls,
  bgCls,
  hint,
}: {
  icon: typeof AlertTriangle;
  label: string;
  count: number;
  tasks: IntelligenceTaskStub[];
  iconCls: string;
  bgCls: string;
  hint: string;
}) {
  return (
    <div className="flex h-[260px] flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${bgCls}`}>
            <Icon className={`h-3.5 w-3.5 ${iconCls}`} />
          </span>
          <span className="text-[13px] font-semibold text-gray-900">{label}</span>
          <InfoTip text={hint} />
        </div>
        <span className={`text-lg font-bold ${count > 0 ? iconCls : 'text-gray-300'}`}>{count}</span>
      </div>

      {count === 0 ? (
        <p className="text-[12px] text-gray-400">All clear</p>
      ) : (
        <ul className="task-tab-scrollbar flex-1 divide-y divide-gray-50 overflow-y-auto pr-1">
          {tasks.map((t) => <TaskRow key={t.id} task={t} />)}
        </ul>
      )}
    </div>
  );
}

// ── Velocity chart ────────────────────────────────────────────────────────────

function VelocityChart({ points }: { points: IntelligenceVelocityPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-[12px] text-gray-400">
        Not enough history to show velocity
      </div>
    );
  }

  const max = Math.max(...points.map((p) => p.count), 1);

  return (
    <div className="flex items-end gap-1.5" style={{ height: 80 }}>
      {points.map((p) => (
        <div key={p.week} className="group relative flex flex-1 flex-col items-center justify-end" style={{ height: 80 }}>
          <div
            className="w-full rounded-t bg-gradient-to-t from-[#3CCED7] to-[#A6E661] transition-all"
            style={{ height: `${Math.max((p.count / max) * 72, 4)}px` }}
          />
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 hidden whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
            {p.count} done · {formatWeek(p.week)}
          </span>
          <span className="mt-1 text-[9px] text-gray-400">{formatWeek(p.week).split(' ')[0]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Work cycle history ────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function CycleTaskRow({ task }: { task: WorkCycleTaskStub }) {
  const buildUrl = useBuildUrl();
  return (
    <li className="flex min-w-0 items-center gap-2 py-1">
      <Link
        href={buildUrl(`/tasks/${task.slug}`)}
        className="min-w-0 flex-1 truncate text-[12px] text-gray-700 hover:text-[#3CCED7] hover:underline"
      >
        {task.summary}
      </Link>
      <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
        {STATUS_LABEL[task.status] ?? task.status}
      </span>
    </li>
  );
}

function CycleFieldRow({ entry }: { entry: WorkCycleFieldEntry }) {
  const buildUrl = useBuildUrl();
  return (
    <li className="flex min-w-0 items-start gap-2 py-1">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] text-gray-700">
          <Link href={buildUrl(`/tasks/${entry.task_slug ?? entry.task_id}`)} className="font-medium hover:text-[#3CCED7] hover:underline">
            {entry.task_summary}
          </Link>
          {entry.old_value && entry.new_value
            ? <span className="text-gray-400"> · {entry.old_value} → {entry.new_value}</span>
            : entry.new_value
              ? <span className="text-gray-400"> → {entry.new_value}</span>
              : null}
        </p>
        <p className="mt-0.5 text-[10px] text-gray-400">
          {entry.changed_by ?? 'System'} · {formatDate(entry.changed_at)}
        </p>
      </div>
    </li>
  );
}

interface CycleSectionProps {
  label: string;
  icon: typeof Plus;
  iconCls: string;
  count: number;
  children: React.ReactNode;
}

function CycleSection({ label, icon: Icon, iconCls, count, children }: CycleSectionProps) {
  const [open, setOpen] = useState(true);
  if (count === 0) return null;
  return (
    <div className="border-b border-gray-50 last:border-0 pb-2 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 py-1.5 text-left"
      >
        <span className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 shrink-0 ${iconCls}`} />
          <span className="text-[12px] font-semibold text-gray-800">{label}</span>
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{count}</span>
        </span>
        {open
          ? <ChevronUp className="h-3 w-3 shrink-0 text-gray-300" />
          : <ChevronDown className="h-3 w-3 shrink-0 text-gray-300" />}
      </button>
      {open && (
        <ul className="task-tab-scrollbar ml-5 max-h-[200px] divide-y divide-gray-50 overflow-y-auto pr-1">
          {children}
        </ul>
      )}
    </div>
  );
}

function WorkCycleHistory({ projectId }: { projectId: Id | null }) {
  const [dateFrom, setDateFrom] = useState(monthStartISO);
  const [dateTo, setDateTo] = useState(todayISO);
  const [data, setData] = useState<WorkCycleHistoryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = (from: string, to: string) => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    TaskAPI.getWorkCycle({ project_id: projectId, from, to })
      .then(setData)
      .catch(() => setError('Failed to load work cycle'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch(dateFrom, dateTo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const totalEvents = useMemo(() => {
    if (!data) return 0;
    return data.added.length + data.completed.length
      + data.field_changes.status.length + data.field_changes.owner.length
      + data.field_changes.priority.length + data.field_changes.due_date.length;
  }, [data]);

  return (
    <div className="flex flex-col gap-3">
      {/* Date range controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={dateFrom}
          max={dateTo}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-md border border-gray-200 px-2 py-1 text-[12px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#3CCED7]"
        />
        <span className="text-[11px] text-gray-400">to</span>
        <input
          type="date"
          value={dateTo}
          min={dateFrom}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-md border border-gray-200 px-2 py-1 text-[12px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#3CCED7]"
        />
        <button
          type="button"
          onClick={() => fetch(dateFrom, dateTo)}
          className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1 text-[12px] font-medium text-gray-600 hover:bg-gray-200"
        >
          <RefreshCw className="h-3 w-3" />
          Apply
        </button>
      </div>

      {loading && (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
        </div>
      )}
      {error && <p className="text-[12px] text-rose-500">{error}</p>}
      {!loading && data && totalEvents === 0 && (
        <p className="text-[12px] text-gray-400">No activity in this period</p>
      )}
      {!loading && data && totalEvents > 0 && (
        <div className="space-y-0.5">
          <CycleSection label="Tasks Added" icon={Plus} iconCls="text-emerald-500" count={data.added.length}>
            {data.added.map((t) => <CycleTaskRow key={t.id} task={t} />)}
          </CycleSection>
          <CycleSection label="Completed" icon={Lock} iconCls="text-[#3CCED7]" count={data.completed.length}>
            {data.completed.map((t) => <CycleTaskRow key={t.id} task={t} />)}
          </CycleSection>
          <CycleSection label="Status Changes" icon={RefreshCw} iconCls="text-blue-500" count={data.field_changes.status.length}>
            {data.field_changes.status.map((e, i) => <CycleFieldRow key={i} entry={e} />)}
          </CycleSection>
          <CycleSection label="Owner Changes" icon={User} iconCls="text-violet-500" count={data.field_changes.owner.length}>
            {data.field_changes.owner.map((e, i) => <CycleFieldRow key={i} entry={e} />)}
          </CycleSection>
          <CycleSection label="Priority Changes" icon={Flag} iconCls="text-orange-500" count={data.field_changes.priority.length}>
            {data.field_changes.priority.map((e, i) => <CycleFieldRow key={i} entry={e} />)}
          </CycleSection>
          <CycleSection label="Due Date Changes" icon={CalendarDays} iconCls="text-amber-500" count={data.field_changes.due_date.length}>
            {data.field_changes.due_date.map((e, i) => <CycleFieldRow key={i} entry={e} />)}
          </CycleSection>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InsightsView({ projectId }: { projectId: Id | null }) {
  const [data, setData] = useState<TaskIntelligencePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    TaskAPI.getIntelligence({ project_id: projectId })
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError('Failed to load insights'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="py-24 text-center text-sm text-gray-400">Select a project to view insights.</div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Progress strip */}
      <ProgressStrip data={data} />

      {/* Health signals grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SignalCard
          icon={AlertTriangle} label="Overdue" count={data.overdue.count} tasks={data.overdue.tasks}
          iconCls="text-rose-600" bgCls="bg-rose-50"
          hint="Active tasks whose due date has already passed."
        />
        <SignalCard
          icon={ShieldAlert} label="Blocked" count={data.blocked.count} tasks={data.blocked.tasks}
          iconCls="text-orange-500" bgCls="bg-orange-50"
          hint="Active tasks that have at least one incoming 'blocked by' relation — another task must be resolved first."
        />
        <SignalCard
          icon={Clock} label={`Due in ${data.due_soon.days_window}d`} count={data.due_soon.count} tasks={data.due_soon.tasks}
          iconCls="text-amber-600" bgCls="bg-amber-50"
          hint={`Active tasks with a due date within the next ${data.due_soon.days_window} days.`}
        />
        <SignalCard
          icon={Circle} label="Awaiting Approval" count={data.awaiting_approval.count} tasks={data.awaiting_approval.tasks}
          iconCls="text-blue-500" bgCls="bg-blue-50"
          hint="Tasks currently in Submitted or Under Review status, waiting for an approver to act."
        />
        <SignalCard
          icon={Hourglass} label={`Stalled (${data.stalled.stall_days}d)`} count={data.stalled.count} tasks={data.stalled.tasks}
          iconCls="text-gray-500" bgCls="bg-gray-100"
          hint={`Active tasks older than ${data.stalled.stall_days} days with no field changes in the last ${data.stalled.stall_days} days — likely forgotten or stuck.`}
        />
        <SignalCard
          icon={Flame} label="High Priority" count={data.high_priority.count} tasks={data.high_priority.tasks}
          iconCls="text-rose-500" bgCls="bg-rose-50"
          hint="Incomplete tasks marked High or Highest priority."
        />
      </div>

      {/* Velocity + Activity row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#3CCED7]" />
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">Velocity</h2>
            <InfoTip text="Number of tasks completed (reached Locked status) per week over the past 8 weeks. Hover a bar to see the exact count." />
          </div>
          <VelocityChart points={data.velocity} />
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-[#3CCED7]" />
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">Work Cycle</h2>
            <InfoTip text="A grouped summary of all task activity within the selected date range — new tasks, completions, and field changes (status, owner, priority, due date)." />
          </div>
          <WorkCycleHistory projectId={projectId} />
        </section>
      </div>
    </div>
  );
}
