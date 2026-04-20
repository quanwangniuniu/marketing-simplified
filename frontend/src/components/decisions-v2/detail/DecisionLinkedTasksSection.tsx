'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { TaskAPI } from '@/lib/api/taskApi';

interface LinkedTask {
  id: number;
  summary?: string | null;
  status?: string | null;
  type?: string | null;
  priority?: string | null;
}

interface Props {
  decisionId: number;
  projectId: number | null;
  editable: boolean;
  onCreateTask: () => void;
  refreshKey?: number;
}

function statusTone(status?: string | null): string {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED':
    case 'LOCKED':
      return 'bg-emerald-50 text-emerald-700';
    case 'UNDER_REVIEW':
    case 'SUBMITTED':
      return 'bg-amber-50 text-amber-700';
    case 'REJECTED':
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export default function DecisionLinkedTasksSection({
  decisionId,
  projectId,
  editable,
  onCreateTask,
  refreshKey,
}: Props) {
  const [tasks, setTasks] = useState<LinkedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!decisionId) return;
    let cancelled = false;
    setLoading(true);
    TaskAPI.getTasks({
      content_type: 'decision',
      object_id: String(decisionId),
      include_subtasks: true,
    })
      .then((res) => {
        if (cancelled) return;
        const data = res.data as any;
        const rows: LinkedTask[] = Array.isArray(data)
          ? data
          : data?.results ?? data?.items ?? [];
        setTasks(rows);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as any)?.response?.data?.detail || 'Failed to load linked tasks');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [decisionId, refreshKey]);

  const linkHref = (taskId: number) =>
    projectId ? `/tasks-v2/${taskId}?project_id=${projectId}` : `/tasks-v2/${taskId}`;

  return (
    <section
      id="decision-section-linked-tasks"
      className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Linked tasks
          {tasks.length > 0 && (
            <span className="ml-2 text-[11px] font-medium normal-case text-gray-400">
              {tasks.length}
            </span>
          )}
        </h2>
        {editable && (
          <button
            type="button"
            onClick={onCreateTask}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Create task
          </button>
        )}
      </div>

      {loading && <p className="text-xs text-gray-400">Loading linked tasks…</p>}
      {error && !loading && <p className="text-xs text-rose-600">{error}</p>}
      {!loading && !error && tasks.length === 0 && (
        <p className="text-xs text-gray-400">
          {editable
            ? 'No tasks linked to this decision yet. Create one to start tracking follow-through.'
            : 'No tasks linked to this decision.'}
        </p>
      )}
      {!loading && !error && tasks.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {tasks.map((task) => (
            <li key={task.id} className="py-2.5">
              <Link
                href={linkHref(task.id)}
                className="group flex items-center justify-between gap-3 rounded-md px-2 py-1 transition hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-gray-900 group-hover:text-[#3CCED7]">
                    {task.summary || `Task #${task.id}`}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500">
                    <span>#{task.id}</span>
                    {task.type && <span>· {task.type}</span>}
                    {task.priority && <span>· {task.priority}</span>}
                  </div>
                </div>
                {task.status && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(
                      task.status
                    )}`}
                  >
                    {task.status.replace(/_/g, ' ').toLowerCase()}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
