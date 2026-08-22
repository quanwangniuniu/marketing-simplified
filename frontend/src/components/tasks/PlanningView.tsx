'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  CalendarClock,
  CalendarRange,
  Flag,
  Layers3,
  ListChecks,
  SearchX,
  Sparkles,
} from 'lucide-react';
import { Id } from '@/types/common';
import type { TaskData } from '@/types/task';
import { userDisplayName } from '@/types/task';
import { Skeleton } from '@/components/ui/skeleton';
import { TASK_PRIORITY_BY_VALUE } from '@/lib/tasks/taskPriorities';
import { TASK_STATUS_BY_VALUE } from '@/lib/tasks/taskStatuses';
import { TASK_TYPE_DEFINITIONS } from '@/lib/tasks/taskTypes';
import { formatTaskDateShort } from '@/lib/tasks/taskDates';
import { useBuildUrl } from '@/lib/buildUrl';

type GroupBy = 'type' | 'owner' | 'priority' | 'theme';
type MetricKey = 'groups' | 'duplicates' | 'conflicts' | 'nextCycle' | 'sparse';

type PlanningViewProps = {
  projectId: Id | null;
  tasks: TaskData[];
  loading: boolean;
  error: unknown;
};

type GroupRow = {
  key: string;
  label: string;
  count: number;
  tasks: TaskData[];
};

type DuplicateCandidate = {
  a: TaskData;
  b: TaskData;
  score: number;
};

type ScheduleConflict = {
  owner: string;
  a: TaskData;
  b: TaskData;
  rangeLabel: string;
};

type SparseFlag = {
  task: TaskData;
  reasons: string[];
};

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'type', label: 'Type' },
  { value: 'owner', label: 'Owner' },
  { value: 'priority', label: 'Priority' },
  { value: 'theme', label: 'Theme' },
];

const ACTIVE_STATUSES = new Set(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REJECTED', 'APPROVED']);
const NEXT_CYCLE_STATUSES = new Set(['DRAFT', 'REJECTED']);
const HIGH_PRIORITY = new Set(['HIGHEST', 'HIGH']);
const BACKLOG_GROUP_TASKS_CLASS = 'task-tab-scrollbar mt-2 max-h-48 overflow-y-auto overscroll-contain';
const COMPACT_SCROLL_CLASS = 'task-tab-scrollbar max-h-96 overflow-y-auto overscroll-contain';
const PAIR_SCROLL_CLASS = 'task-tab-scrollbar max-h-[37.5rem] overflow-y-auto overscroll-contain';
const COMPACT_ROW_CLASS = 'h-16 overflow-hidden py-2';
const PAIR_ROW_CLASS = 'h-[6.25rem] overflow-hidden py-2';
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'for',
  'in',
  'of',
  'on',
  'the',
  'to',
  'with',
]);

const THEME_RULES: { label: string; words: string[] }[] = [
  { label: 'Budget', words: ['budget', 'spend', 'cost', 'pool', 'roas', 'roi', 'cpa', 'finance'] },
  { label: 'Creative', words: ['asset', 'creative', 'copy', 'ad', 'video', 'image', 'design', 'variant'] },
  { label: 'Measurement', words: ['report', 'metric', 'analytics', 'tracking', 'dashboard', 'insight'] },
  { label: 'Experimentation', words: ['experiment', 'test', 'ab', 'hypothesis', 'optimization', 'optimize'] },
  { label: 'Scaling', words: ['scale', 'scaling', 'growth', 'launch', 'expand', 'rollout'] },
  { label: 'Policy and risk', words: ['policy', 'compliance', 'risk', 'alert', 'blocked', 'issue'] },
  { label: 'Communication', words: ['client', 'stakeholder', 'message', 'email', 'communication', 'approval'] },
  { label: 'Operations', words: ['execution', 'workflow', 'process', 'setup', 'planning', 'ops'] },
];

const TYPE_THEME: Record<string, string> = {
  budget: 'Budget',
  asset: 'Creative',
  report: 'Measurement',
  retrospective: 'Measurement',
  experiment: 'Experimentation',
  optimization: 'Experimentation',
  scaling: 'Scaling',
  alert: 'Policy and risk',
  platform_policy_update: 'Policy and risk',
  communication: 'Communication',
  execution: 'Operations',
};

function taskUrl(task: TaskData): string {
  return task.id ? `/tasks/${task.slug}` : '/tasks';
}

function typeLabel(type?: string): string {
  return TASK_TYPE_DEFINITIONS.find((t) => t.value === type)?.shortLabel ?? type ?? 'No type';
}

function statusLabel(status?: string): string {
  return TASK_STATUS_BY_VALUE[status ?? '']?.label ?? status ?? 'Draft';
}

function priorityLabel(priority?: string): string {
  return TASK_PRIORITY_BY_VALUE[priority ?? '']?.label ?? priority ?? 'Medium';
}

function normalizedWords(value?: string): string[] {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word));
}

function normalizedTitle(task: TaskData): string {
  return normalizedWords(task.summary).join(' ');
}

function inferTheme(task: TaskData): string {
  const text = `${task.summary ?? ''} ${task.description ?? ''} ${task.type ?? ''}`.toLowerCase();
  let best: { label: string; hits: number } | null = null;

  for (const rule of THEME_RULES) {
    const hits = rule.words.reduce((count, word) => (text.includes(word) ? count + 1 : count), 0);
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { label: rule.label, hits };
    }
  }

  return best?.label ?? TYPE_THEME[task.type] ?? 'General';
}

function dateValue(value?: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function taskAgeValue(task: TaskData): number {
  if (task.created_at) return dateValue(task.created_at);
  if (task.updated_at) return dateValue(task.updated_at);
  return task.id ?? Number.MAX_SAFE_INTEGER;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function titleSimilarity(a: TaskData, b: TaskData): number {
  const aTitle = normalizedTitle(a);
  const bTitle = normalizedTitle(b);
  if (aTitle.length < 5 || bTitle.length < 5) return 0;

  const aWords = new Set(aTitle.split(' '));
  const bWords = new Set(bTitle.split(' '));
  const shared = [...aWords].filter((word) => bWords.has(word)).length;
  const tokenScore = shared === 0 ? 0 : (2 * shared) / (aWords.size + bWords.size);
  const distance = levenshtein(aTitle, bTitle);
  const editScore = 1 - distance / Math.max(aTitle.length, bTitle.length);

  return Math.max(tokenScore, editScore);
}

function getTaskRange(task: TaskData): { start: string; end: string } | null {
  const start = task.planned_start_date || task.start_date || task.due_date;
  const end = task.due_date || task.planned_start_date || task.start_date;
  if (!start || !end) return null;
  return start <= end ? { start, end } : { start: end, end: start };
}

function rangesOverlap(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return a.start <= b.end && b.start <= a.end;
}

function formatRange(range: { start: string; end: string }): string {
  if (range.start === range.end) return formatTaskDateShort(range.start);
  return `${formatTaskDateShort(range.start)} - ${formatTaskDateShort(range.end)}`;
}

function groupTasks(tasks: TaskData[], groupBy: GroupBy): GroupRow[] {
  const map = new Map<string, GroupRow>();

  for (const task of tasks) {
    let key = 'unknown';
    let label = 'Unknown';

    if (groupBy === 'type') {
      key = task.type ?? 'none';
      label = typeLabel(task.type);
    } else if (groupBy === 'owner') {
      key = task.owner?.id != null ? String(task.owner.id) : 'unassigned';
      label = task.owner ? userDisplayName(task.owner) : 'Unassigned';
    } else if (groupBy === 'priority') {
      key = task.priority ?? 'MEDIUM';
      label = priorityLabel(task.priority);
    } else {
      label = inferTheme(task);
      key = label.toLowerCase();
    }

    const row = map.get(key) ?? { key, label, count: 0, tasks: [] };
    row.count += 1;
    row.tasks.push(task);
    map.set(key, row);
  }

  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function findDuplicates(tasks: TaskData[], thresholdPercent: number): DuplicateCandidate[] {
  const candidates = tasks.filter((task) => normalizedTitle(task).length >= 5);
  const results: DuplicateCandidate[] = [];
  const threshold = thresholdPercent / 100;

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const score = titleSimilarity(candidates[i], candidates[j]);
      if (score >= threshold) {
        results.push({ a: candidates[i], b: candidates[j], score });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

function findScheduleConflicts(tasks: TaskData[]): ScheduleConflict[] {
  const byOwner = new Map<number, TaskData[]>();
  for (const task of tasks) {
    if (task.owner?.id == null || !getTaskRange(task)) continue;
    const list = byOwner.get(task.owner.id) ?? [];
    list.push(task);
    byOwner.set(task.owner.id, list);
  }

  const results: ScheduleConflict[] = [];
  byOwner.forEach((ownerTasks) => {
    for (let i = 0; i < ownerTasks.length; i += 1) {
      for (let j = i + 1; j < ownerTasks.length; j += 1) {
        const aRange = getTaskRange(ownerTasks[i]);
        const bRange = getTaskRange(ownerTasks[j]);
        if (!aRange || !bRange || !rangesOverlap(aRange, bRange)) continue;
        const start = aRange.start > bRange.start ? aRange.start : bRange.start;
        const end = aRange.end < bRange.end ? aRange.end : bRange.end;
        results.push({
          owner: userDisplayName(ownerTasks[i].owner!),
          a: ownerTasks[i],
          b: ownerTasks[j],
          rangeLabel: formatRange({ start, end }),
        });
      }
    }
  });

  return results
    .sort((a, b) => dateValue(getTaskRange(a.a)?.start) - dateValue(getTaskRange(b.a)?.start))
    .slice(0, 10);
}

function findSparseTasks(tasks: TaskData[]): SparseFlag[] {
  return tasks
    .map((task) => {
      const summary = (task.summary ?? '').trim();
      const description = (task.description ?? '').trim();
      const reasons: string[] = [];
      if (!summary) reasons.push('missing title');
      else if (summary.length < 12 || summary.split(/\s+/).length < 3) reasons.push('short title');
      if (!description) reasons.push('missing description');
      else if (description.length < 32) reasons.push('short description');
      return { task, reasons };
    })
    .filter((item) => item.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length || taskAgeValue(a.task) - taskAgeValue(b.task))
    .slice(0, 12);
}

function TaskLinkRow({ task, meta }: { task: TaskData; meta?: string }) {
  const buildUrl = useBuildUrl();
  return (
    <Link href={buildUrl(taskUrl(task))} className="group flex h-8 min-w-0 items-center justify-between gap-3">
      <span className="min-w-0 truncate text-sm font-medium text-gray-800 group-hover:text-[#1daeb8]">
        {task.summary || `Task #${task.id}`}
      </span>
      <span className="shrink-0 text-xs text-gray-400">{meta ?? statusLabel(task.status)}</span>
    </Link>
  );
}

function EmptyLine({ children }: { children: string }) {
  return <p className="py-4 text-sm text-gray-400">{children}</p>;
}

export default function PlanningView({ projectId, tasks, loading, error }: PlanningViewProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('type');
  const [openMetric, setOpenMetric] = useState<MetricKey | null>(null);
  const [duplicateThreshold, setDuplicateThreshold] = useState(80);

  const activeTasks = useMemo(
    () => tasks.filter((task) => ACTIVE_STATUSES.has(task.status ?? 'DRAFT')),
    [tasks]
  );

  const grouped = useMemo(() => groupTasks(activeTasks, groupBy), [activeTasks, groupBy]);
  const duplicates = useMemo(() => findDuplicates(activeTasks, duplicateThreshold), [activeTasks, duplicateThreshold]);
  const conflicts = useMemo(() => findScheduleConflicts(activeTasks), [activeTasks]);
  const sparseTasks = useMemo(() => findSparseTasks(activeTasks), [activeTasks]);
  const nextCycle = useMemo(
    () =>
      activeTasks
        .filter((task) => NEXT_CYCLE_STATUSES.has(task.status ?? 'DRAFT') && HIGH_PRIORITY.has(task.priority ?? 'MEDIUM'))
        .sort((a, b) => taskAgeValue(a) - taskAgeValue(b))
        .slice(0, 8),
    [activeTasks]
  );

  const unassignedCount = activeTasks.filter((task) => !task.owner).length;
  const dueDatedCount = activeTasks.filter((task) => task.due_date).length;
  const metricCards: {
    key: MetricKey;
    label: string;
    value: number;
    icon: typeof Layers3;
    description: string;
  }[] = [
    {
      key: 'groups',
      label: 'Backlog groups',
      value: grouped.length,
      icon: Layers3,
      description: 'Shows where active work is concentrated so planning gaps are easier to spot.',
    },
    {
      key: 'duplicates',
      label: 'Duplicate pairs',
      value: duplicates.length,
      icon: SearchX,
      description: 'Task pairs with similar titles that may describe the same work.',
    },
    {
      key: 'conflicts',
      label: 'Schedule conflicts',
      value: conflicts.length,
      icon: CalendarClock,
      description: 'Same-owner tasks whose date windows overlap and may compete for capacity.',
    },
    {
      key: 'nextCycle',
      label: 'Next cycle',
      value: nextCycle.length,
      icon: Sparkles,
      description: 'Oldest high-priority draft or rejected tasks that may be ready to pull forward.',
    },
    {
      key: 'sparse',
      label: 'Sparse tasks',
      value: sparseTasks.length,
      icon: Flag,
      description: 'Tasks with thin titles or descriptions that may need detail before estimating.',
    },
  ];

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#3CCED7]/10">
          <CalendarRange className="h-6 w-6 text-[#3CCED7]" />
        </div>
        <h2 className="text-base font-semibold text-gray-900">Planning</h2>
        <p className="mt-1 text-sm text-gray-400">No project selected.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-rose-700">
        Failed to load planning data.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 w-full rounded-lg" />
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Planning</h2>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
            <span>{activeTasks.length} active tasks</span>
            <span>{unassignedCount} unassigned</span>
            <span>{dueDatedCount} scheduled</span>
          </div>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
          {GROUP_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setGroupBy(option.value)}
              className={`min-h-9 px-3 text-xs font-semibold transition ${
                groupBy === option.value
                  ? 'bg-[#3CCED7]/10 text-[#159aa4]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards.map(({ key, label, value, icon: Icon, description }) => {
          const isOpen = openMetric === key;
          return (
          <div
            key={key}
            className={`relative rounded-lg border bg-white px-3 py-3 transition ${
              isOpen ? 'border-gray-300 shadow-sm' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenMetric((current) => (current === key ? null : key))}
                className="min-w-0 truncate text-left text-xs font-medium text-gray-500 underline-offset-2 transition hover:text-gray-900 hover:underline"
              >
                {label}
              </button>
              <Icon className="h-4 w-4 text-gray-400" />
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
            {isOpen ? (
              <div className="absolute left-3 right-3 top-10 z-30 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium leading-5 text-gray-700 shadow-lg">
                <span className="absolute -top-1.5 left-8 h-3 w-3 rotate-45 border-l border-t border-gray-200 bg-white" />
                <p className="relative">{description}</p>
              </div>
            ) : null}
          </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-[#159aa4]" />
              <h3 className="text-sm font-semibold text-gray-900">Backlog by {GROUP_OPTIONS.find((o) => o.value === groupBy)?.label}</h3>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {grouped.length === 0 ? (
              <div className="px-4">
                <EmptyLine>No active backlog tasks.</EmptyLine>
              </div>
            ) : (
              grouped.map((group) => {
                const pct = activeTasks.length ? Math.round((group.count / activeTasks.length) * 100) : 0;
                return (
                  <div key={group.key} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900">{group.label}</div>
                        <div className="mt-0.5 text-xs text-gray-400">{group.count} tasks</div>
                      </div>
                      <div className="text-xs font-semibold text-gray-500">{pct}%</div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-[#3CCED7]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className={BACKLOG_GROUP_TASKS_CLASS}>
                      {group.tasks.map((task) => (
                        <TaskLinkRow
                          key={task.id ?? `${group.key}-${task.summary}`}
                          task={task}
                          meta={`${priorityLabel(task.priority)} / ${statusLabel(task.status)}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#7cbd31]" />
                <h3 className="text-sm font-semibold text-gray-900">Next-cycle suggestions</h3>
              </div>
            </div>
            <div className={`${COMPACT_SCROLL_CLASS} divide-y divide-gray-100 px-4 py-1`}>
              {nextCycle.length === 0 ? (
                <EmptyLine>No high-priority unstarted tasks.</EmptyLine>
              ) : (
                nextCycle.map((task) => (
                  <div key={task.id ?? task.summary} className={COMPACT_ROW_CLASS}>
                    <TaskLinkRow task={task} meta={task.created_at ? new Date(task.created_at).toLocaleDateString() : `#${task.id}`} />
                    <div className="text-xs text-gray-400">{priorityLabel(task.priority)} / {statusLabel(task.status)}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SearchX className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-gray-900">Possible duplicates</h3>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  Match
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="5"
                    value={duplicateThreshold}
                    onChange={(event) => setDuplicateThreshold(Number(event.target.value))}
                    className="h-1.5 w-24 accent-[#3CCED7]"
                    aria-label="Duplicate match threshold"
                  />
                  <input
                    type="number"
                    min="50"
                    max="100"
                    step="5"
                    value={duplicateThreshold}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      if (Number.isFinite(nextValue)) {
                        setDuplicateThreshold(Math.min(100, Math.max(50, nextValue)));
                      }
                    }}
                    className="h-7 w-14 rounded-md border border-gray-200 px-2 text-right text-xs font-semibold text-gray-700 outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
                    aria-label="Duplicate match percentage"
                  />
                  %
                </label>
              </div>
            </div>
            <div className={`${PAIR_SCROLL_CLASS} divide-y divide-gray-100 px-4 py-1`}>
              {duplicates.length === 0 ? (
                <EmptyLine>No title matches above this percentage.</EmptyLine>
              ) : (
                duplicates.map(({ a, b, score }) => (
                  <div key={`${a.id}-${b.id}`} className={PAIR_ROW_CLASS}>
                    <div className="mb-1 text-xs font-semibold text-amber-700">{Math.round(score * 100)}% title match</div>
                    <TaskLinkRow task={a} />
                    <TaskLinkRow task={b} />
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-rose-500" />
                <h3 className="text-sm font-semibold text-gray-900">Scheduling conflicts</h3>
              </div>
            </div>
            <div className={`${PAIR_SCROLL_CLASS} divide-y divide-gray-100 px-4 py-1`}>
              {conflicts.length === 0 ? (
                <EmptyLine>No owner date overlaps.</EmptyLine>
              ) : (
                conflicts.map((conflict) => (
                  <div key={`${conflict.a.id}-${conflict.b.id}`} className={PAIR_ROW_CLASS}>
                    <div className="mb-1 truncate text-xs font-semibold text-rose-700">
                      {conflict.owner} / {conflict.rangeLabel}
                    </div>
                    <TaskLinkRow task={conflict.a} meta={formatRange(getTaskRange(conflict.a)!)} />
                    <TaskLinkRow task={conflict.b} meta={formatRange(getTaskRange(conflict.b)!)} />
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Sparse task flags</h3>
              </div>
            </div>
            <div className={`${COMPACT_SCROLL_CLASS} divide-y divide-gray-100 px-4 py-1`}>
              {sparseTasks.length === 0 ? (
                <EmptyLine>No sparse tasks found.</EmptyLine>
              ) : (
                sparseTasks.map(({ task, reasons }) => (
                  <div key={task.id ?? task.summary} className={COMPACT_ROW_CLASS}>
                    <TaskLinkRow task={task} />
                    <div className="text-xs text-gray-400">{reasons.join(', ')}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
