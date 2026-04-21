'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DecisionTaskCreateModal from '@/components/decisions/DecisionTaskCreateModal';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData } from '@/types/task';
import type { DecisionRiskLevel } from '@/types/decision';

interface TaskPanelProps {
  decisionId: number;
  decisionTitle: string;
  decisionSummary?: string | null;
  decisionSeq?: number | null;
  selectedOptionText?: string | null;
  decisionLink: string;
  canCreate?: boolean;
  projectId?: number | null;
  projectName?: string | null;
  decisionRiskLevel?: DecisionRiskLevel | null;
  decisionApprovedBy?: number | null;
}

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

const summarizeStatuses = (tasks: TaskData[]) => {
  const counts = {
    total: tasks.length,
    APPROVED: 0,
    UNDER_REVIEW: 0,
    SUBMITTED: 0,
    REJECTED: 0,
  };

  tasks.forEach((task) => {
    const status = task.status as keyof typeof counts;
    if (status in counts) {
      counts[status] += 1;
    }
  });

  return counts;
};

const TaskPanel = ({
  decisionId,
  decisionTitle,
  decisionSummary,
  decisionSeq,
  selectedOptionText,
  decisionLink,
  canCreate = false,
  projectId,
  projectName,
  decisionRiskLevel,
  decisionApprovedBy,
}: TaskPanelProps) => {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const summary = summarizeStatuses(tasks);

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
      const items = parseTasksResponse(response);
      setTasks(items);
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

  return (
    <div className="h-full overflow-y-auto border-l border-gray-200 bg-gray-50 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Tasks</h3>
          <p className="mt-1 text-xs text-gray-500">Linked tasks for this decision.</p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Create Task
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 text-xs text-gray-500">Loading tasks...</div>
      ) : null}

      {!loading && !error ? (
        <div className="mt-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-[11px] text-gray-600">
          Tasks: {summary.total} total, {summary.APPROVED} approved, {summary.UNDER_REVIEW}{' '}
          under review, {summary.SUBMITTED} submitted, {summary.REJECTED} rejected.
        </div>
      ) : null}

      {!loading && error ? (
        <div className="mt-4 text-xs text-rose-600">{error}</div>
      ) : null}

      {!loading && !error && tasks.length === 0 ? (
        <div className="mt-4 text-xs text-gray-500">No tasks linked yet.</div>
      ) : null}

      {!loading && !error && tasks.length > 0 ? (
        <div className="mt-4 space-y-2">
          {tasks.map((task) => (
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
          ))}
        </div>
      ) : null}
      {canCreate ? (
        <DecisionTaskCreateModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          decisionId={decisionId}
          decisionTitle={decisionTitle}
          decisionSummary={decisionSummary}
          decisionSeq={decisionSeq}
          selectedOptionText={selectedOptionText}
          decisionLink={decisionLink}
          projectId={projectId}
          projectName={projectName}
          decisionRiskLevel={decisionRiskLevel}
          decisionApprovedBy={decisionApprovedBy}
          onCreated={fetchTasks}
        />
      ) : null}
    </div>
  );
};

export default TaskPanel;
