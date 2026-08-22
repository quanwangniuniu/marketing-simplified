'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData } from '@/types/task';
import { userDisplayName } from '@/types/task';
import type { ProjectMemberData } from '@/lib/api/projectApi';
import StatusPill from './pills/StatusPill';
import InlineSelect, { UserInitialsAvatar, type InlineSelectOption } from './InlineSelect';
import { ChevronsUp, ChevronUp, Minus, ChevronDown, ChevronsDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import TaskLabelsPicker from '@/components/tasks/TaskLabelsPicker';
import TaskParentPicker from '@/components/tasks/TaskParentPicker';
import type { TaskTag } from '@/types/task';

import {
  START_MUST_BE_ON_OR_BEFORE_DUE,
  violatesStartBeforeDue,
} from '@/lib/tasks/taskScheduleDates';

const PRIORITY_LEADING: Record<string, { Icon: typeof Minus; cls: string }> = {
  HIGHEST: { Icon: ChevronsUp, cls: 'text-rose-600' },
  HIGH: { Icon: ChevronUp, cls: 'text-orange-500' },
  MEDIUM: { Icon: Minus, cls: 'text-gray-400' },
  LOW: { Icon: ChevronDown, cls: 'text-sky-500' },
  LOWEST: { Icon: ChevronsDown, cls: 'text-gray-400' },
};

function priorityOption(value: string): InlineSelectOption {
  const meta = PRIORITY_LEADING[value];
  const { Icon } = meta;
  return {
    value,
    label: value.charAt(0) + value.slice(1).toLowerCase(),
    leading: <Icon className={`h-3.5 w-3.5 ${meta.cls}`} />,
  };
}

function memberOption(
  m: ProjectMemberData,
  { includeRole }: { includeRole?: boolean } = {}
): InlineSelectOption {
  const name = userDisplayName(m.user);
  return {
    value: String(m.user.id),
    label: name,
    leading: <UserInitialsAvatar name={name} />,
    sub: includeRole ? m.role : undefined,
  };
}

interface Props {
  task: TaskData;
  members: ProjectMemberData[];
  readOnly: boolean;
  onUpdated: (updatedTask?: TaskData) => void | Promise<void>;
  loading?: boolean;
  onFirstInteraction?: () => void;
}

const LABEL = 'text-[11px] font-medium uppercase tracking-wide text-gray-500';
const ROW = 'grid grid-cols-1 gap-1 py-2 sm:grid-cols-[88px_1fr] sm:items-center sm:gap-3';
const DATE_INPUT =
  'w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500';

function tagsForTask(task: TaskData): TaskTag[] {
  return Array.isArray(task.tags) ? task.tags : [];
}

export default function PropertiesPanel({
  task,
  members,
  readOnly,
  onUpdated,
  loading = false,
  onFirstInteraction,
}: Props) {
  const id = task.id!;
  const [saving, setSaving] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const savingTagsRef = useRef(false);
  const [localTags, setLocalTags] = useState<TaskTag[]>(() => tagsForTask(task));

  useEffect(() => {
    savingTagsRef.current = savingTags;
  }, [savingTags]);

  useEffect(() => {
    if (savingTagsRef.current) return;
    const next = tagsForTask(task);
    setLocalTags(next);
  }, [task.id, task.tags]);

  const patch = async (data: Partial<TaskData>) => {
    if (data.start_date !== undefined || data.due_date !== undefined) {
      const nextStart = data.start_date !== undefined ? data.start_date : task.start_date;
      const nextDue = data.due_date !== undefined ? data.due_date : task.due_date;
      if (violatesStartBeforeDue(nextStart, nextDue)) {
        toast.error(START_MUST_BE_ON_OR_BEFORE_DUE);
        return false;
      }
    }
    setSaving(true);
    try {
      await TaskAPI.updateTask(task.slug ?? id, data);
      await onUpdated();
      return true;
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Update failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveTags = async (next: TaskTag[]) => {
    const previous = localTags;
    setLocalTags(next);
    setSavingTags(true);
    setSaving(true);
    try {
      const response = await TaskAPI.updateTask(task.slug ?? id, { tags: next });
      const savedTask = response.data as TaskData;
      const savedTags = Array.isArray(savedTask?.tags) ? savedTask.tags : next;
      setLocalTags(savedTags);
      await onUpdated(savedTask);
    } catch (e) {
      setLocalTags(previous);
      toast.error((e as any)?.response?.data?.detail || 'Update failed');
    } finally {
      setSaving(false);
      setSavingTags(false);
    }
  };

  const UNASSIGNED = '__unassigned__';
  const isSubmitted = task.status !== 'DRAFT';
  const priority = (task as any).priority || 'MEDIUM';
  const ownerId = task.owner?.id ? String(task.owner.id) : UNASSIGNED;
  const approverId = task.current_approver?.id
    ? String(task.current_approver.id)
    : UNASSIGNED;
  const activeMembers = members.filter((m) => m.is_active);

  const priorityOpts = ['HIGHEST', 'HIGH', 'MEDIUM', 'LOW', 'LOWEST'].map(priorityOption);
  const unassignedOption: InlineSelectOption = {
    value: UNASSIGNED,
    label: 'Unassigned',
    leading: <span className="inline-block h-5 w-5 rounded-full bg-gray-100" />,
  };
  const ownerOpts: InlineSelectOption[] = [
    unassignedOption,
    ...activeMembers.map((m) => memberOption(m)),
  ];
  const approverOpts: InlineSelectOption[] = [
    unassignedOption,
    ...activeMembers.map((m) => memberOption(m, { includeRole: true })),
  ];
  // If the current approver isn't a project member (e.g. an AI agent), add them so
  // Radix Select can display the name instead of falling back to blank/placeholder.
  if (
    task.current_approver?.id &&
    !activeMembers.find((m) => m.user.id === task.current_approver!.id)
  ) {
    const name = userDisplayName(task.current_approver);
    approverOpts.push({ value: String(task.current_approver.id), label: name, leading: <UserInitialsAvatar name={name} /> });
  }

  if (loading) {
    return (
      <section className="min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Properties
        </h3>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`task-properties-skeleton-${index}`} className={ROW}>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Properties
      </h3>

      <div className={ROW}>
        <span className={LABEL}>Status</span>
        <StatusPill status={task.status} />
      </div>

      <div className={ROW}>
        <span className={LABEL}>Priority</span>
        <InlineSelect
          ariaLabel="Priority"
          value={priority}
          onValueChange={(v) => { onFirstInteraction?.(); patch({ priority: v } as any); }}
          options={priorityOpts}
          disabled={saving || readOnly}
        />
      </div>

      {task.is_subtask ? (
        <div className={ROW}>
          <span className={LABEL}>Parent</span>
          <TaskParentPicker
            task={task}
            readOnly={readOnly}
            disabled={saving}
            onUpdated={onUpdated}
          />
        </div>
      ) : null}

      <div className={ROW}>
        <span className={LABEL}>Owner</span>
        <InlineSelect
          ariaLabel="Owner"
          value={ownerId}
          onValueChange={(v) => patch({ owner_id: v === UNASSIGNED ? null : Number(v) })}
          options={ownerOpts}
          disabled={saving || readOnly || isSubmitted}
          placeholder="Unassigned"
        />
      </div>

      <div className={ROW}>
        <span className={LABEL}>Approver <span className="text-rose-500">*</span></span>
        <InlineSelect
          ariaLabel="Approver"
          value={approverId}
          onValueChange={(v) =>
            patch({ current_approver_id: v === UNASSIGNED ? null : Number(v) })
          }
          options={approverOpts}
          disabled={saving || readOnly || isSubmitted}
          placeholder="Select an approver…"
        />
      </div>

      <div className={ROW}>
        <span className={LABEL}>Labels</span>
        <TaskLabelsPicker
          projectId={task.project?.slug ?? task.project?.id ?? task.project_id}
          value={localTags}
          onChange={(next) => { void saveTags(next); }}
          disabled={readOnly}
        />
      </div>

      <div className="my-2 border-t border-gray-100" />

      <div className={ROW}>
        <span className={LABEL}>Planned</span>
        <input
          type="date"
          data-testid="properties-planned-date"
          className={DATE_INPUT}
          disabled={saving || readOnly || isSubmitted}
          value={((task as any).planned_start_date as string) || ''}
          onChange={(e) => patch({ planned_start_date: e.target.value || null } as any)}
        />
      </div>

      <div className={ROW}>
        <span className={LABEL}>Start</span>
        <input
          type="date"
          data-testid="properties-start-date"
          className={DATE_INPUT}
          disabled={saving || readOnly || isSubmitted}
          value={task.start_date || ''}
          onChange={(e) => patch({ start_date: e.target.value || null })}
        />
      </div>

      <div className={ROW}>
        <span className={LABEL}>Due</span>
        <input
          type="date"
          className={DATE_INPUT}
          disabled={saving || readOnly}
          value={task.due_date || ''}
          onChange={(e) => patch({ due_date: e.target.value || undefined })}
        />
      </div>
    </section>
  );
}
