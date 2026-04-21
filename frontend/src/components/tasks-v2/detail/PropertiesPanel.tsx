'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData } from '@/types/task';
import type { ProjectMemberData } from '@/lib/api/projectApi';
import StatusPill from './pills/StatusPill';
import InlineSelect, { UserInitialsAvatar, type InlineSelectOption } from './InlineSelect';
import { ChevronsUp, ChevronUp, Minus, ChevronDown, ChevronsDown } from 'lucide-react';

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
  const name = m.user.username || m.user.email || `User ${m.user.id}`;
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
  onUpdated: () => void | Promise<void>;
}

const LABEL = 'text-[11px] font-medium uppercase tracking-wide text-gray-500';
const ROW = 'grid grid-cols-[88px_1fr] items-center gap-3 py-2';
const DATE_INPUT =
  'w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none transition hover:border-gray-300 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500';

export default function PropertiesPanel({ task, members, readOnly, onUpdated }: Props) {
  const id = task.id!;
  const [saving, setSaving] = useState(false);

  const patch = async (data: Partial<TaskData>) => {
    setSaving(true);
    try {
      await TaskAPI.updateTask(id, data);
      await onUpdated();
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const UNASSIGNED = '__unassigned__';
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

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
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
          onValueChange={(v) => patch({ priority: v } as any)}
          options={priorityOpts}
          disabled={saving || readOnly}
        />
      </div>

      <div className={ROW}>
        <span className={LABEL}>Owner</span>
        <InlineSelect
          ariaLabel="Owner"
          value={ownerId}
          onValueChange={(v) => patch({ owner_id: v === UNASSIGNED ? null : Number(v) })}
          options={ownerOpts}
          disabled={saving || readOnly}
          placeholder="Unassigned"
        />
      </div>

      <div className={ROW}>
        <span className={LABEL}>Approver</span>
        <InlineSelect
          ariaLabel="Approver"
          value={approverId}
          onValueChange={(v) => patch({ current_approver_id: v === UNASSIGNED ? undefined : Number(v) })}
          options={approverOpts}
          disabled={saving || readOnly}
          placeholder="Unassigned"
        />
      </div>

      <div className="my-2 border-t border-gray-100" />

      <div className={ROW}>
        <span className={LABEL}>Planned</span>
        <input
          type="date"
          className={DATE_INPUT}
          disabled={saving || readOnly}
          value={((task as any).planned_start_date as string) || ''}
          onChange={(e) => patch({ planned_start_date: e.target.value || null } as any)}
        />
      </div>

      <div className={ROW}>
        <span className={LABEL}>Start</span>
        <input
          type="date"
          className={DATE_INPUT}
          disabled={saving || readOnly}
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
