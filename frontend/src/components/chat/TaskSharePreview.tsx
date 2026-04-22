'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData } from '@/types/task';

interface TaskSharePreviewProps {
  taskId: number;
  className?: string;
}

const statusTone: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-[#3CCED7]/15 text-[#1a9ba3]',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  LOCKED: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

const formatDate = (value?: string | null) => {
  if (!value) return 'No due date';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
};

export default function TaskSharePreview({ taskId, className = '' }: TaskSharePreviewProps) {
  const [task, setTask] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchTask = async () => {
      try {
        setLoading(true);
        const response = await TaskAPI.getTask(taskId);
        if (mounted) {
          setTask(response.data as TaskData);
        }
      } catch (error) {
        if (mounted) {
          setTask(null);
        }
        console.error('Error loading shared task preview:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchTask();

    return () => {
      mounted = false;
    };
  }, [taskId]);

  const displayStatus = task?.status || 'DRAFT';
  const statusClass = statusTone[displayStatus] || 'bg-slate-100 text-slate-600';
  const ownerLabel = useMemo(() => {
    if (!task?.owner) return 'Unassigned';
    return task.owner.username || task.owner.email || 'Unassigned';
  }, [task?.owner]);

  if (loading) {
    return (
      <div className={`rounded-lg border border-slate-200 bg-white p-3 ${className}`}>
        <div className="animate-pulse space-y-2">
          <div className="h-3 w-24 rounded bg-slate-200"></div>
          <div className="h-4 w-full rounded bg-slate-200"></div>
          <div className="h-3 w-32 rounded bg-slate-200"></div>
        </div>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  return (
    <Link
      href={`/tasks/${task.id}`}
      className={`block rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-400 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
          <ClipboardList className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
              {displayStatus.replace('_', ' ')}
            </span>
            <span className="text-xs text-slate-400">Task #{task.id}</span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
            {task.summary || 'Untitled task'}
          </p>
          <div className="mt-2 grid gap-1 text-xs text-slate-500">
            <span>Owner: {ownerLabel}</span>
            <span>Due: {formatDate(task.due_date)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
