'use client';

import { useEffect, useState } from 'react';
import { Plus, Unlink } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { TaskAPI } from '@/lib/api/taskApi';
import { useBuildUrl } from '@/lib/buildUrl';
import type { TaskData } from '@/types/task';
import AddSubtaskDialog from './AddSubtaskDialog';
import StatusPill from './pills/StatusPill';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  task: TaskData;
  readOnly: boolean;
  refreshKey: number;
  loading?: boolean;
  onMutated?: () => void;
}

export default function TaskSubtasksBlock({
  task,
  readOnly,
  refreshKey,
  loading = false,
  onMutated,
}: Props) {
  const buildUrl = useBuildUrl();
  const [items, setItems] = useState<TaskData[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [localKey, setLocalKey] = useState(0);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (loading || !task.id) return;
    TaskAPI.getSubtasks(task.slug ?? task.id)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, task.id, refreshKey, localKey]);

  const unlink = async (subtaskId: number, subtaskSlug?: string) => {
    if (!task.id) return;
    setUnlinkingId(subtaskId);
    try {
      await TaskAPI.deleteSubtask(task.slug ?? task.id, subtaskSlug ?? subtaskId);
      setLocalKey((k) => k + 1);
      onMutated?.();
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Unlink failed');
    } finally {
      setUnlinkingId(null);
    }
  };

  return (
    <section className="min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Subtasks
          {items && items.length > 0 && (
            <span className="ml-2 text-[11px] font-medium normal-case text-gray-400">
              {items.length}
            </span>
          )}
        </h2>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            <Plus className="h-3.5 w-3.5" />
            Add subtask
          </button>
        )}
      </div>

      {(loading || items === null) ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`task-subtasks-skeleton-${index}`} className="flex items-center gap-3 py-1.5">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      ) : null}
      {!loading && items === null && null}
      {items && items.length === 0 && (
        <p className="text-xs text-gray-400">No subtasks yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {items.map((s) => (
            <li key={s.id} className="flex min-w-0 flex-wrap items-center gap-2 py-2 sm:flex-nowrap sm:gap-3">
              <Link
                href={buildUrl(`/tasks/${s.slug}`)}
                className="min-w-0 flex-1 truncate text-sm text-gray-900 hover:text-[#3CCED7] hover:underline"
              >
                {s.summary}
              </Link>
              <StatusPill status={s.status} />
              <span className="w-24 shrink-0 truncate text-[11px] text-gray-500">
                {s.owner?.username || s.owner?.email || 'Unassigned'}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => unlink(s.id ?? 0, s.slug)}
                  disabled={unlinkingId === s.id}
                  title="Unlink subtask"
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {task.id && (
        <AddSubtaskDialog
          open={modalOpen}
          onOpenChange={setModalOpen}
          parentTaskId={task.id}
          parentProjectId={task.project?.id ?? task.project_id}
          onAdded={() => { setLocalKey((k) => k + 1); onMutated?.(); }}
        />
      )}
    </section>
  );
}
