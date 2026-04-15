'use client';

import Link from 'next/link';
import { ChevronRight, Loader2 } from 'lucide-react';

import type { MeetingListItem, MeetingStatus } from '@/types/meeting';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<MeetingStatus, string> = {
  draft: 'Draft',
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  archived: 'Archived',
};

const STATUS_COLORS: Record<MeetingStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  planned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
};

const MAX_INLINE_KNOWLEDGE_LINKS = 2;

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return label.slice(0, 2).toUpperCase() || '?';
}

function formatScheduleLine(m: MeetingListItem): string {
  const dateStr = m.scheduled_date;
  if (!dateStr) {
    return 'Unscheduled';
  }
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr);
  if (Number.isNaN(d.getTime())) {
    return dateStr.slice(0, 10);
  }
  const datePart = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const t = m.scheduled_time?.trim();
  if (!t) return datePart;
  const parts = t.split(':');
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
    return `${datePart} · ${t}`;
  }
  const timeD = new Date();
  timeD.setHours(hh, mm, 0, 0);
  const timePart = timeD.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}`;
}

function countPhrase(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export interface MeetingResultsTableProps {
  rows: MeetingListItem[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  memberLabel: (userId: number) => string;
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  emptyTitle: string;
  emptySubtitle: string;
  /** Hide built-in pager (e.g. when multiple section tables share one page from the API). */
  hidePagination?: boolean;
  /**
   * `lane`: list only — no outer chrome or count row (use inside `MeetingsLane`).
   * `default`: self-contained table with count strip + bordered wrapper.
   */
  variant?: 'default' | 'lane';
  /** When set, list cards show contextual knowledge links (Meeting → tasks/decisions). */
  projectId?: number;
}

function MeetingResultCard({
  m,
  selected,
  onSelect,
  memberLabel,
  projectId,
}: {
  m: MeetingListItem;
  selected: boolean;
  onSelect: () => void;
  memberLabel: (userId: number) => string;
  projectId?: number;
}) {
  const participants = Array.isArray(m.participants) ? m.participants : [];
  const tags = Array.isArray(m.tags) ? m.tags : [];
  const nDecisions = m.decision_count ?? 0;
  const nTasks = m.task_count ?? 0;
  const genDecisions = Array.isArray(m.generated_decisions) ? m.generated_decisions : [];
  const genTasks = Array.isArray(m.generated_tasks) ? m.generated_tasks : [];
  const hasContextualNav =
    Number.isFinite(projectId) &&
    projectId != null &&
    projectId >= 1 &&
    (genDecisions.length > 0 || genTasks.length > 0);
  const meetingPageKnowledgeHref =
    hasContextualNav && projectId != null
      ? `/projects/${projectId}/meetings/${m.id}#contextual-knowledge`
      : null;
  const visibleTags = tags.slice(0, 3);
  const tagOverflow = tags.length - visibleTags.length;

  return (
    <article
      data-testid="meeting-result-card"
      className={cn(
        'relative flex flex-col gap-0 rounded-lg border bg-white text-left shadow-sm transition',
        'hover:border-blue-200/80 hover:shadow',
        selected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200',
      )}
    >
      <div className="flex gap-4 p-4">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`${m.title}. ${formatScheduleLine(m)}. Open meeting details.`}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          'min-w-0 flex-1 cursor-pointer space-y-2.5 rounded-lg text-left outline-none',
          'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        )}
      >
        <h3 className="line-clamp-2 pr-1 text-base font-semibold leading-snug text-slate-900">
          {m.title}
        </h3>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
          <span className="inline-flex shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            {m.meeting_type}
          </span>
          <span className="text-slate-400" aria-hidden>
            ·
          </span>
          <span className="min-w-0 text-slate-700">{formatScheduleLine(m)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex max-w-full flex-wrap items-center gap-1">
            {participants.slice(0, 4).map((p) => {
              const name = memberLabel(p.user_id);
              return (
                <span
                  key={p.user_id}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700"
                  title={name}
                >
                  {initials(name)}
                </span>
              );
            })}
            {participants.length > 4 ? (
              <span className="text-xs font-medium text-slate-500">
                +{participants.length - 4}
              </span>
            ) : null}
            {participants.length === 0 ? (
              <span className="text-xs text-slate-400">No participants</span>
            ) : null}
          </div>
          {tags.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {visibleTags.map((t) => (
                <span
                  key={t.slug}
                  className="max-w-[140px] truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
                  title={t.label}
                >
                  {t.label}
                </span>
              ))}
              {tagOverflow > 0 ? (
                <span className="text-xs text-slate-500">+{tagOverflow}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <p
          className="text-sm tabular-nums text-slate-600"
          data-testid="meeting-card-generated-counts"
        >
          <span className="font-medium text-slate-800">
            {countPhrase(nDecisions, 'decision', 'decisions')}
          </span>
          <span className="mx-1.5 text-slate-300" aria-hidden>
            ·
          </span>
          <span className="font-medium text-slate-800">
            {countPhrase(nTasks, 'task', 'tasks')}
          </span>
          <span className="sr-only"> generated from this meeting.</span>
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2 pl-1">
        {m.status ? (
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-xs font-medium',
              STATUS_COLORS[m.status] ?? 'bg-slate-100 text-slate-600',
            )}
          >
            {STATUS_LABELS[m.status] ?? m.status}
          </span>
        ) : null}
        <button
          type="button"
          className="inline-flex items-center gap-0.5 text-sm font-semibold text-blue-600 hover:text-blue-800"
          onClick={onSelect}
        >
          Open
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      </div>

      {hasContextualNav && meetingPageKnowledgeHref ? (
        <div
          className="border-t border-slate-100 px-4 pb-4 pt-3"
          data-testid="meeting-card-contextual-knowledge"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Contextual knowledge
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Traverse to decisions and tasks created from this meeting (same data as the summary panel).
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {genDecisions.length > 0 ? (
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="shrink-0 text-xs font-medium text-blue-800/90">Decisions</span>
                {genDecisions.slice(0, MAX_INLINE_KNOWLEDGE_LINKS).map((item) => (
                  <Link
                    key={`d-${item.id}`}
                    href={item.detail_url ?? item.url}
                    className="max-w-[min(100%,220px)] truncate text-xs font-medium text-blue-700 hover:underline"
                  >
                    {item.title}
                  </Link>
                ))}
                {genDecisions.length > MAX_INLINE_KNOWLEDGE_LINKS ? (
                  <span className="text-xs text-slate-500">
                    +{genDecisions.length - MAX_INLINE_KNOWLEDGE_LINKS} more
                  </span>
                ) : null}
              </div>
            ) : null}
            {genTasks.length > 0 ? (
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="shrink-0 text-xs font-medium text-emerald-900/90">Tasks</span>
                {genTasks.slice(0, MAX_INLINE_KNOWLEDGE_LINKS).map((item) => (
                  <Link
                    key={`t-${item.id}`}
                    href={item.detail_url ?? item.url}
                    className="max-w-[min(100%,220px)] truncate text-xs font-medium text-emerald-800 hover:underline"
                  >
                    {item.title}
                  </Link>
                ))}
                {genTasks.length > MAX_INLINE_KNOWLEDGE_LINKS ? (
                  <span className="text-xs text-slate-500">
                    +{genTasks.length - MAX_INLINE_KNOWLEDGE_LINKS} more
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <Link
            href={meetingPageKnowledgeHref}
            className="mt-2 inline-flex text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
          >
            Full meeting workspace (agenda & artifacts) →
          </Link>
        </div>
      ) : null}
    </article>
  );
}

export function MeetingResultsTable({
  rows,
  loading,
  selectedId,
  onSelect,
  memberLabel,
  count,
  page,
  pageSize,
  onPageChange,
  emptyTitle,
  emptySubtitle,
  hidePagination = false,
  variant = 'default',
  projectId,
}: MeetingResultsTableProps) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const isLane = variant === 'lane';

  if (loading && rows.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12',
          !isLane &&
            'rounded-lg border border-dashed border-slate-200 bg-white py-14',
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-3 text-sm font-medium text-slate-700">Loading meetings…</p>
      </div>
    );
  }

  if (!loading && rows.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center',
          isLane
            ? 'border-slate-200/90 bg-white/50'
            : 'border-slate-200 bg-slate-50/50 py-14',
        )}
      >
        <p className="text-sm font-semibold text-slate-900">{emptyTitle}</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">{emptySubtitle}</p>
      </div>
    );
  }

  const cardStack = (
    <div className={cn('flex flex-col', isLane ? 'gap-4' : 'gap-3 p-3 sm:p-4')}>
      {rows.map((m) => (
        <MeetingResultCard
          key={m.id}
          m={m}
          selected={selectedId === m.id}
          onSelect={() => onSelect(m.id)}
          memberLabel={memberLabel}
          projectId={projectId}
        />
      ))}
    </div>
  );

  if (isLane) {
    return (
      <>
        {cardStack}
        {!hidePagination && totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-center gap-2 border-t border-slate-200/90 pt-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50 shadow-sm">
      <div className="border-b border-slate-200 bg-white px-4 py-2.5">
        <p className="text-sm text-slate-600">
          Showing{' '}
          <span className="font-semibold text-slate-900">{count}</span> result
          {count === 1 ? '' : 's'}
        </p>
      </div>
      {cardStack}

      {!hidePagination && totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 border-t border-slate-200 bg-white py-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
