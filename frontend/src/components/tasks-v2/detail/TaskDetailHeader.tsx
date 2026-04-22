'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { ChevronRight, Trash2, Share2, ArrowLeft } from 'lucide-react';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData } from '@/types/task';
import StatusPill from './pills/StatusPill';
import PriorityPill from './pills/PriorityPill';
import TypeBadge from './pills/TypeBadge';
import FSMActionBar from './FSMActionBar';
import type { ProjectMemberData } from '@/lib/api/projectApi';
import { Skeleton } from '@/components/ui/skeleton';

function buildIssueKey(projectName?: string, taskId?: number) {
  const prefix = (projectName || 'TASK')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase();
  return `${prefix || 'TASK'}-${taskId ?? '?'}`;
}

interface Props {
  task: TaskData;
  members: ProjectMemberData[];
  readOnly: boolean;
  onUpdated: () => void | Promise<void>;
  onMutated: () => void | Promise<void>;
  onDelete: () => void;
  loading?: boolean;
}

export default function TaskDetailHeader({
  task,
  members,
  readOnly,
  onUpdated,
  onMutated,
  onDelete,
  loading = false,
}: Props) {
  const [value, setValue] = useState(task.summary || '');
  const [saving, setSaving] = useState(false);
  const lastSaved = useRef(task.summary || '');

  useEffect(() => {
    setValue(task.summary || '');
    lastSaved.current = task.summary || '';
  }, [task.summary, task.id]);

  const commit = async () => {
    const trimmed = value.trim();
    if (!task.id || !trimmed || trimmed === lastSaved.current) {
      if (!trimmed) setValue(lastSaved.current);
      return;
    }
    setSaving(true);
    try {
      await TaskAPI.updateTask(task.id, { summary: trimmed });
      lastSaved.current = trimmed;
      await onUpdated();
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Save failed');
      setValue(lastSaved.current);
    } finally {
      setSaving(false);
    }
  };

  const projectName = task.project?.name || 'Project';
  const projectId = task.project?.id ?? task.project_id;
  const issueKey = buildIssueKey(projectName, task.id);
  const priority = (task as any).priority || 'MEDIUM';

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-2">
        <nav className="flex items-center gap-2 text-xs text-gray-500">
          <Link
            href="/tasks"
            title="Back to Tasks"
            aria-label="Back to Tasks"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex items-center gap-1.5">
          <Link href="/tasks" className="hover:text-gray-900">
            Tasks
          </Link>
          <ChevronRight className="h-3 w-3 text-gray-300" />
          <Link
            href={projectId ? `/tasks?project_id=${projectId}` : '/tasks'}
            className="hover:text-gray-900"
          >
            {projectName}
          </Link>
          <ChevronRight className="h-3 w-3 text-gray-300" />
          <span className="font-semibold text-gray-900">{issueKey}</span>
          </div>
        </nav>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => toast('Share to Chat — coming soon')}
            title="Share to Chat"
            aria-label="Share to Chat"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={readOnly}
            title="Delete task"
            aria-label="Delete task"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="px-6 py-5">
        {saving && !loading && (
          <div className="mb-1 text-[11px] text-gray-400">Saving…</div>
        )}
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-72" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ) : (
          <input
            type="text"
            className="-mx-1 w-[calc(100%+0.5rem)] rounded-md border-0 border-b-2 border-transparent bg-transparent px-1 py-1 text-[22px] font-semibold leading-tight text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-[#3CCED7] disabled:opacity-70"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            disabled={readOnly}
            placeholder="Task title"
          />
        )}
        {!loading && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusPill status={task.status} />
            <PriorityPill priority={priority} />
            <TypeBadge type={task.type} />
            <span className="text-[11px] text-gray-400">
              Owner: {task.owner?.username || task.owner?.email || 'Unassigned'}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 bg-gray-50/40 px-6 py-3">
        {loading ? (
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        ) : (
          <FSMActionBar task={task} members={members} onMutated={onMutated} />
        )}
      </div>
    </section>
  );
}
