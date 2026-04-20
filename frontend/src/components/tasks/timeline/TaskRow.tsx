'use client';

import { useState } from 'react';
import Link from 'next/link';
import { addDays, addHours } from 'date-fns';
import { CheckSquare, Square, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { TaskData } from '@/types/task';
import { dateToX, getColumnWidth, toDate, widthFromRange } from './timelineUtils';
import type { TimelineColumn, TimelineScale } from './timelineUtils';
import { TaskAPI } from '@/lib/api/taskApi';
import { getTaskTypeLabel } from '@/lib/taskTypeLabels';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const DONE_STATUSES = new Set(['APPROVED', 'LOCKED', 'DONE', 'COMPLETED', 'RESOLVED']);
const IN_PROGRESS_STATUSES = new Set(['SUBMITTED', 'UNDER_REVIEW', 'IN_REVIEW', 'IN_PROGRESS', 'REVIEW']);
const TODO_STATUSES = new Set(['DRAFT', 'REJECTED', 'CANCELLED', 'TODO', 'OPEN', 'BACKLOG']);

const TYPE_TONE_CLASSES: Record<string, string> = {
  task: 'bg-slate-100 text-slate-700',
  budget: 'bg-blue-100 text-blue-700',
  asset: 'bg-indigo-100 text-indigo-700',
  retrospective: 'bg-purple-100 text-purple-700',
  report: 'bg-slate-100 text-slate-700',
  scaling: 'bg-teal-100 text-teal-700',
  alert: 'bg-rose-100 text-rose-700',
  experiment: 'bg-amber-100 text-amber-700',
  optimization: 'bg-violet-100 text-violet-700',
  communication: 'bg-cyan-100 text-cyan-700',
};

const getTypeTone = (value?: string | null) => {
  if (!value) return TYPE_TONE_CLASSES.task;
  const normalized = value.toLowerCase();
  return TYPE_TONE_CLASSES[normalized] || TYPE_TONE_CLASSES.task;
};

const buildIssueKey = (task: TaskData) => {
  const projectName = task.project?.name || `PRJ${task.project_id ?? ''}`;
  const prefix = projectName
    .toString()
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase();
  return `${prefix || 'TASK'}-${task.id ?? 'NEW'}`;
};

interface TaskRowProps {
  task: TaskData;
  columns: TimelineColumn[];
  rangeStart: Date;
  rangeEnd: Date;
  scale: TimelineScale;
  leftColumnWidth?: number;
  className?: string;
  indent?: number;
  issueKey?: string;
  onTaskClick?: (task: TaskData) => void;
  onReorder?: (draggedId: number, targetId: number, position: 'before' | 'after') => void;
  onDelete?: (taskId: number) => void;
}

const TaskRow = ({
  task,
  columns,
  rangeStart,
  rangeEnd,
  scale,
  leftColumnWidth = 280,
  className,
  indent = 0,
  issueKey,
  onTaskClick,
  onReorder,
  onDelete,
}: TaskRowProps) => {
  const [hoverPos, setHoverPos] = useState<'before' | 'after' | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const columnWidth = getColumnWidth(scale);
  const gridWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const startDateRaw = toDate(task.start_date);
  const endDateRaw = toDate(task.due_date);
  const defaultDuration = (() => {
    if (scale === 'today') return addHours(rangeStart, 4);
    if (scale === 'week') return addDays(rangeStart, 3);
    return addDays(rangeStart, 14);
  })();
  const fallbackStart = (() => {
    const rangeMs = rangeEnd.getTime() - rangeStart.getTime();
    if (rangeMs <= 0) return rangeStart;
    return new Date(rangeStart.getTime() + rangeMs * 0.2);
  })();

  let startDate = startDateRaw || null;
  let endDate = endDateRaw || null;

  if (startDateRaw && !endDateRaw) {
    endDate = scale === 'today' ? addHours(startDateRaw, 4) : addDays(startDateRaw, scale === 'week' ? 3 : 14);
  }
  if (!startDateRaw && endDateRaw) {
    startDate = scale === 'today' ? addHours(endDateRaw, -4) : addDays(endDateRaw, scale === 'week' ? -3 : -14);
  }
  if (!startDateRaw && !endDateRaw) {
    startDate = fallbackStart;
    endDate = defaultDuration;
  }

  startDate = startDate || rangeStart;
  endDate = endDate || rangeEnd;
  const minDurationMs = scale === 'today' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const safeEnd = endDate.getTime() < startDate.getTime() ? new Date(startDate.getTime() + minDurationMs) : endDate;
  const width = widthFromRange(startDate, safeEnd, rangeStart, rangeEnd, columns, 10);
  const left = dateToX(startDate, rangeStart, rangeEnd, columns);
  const typeLabel = getTaskTypeLabel(task.type);
  const typeTone = getTypeTone(task.type);
  const resolvedIssueKey = issueKey || buildIssueKey(task);
  const isDone = DONE_STATUSES.has((task.status || '').toUpperCase());
  const isDraft =
    (task.status || '').toUpperCase() === 'DRAFT' ||
    (task as TaskData & { backendStatus?: string }).backendStatus === 'DRAFT' ||
    task.draft_payload != null;

  return (
    <>
    <div
      className={cn("grid items-stretch relative", className)}
      style={{ gridTemplateColumns: `${leftColumnWidth}px 1fr` }}
      draggable={!!task.id}
      onDragStart={(e) => {
        if (!task.id) return;
        e.dataTransfer.setData('text/plain', String(task.id));
        e.dataTransfer.setData('application/task-project', String(task.project?.id ?? task.project_id ?? ''));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        setHoverPos(e.clientY < mid ? 'before' : 'after');
      }}
      onDragLeave={() => setHoverPos(null)}
      onDrop={(e) => {
        e.preventDefault();
        const draggedId = Number(e.dataTransfer.getData('text/plain'));
        const draggedProjectId = e.dataTransfer.getData('application/task-project');
        const targetProjectId = String(task.project?.id ?? task.project_id ?? '');

        if (draggedProjectId !== targetProjectId) {
          setHoverPos(null);
          return;
        }

        if (task.id && !Number.isNaN(draggedId) && draggedId !== task.id && hoverPos) {
          onReorder?.(draggedId, task.id, hoverPos);
        }
        setHoverPos(null);
      }}
    >
      {hoverPos === 'before' && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500 z-10" />
      )}
      {hoverPos === 'after' && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 z-10" />
      )}
      <div className="flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 group">
        <button
          type="button"
          onClick={() => { setNavigating(true); onTaskClick?.(task); }}
          className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-50", navigating && "opacity-50 pointer-events-none")}
        >
          <span className="text-slate-400">
            {isDone ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: indent }}>
            <span className="shrink-0 whitespace-nowrap text-[10px] font-medium text-slate-400">
              {resolvedIssueKey}
            </span>
            {isDraft ? (
              <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                Draft
              </span>
            ) : null}
            <span
              className="truncate font-medium text-slate-800"
              style={{ maxWidth: Math.max(140, leftColumnWidth - 200) }}
              title={task.summary}
            >
              {task.summary || 'Untitled task'}
            </span>
            {task.content_type === 'decision' && task.object_id ? (
              <span className="shrink-0 text-[10px] text-slate-400" title="From decision">
                From{' '}
                <Link
                  href={`/decisions-v2/${task.object_id}${(task.project?.id ?? task.project_id) ? `?project_id=${task.project?.id ?? task.project_id}` : ''}`}
                  className="text-indigo-600 hover:text-indigo-800 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Decision #{task.object_id}
                </Link>
              </span>
            ) : null}
          </div>
          <span className={cn('shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold', typeTone)}>
            {typeLabel}
          </span>
        </button>

        {task.id && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
            title="Delete task"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div
        className="relative overflow-x-auto overflow-y-visible scrollbar-hide"
        data-timeline-scroll
      >
        <div
          className="relative flex h-11 items-center"
          style={{ minWidth: gridWidth || columnWidth }}
        >
          <div
            data-testid={`task-bar-${task.id}`}
            className="timeline-bar absolute top-1/2 h-[16px] -translate-y-1/2 rounded-full bg-purple-500 z-10"
            style={{ left, width }}
          />
        </div>
      </div>
    </div>
    <ConfirmDialog
      isOpen={showDeleteConfirm}
      title="Delete task"
      message={task.id ? `Delete task #${task.id} "${task.summary || 'Untitled task'}"?` : ''}
      type="danger"
      confirmText="Delete"
      onConfirm={async () => {
        if (!task.id) return;
        try {
          await TaskAPI.deleteTask(task.id);
          toast.success('Task deleted');
          onDelete?.(task.id);
        } catch (error) {
          console.error('Failed to delete task:', error);
          toast.error('Failed to delete task. Please try again.');
        }
        setShowDeleteConfirm(false);
      }}
      onCancel={() => setShowDeleteConfirm(false)}
    />
    </>
  );
};

export default TaskRow;
