'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { TaskData } from '@/types/task';
import { TASK_TYPES } from './TYPE_META';
import TaskCardMini from './TaskCardMini';
import { Skeleton } from '@/components/ui/skeleton';

interface BoardViewProps {
  tasks: TaskData[];
  loading: boolean;
  error: string | null;
}

const COLUMN_PAGE_SIZE = 10;

export default function BoardView({ tasks, loading, error }: BoardViewProps) {
  const router = useRouter();
  const [pageByType, setPageByType] = useState<Record<string, number>>({});

  const grouped = useMemo(() => {
    const map: Record<string, TaskData[]> = {};
    for (const t of TASK_TYPES) map[t.value] = [];
    for (const task of tasks) {
      if (map[task.type]) map[task.type].push(task);
    }
    return map;
  }, [tasks]);

  const sortedTypes = useMemo(
    () =>
      [...TASK_TYPES].sort((a, b) => {
        const countDiff = (grouped[b.value]?.length ?? 0) - (grouped[a.value]?.length ?? 0);
        if (countDiff !== 0) return countDiff;
        return TASK_TYPES.findIndex((type) => type.value === a.value) -
          TASK_TYPES.findIndex((type) => type.value === b.value);
      }),
    [grouped]
  );

  useEffect(() => {
    setPageByType((prev) => {
      let changed = false;
      const next: Record<string, number> = {};

      for (const meta of TASK_TYPES) {
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
                    <TaskCardMini key={task.id} task={task} />
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
                  onClick={() => router.push(`/tasks/new?type=${meta.value}`)}
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
  );
}
