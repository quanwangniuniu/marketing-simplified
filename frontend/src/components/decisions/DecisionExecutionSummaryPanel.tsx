'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData } from '@/types/task';

interface DecisionExecutionSummaryPanelProps {
  decisionId: number;
  projectId?: number | null;
}

const statusBadgeClass = (status?: string) => {
  switch (status) {
    case 'APPROVED':
      return 'bg-green-100 text-green-800';
    case 'UNDER_REVIEW':
      return 'bg-yellow-100 text-yellow-800';
    case 'SUBMITTED':
      return 'bg-[#3CCED7]/15 text-[#1a9ba3]';
    case 'REJECTED':
      return 'bg-red-100 text-red-800';
    case 'LOCKED':
      return 'bg-purple-100 text-purple-800';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800';
    case 'DRAFT':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString();
};

const formatOwner = (task: TaskData) => {
  if (!task.owner) return '—';
  return task.owner.username || task.owner.email || `User #${task.owner.id}`;
};

const parseTasksResponse = (response: any): TaskData[] => {
  if (!response) return [];
  const data = response.data ?? response;
  const items = Array.isArray(data) ? data : data.results || data.items || [];
  return Array.isArray(items) ? (items as TaskData[]) : [];
};

const isCompletedStatus = (status?: string) =>
  status === 'APPROVED' || status === 'LOCKED';

const isFailedStatus = (status?: string) =>
  status === 'REJECTED' || status === 'CANCELLED';

const isBlockedStatus = (status?: string) =>
  status?.toUpperCase() === 'BLOCKED';

const DecisionExecutionSummaryPanel = ({
  decisionId,
  projectId,
}: DecisionExecutionSummaryPanelProps) => {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!decisionId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await TaskAPI.getTasks({
        content_type: 'decision',
        object_id: String(decisionId),
        ...(projectId ? { project_id: projectId } : {}),
      });
      setTasks(parseTasksResponse(response));
    } catch (err) {
      console.error('Failed to load decision tasks:', err);
      setError('Failed to load tasks.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [decisionId, projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const now = useMemo(() => new Date(), []);

  const {
    completedTasks,
    overdueTasks,
    failedOrBlockedTasks,
  } = useMemo(() => {
    const completed: TaskData[] = [];
    const overdue: TaskData[] = [];
    const failedOrBlocked: TaskData[] = [];

    tasks.forEach((task) => {
      const status = task.status || '';
      const due = task.due_date ? new Date(task.due_date) : null;
      const isOverdue =
        due !== null &&
        !Number.isNaN(due.getTime()) &&
        due < now &&
        !isCompletedStatus(status);

      if (isCompletedStatus(status)) completed.push(task);
      if (isOverdue) overdue.push(task);
      if (isFailedStatus(status) || isBlockedStatus(status)) {
        failedOrBlocked.push(task);
      }
    });

    return {
      completedTasks: completed,
      overdueTasks: overdue,
      failedOrBlockedTasks: failedOrBlocked,
    };
  }, [tasks, now]);

  const renderTaskRow = (task: TaskData) => (
    <Link
      key={task.id}
      href={`/tasks/${task.id}`}
      className="block rounded-md border border-gray-200 bg-white px-3 py-2 text-xs hover:bg-gray-50"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
            task.status
          )}`}
        >
          {task.status || '—'}
        </span>
        <span className="text-gray-500">Due {formatDate(task.due_date)}</span>
      </div>
      <div className="mt-1 text-gray-500">Owner: {formatOwner(task)}</div>
    </Link>
  );

  return (
    <div className="h-full overflow-y-auto border-l border-gray-200 bg-gray-50 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Execution Summary</h3>
          <p className="mt-1 text-xs text-gray-500">
            Outcome signals for decision review.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 text-xs text-gray-500">Loading tasks...</div>
      ) : null}

      {!loading && error ? (
        <div className="mt-4 text-xs text-rose-600">{error}</div>
      ) : null}

      {!loading && !error && tasks.length === 0 ? (
        <div className="mt-4 text-xs text-gray-500">No linked tasks yet.</div>
      ) : null}

      {!loading && !error && tasks.length > 0 ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span>Completed</span>
              <span className="font-semibold text-gray-900">
                {completedTasks.length}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Overdue</span>
              <span className="font-semibold text-gray-900">
                {overdueTasks.length}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Failed / Blocked</span>
              <span className="font-semibold text-gray-900">
                {failedOrBlockedTasks.length}
              </span>
            </div>
          </div>

          {failedOrBlockedTasks.length > 0 ? (
            <div>
              <div className="text-xs font-semibold text-gray-700">
                Failed or Blocked
              </div>
              <div className="mt-2 space-y-2">
                {failedOrBlockedTasks.map(renderTaskRow)}
              </div>
            </div>
          ) : null}

          {overdueTasks.length > 0 ? (
            <div>
              <div className="text-xs font-semibold text-gray-700">Overdue</div>
              <div className="mt-2 space-y-2">
                {overdueTasks.map(renderTaskRow)}
              </div>
            </div>
          ) : null}

          {completedTasks.length > 0 ? (
            <div>
              <div className="text-xs font-semibold text-gray-700">Completed</div>
              <div className="mt-2 space-y-2">
                {completedTasks.map(renderTaskRow)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default DecisionExecutionSummaryPanel;
