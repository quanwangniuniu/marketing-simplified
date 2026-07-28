'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, Tag, X } from 'lucide-react';
import type { TaskData } from '@/types/task';
import { TASK_TYPE_DEFINITIONS, TASK_TYPE_ORDER_INDEX } from '@/lib/tasks/taskTypes';
import TaskCardMini from './TaskCardMini';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useBuildUrl } from '@/lib/buildUrl';

interface BoardViewProps {
  tasks: TaskData[];
  loading: boolean;
  error: string | null;
  projectId?: string;
}

const COLUMN_PAGE_SIZE = 10;

export default function BoardView({ tasks, loading, error, projectId }: BoardViewProps) {
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const tagPickerRef = useRef<HTMLDivElement>(null);
  const [pageByType, setPageByType] = useState<Record<string, number>>({});

  const allTags = useMemo(() => {
    const seen = new Map<string, string>(); // name -> color
    for (const t of tasks) {
      for (const tag of t.tags ?? []) {
        if (tag.name && !seen.has(tag.name)) seen.set(tag.name, tag.color);
      }
    }
    return [...seen.entries()].map(([name, color]) => ({ name, color })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (!selectedTags.length) return tasks;
    const required = new Set(selectedTags);
    return tasks.filter((task) => (task.tags ?? []).some((tag) => required.has(tag.name)));
  }, [tasks, selectedTags]);

  useEffect(() => {
    if (!tagPickerOpen) return;
    const handle = (e: MouseEvent) => {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setTagPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [tagPickerOpen]);

  const grouped = useMemo(() => {
    const map: Record<string, TaskData[]> = {};
    for (const t of TASK_TYPE_DEFINITIONS) map[t.value] = [];
    for (const task of filteredTasks) {
      if (map[task.type]) map[task.type].push(task);
    }
    return map;
  }, [filteredTasks]);

  const sortedTypes = useMemo(
    () =>
      [...TASK_TYPE_DEFINITIONS].sort((a, b) => {
        const countDiff = (grouped[b.value]?.length ?? 0) - (grouped[a.value]?.length ?? 0);
        if (countDiff !== 0) return countDiff;
        return TASK_TYPE_ORDER_INDEX[a.value] - TASK_TYPE_ORDER_INDEX[b.value];
      }),
    [grouped]
  );

  useEffect(() => {
    setPageByType((prev) => {
      let changed = false;
      const next: Record<string, number> = {};

      for (const meta of TASK_TYPE_DEFINITIONS) {
        const totalPages = Math.max(1, Math.ceil((grouped[meta.value]?.length ?? 0) / COLUMN_PAGE_SIZE));
        const currentPage = prev[meta.value] ?? 1;
        const clampedPage = Math.min(Math.max(currentPage, 1), totalPages);
        next[meta.value] = clampedPage;
        if (prev[meta.value] !== clampedPage) changed = true;
      }

      return changed ? next : prev;
    });
  }, [grouped]);

  const setColumnPage = (type: string, page: number, totalPages: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    setPageByType((prev) => ({ ...prev, [type]: nextPage }));
  };

  if (error) {
    return (
      <div className="rounded-xl bg-rose-50 p-6 text-sm text-rose-600 ring-1 ring-rose-100">
        {error}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Tag filter */}
        <div className="relative" ref={tagPickerRef}>
          <button
            type="button"
            onClick={() => setTagPickerOpen((o) => !o)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition',
              selectedTags.length
                ? 'border-[#3CCED7] bg-[#3CCED7]/10 text-[#2ab5bd]'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            <Tag className="h-3.5 w-3.5" />
            Tags
            {selectedTags.length > 0 && (
              <span className="ml-0.5 rounded-full bg-[#3CCED7] px-1.5 py-0 text-[10px] font-semibold text-white">
                {selectedTags.length}
              </span>
            )}
          </button>
          {tagPickerOpen && (
            <div className="absolute z-50 mt-1 w-52 rounded-md border bg-white shadow-md">
              <div className="max-h-52 overflow-y-auto p-1">
                {allTags.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-gray-400">No tags in this project yet.</p>
                ) : (
                  allTags.map((opt) => {
                    const active = selectedTags.includes(opt.name);
                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() =>
                          setSelectedTags((prev) =>
                            active ? prev.filter((n) => n !== opt.name) : [...prev, opt.name],
                          )
                        }
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-gray-50',
                          active && 'bg-gray-50',
                        )}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: opt.color }}
                        />
                        <span className="flex-1 truncate font-medium text-gray-800">{opt.name}</span>
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]',
                            active
                              ? 'border-[#3CCED7] bg-[#3CCED7] text-white'
                              : 'border-gray-200 bg-white text-transparent',
                          )}
                        >
                          ✓
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              {selectedTags.length > 0 && (
                <div className="border-t p-1">
                  <button
                    type="button"
                    onClick={() => setSelectedTags([])}
                    className="w-full rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    Clear filter
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Active tag chips */}
        {selectedTags.map((name) => {
          const color = allTags.find((l) => l.name === name)?.color ?? '#6B7280';
          return (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {name}
              <button type="button" onClick={() => setSelectedTags((prev) => prev.filter((n) => n !== name))}>
                <X className="h-3 w-3 opacity-80 hover:opacity-100" />
              </button>
            </span>
          );
        })}
      </div>
      <div className="max-w-full overflow-x-auto pb-3">
        <div data-testid="board-columns" className="flex min-w-full gap-3 sm:gap-4">
          {sortedTypes.map((meta) => {
            const tasksInColumn = grouped[meta.value] ?? [];
            const currentPage = pageByType[meta.value] ?? 1;
            const totalPages = Math.max(1, Math.ceil(tasksInColumn.length / COLUMN_PAGE_SIZE));
            const pageStart = (currentPage - 1) * COLUMN_PAGE_SIZE;
            const visibleTasks = tasksInColumn.slice(pageStart, pageStart + COLUMN_PAGE_SIZE);
            return (
              <div
                key={meta.value}
                className="flex w-[calc(100vw-2rem)] max-w-[260px] flex-shrink-0 flex-col gap-2 rounded-xl bg-gray-50 p-3 sm:w-[280px] sm:max-w-none"
              >
                <header className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ backgroundColor: meta.hex }}
                    />
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                      {meta.label}
                    </h3>
                  </div>
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-500 ring-1 ring-gray-200">
                    {tasksInColumn.length}
                  </span>
                </header>
                <div className="flex flex-col gap-2">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={`${meta.value}-skeleton-${index}`}
                        className="rounded-md bg-white p-3 shadow-sm ring-1 ring-gray-100"
                      >
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-36 max-w-full" />
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                            <Skeleton className="h-3 w-20 max-w-[50%]" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : tasksInColumn.length === 0 ? (
                    <div className="rounded-md border border-dashed border-gray-200 bg-white/40 px-3 py-4 text-center text-[11px] text-gray-400">
                      No {meta.shortLabel.toLowerCase()} tasks
                    </div>
                  ) : (
                    visibleTasks.map((task) => (
                      <TaskCardMini key={task.id} task={task} columnAccentHex={meta.hex} />
                    ))
                  )}

                  {!loading && tasksInColumn.length > COLUMN_PAGE_SIZE ? (
                    <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[11px] text-gray-500">
                      <span>
                        Page {currentPage} of {totalPages}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setColumnPage(meta.value, currentPage - 1, totalPages)}
                          disabled={currentPage <= 1}
                          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                          Prev
                        </button>
                        <button
                          type="button"
                          onClick={() => setColumnPage(meta.value, currentPage + 1, totalPages)}
                          disabled={currentPage >= totalPages}
                          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                          <ChevronRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      router.push(buildUrl(`/tasks/new?type=${meta.value}`));
                    }}
                    className="mt-1 inline-flex items-center justify-center gap-1 rounded-md border border-dashed border-gray-200 bg-transparent px-3 py-2 text-xs text-gray-400 transition hover:border-[#3CCED7] hover:text-[#3CCED7]"
                  >
                    <Plus className="h-3 w-3" />
                    {loading ? 'Preparing…' : 'Create'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
