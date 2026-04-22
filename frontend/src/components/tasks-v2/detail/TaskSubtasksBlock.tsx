'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData } from '@/types/task';
import AddSubtaskDialog from './AddSubtaskDialog';
import StatusPill from './pills/StatusPill';

interface Props {
  task: TaskData;
  readOnly: boolean;
  refreshKey: number;
}

export default function TaskSubtasksBlock({ task, readOnly, refreshKey }: Props) {
  const [items, setItems] = useState<TaskData[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [localKey, setLocalKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!task.id) return;
    TaskAPI.getSubtasks(task.id)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [task.id, refreshKey, localKey]);

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-3 flex items-center justify-between">
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
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            <Plus className="h-3.5 w-3.5" />
            Add subtask
          </button>
        )}
      </div>

      {items === null && <p className="text-xs text-gray-400">Loading…</p>}
      {items && items.length === 0 && (
        <p className="text-xs text-gray-400">No subtasks yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {items.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <Link
                href={`/tasks/${s.id}`}
                className="flex-1 truncate text-sm text-gray-900 hover:text-[#3CCED7] hover:underline"
              >
                {s.summary}
              </Link>
              <StatusPill status={s.status} />
              <span className="w-24 truncate text-[11px] text-gray-500">
                {s.owner?.username || s.owner?.email || 'Unassigned'}
              </span>
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
          onAdded={() => setLocalKey((k) => k + 1)}
        />
      )}
    </section>
  );
}
