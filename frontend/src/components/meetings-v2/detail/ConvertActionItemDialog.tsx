'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import type { MeetingActionItem, ConvertActionItemToTaskRequest } from '@/types/meeting';
import type { TaskData } from '@/types/task';
import InlineSelect from '@/components/tasks-v2/detail/InlineSelect';
import { TASK_TYPES, PRIORITY_OPTIONS, PRIORITY_META } from '@/components/tasks-v2/TYPE_META';

interface Member {
  id: number;
  user: { id: number; username?: string; email?: string; name?: string };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  meetingId: number;
  item: MeetingActionItem | null;
  members: Member[];
  onConverted: (task: TaskData) => void;
}

const NO_OWNER = '__no_owner__';

function memberId(m: Member): number {
  return m.user?.id ?? m.id;
}

function memberLabel(m: Member): string {
  const u = m.user;
  return u?.name || u?.username || u?.email || `User #${memberId(m)}`;
}

export default function ConvertActionItemDialog({
  open,
  onOpenChange,
  projectId,
  meetingId,
  item,
  members,
  onConverted,
}: Props) {
  const [ownerId, setOwnerId] = useState<string>(NO_OWNER);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [taskType, setTaskType] = useState('execution');
  const [createAsDraft, setCreateAsDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOwnerId(NO_OWNER);
    setDueDate('');
    setPriority('MEDIUM');
    setTaskType('execution');
    setCreateAsDraft(false);
    setSubmitting(false);
  }, [open]);

  const ownerOptions = [
    { value: NO_OWNER, label: 'Me (default)' },
    ...members.map((m) => ({
      value: String(memberId(m)),
      label: memberLabel(m),
    })),
  ];

  const submit = async () => {
    if (!item || submitting) return;
    setSubmitting(true);
    const payload: ConvertActionItemToTaskRequest = {
      type: taskType,
      priority,
      create_as_draft: createAsDraft,
    };
    if (ownerId !== NO_OWNER) payload.owner_id = Number(ownerId);
    if (dueDate) payload.due_date = dueDate;
    try {
      const task = await MeetingsAPI.convertMeetingActionItemToTask(
        projectId,
        meetingId,
        item.id,
        payload,
      );
      toast.success('Action item converted to task');
      onConverted(task);
      onOpenChange(false);
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string; action_item?: string[] } }; message?: string };
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.action_item?.[0] ||
        err.message ||
        'Could not convert action item.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-gray-100 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />
          <div className="flex items-start justify-between px-5 pt-4">
            <div className="min-w-0">
              <Dialog.Title className="text-[15px] font-semibold text-gray-900">
                Convert to task
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 truncate text-xs text-gray-500">
                {item ? item.title : ''}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="-mr-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4 px-5 pb-5 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Owner
                </label>
                <InlineSelect
                  ariaLabel="Task owner"
                  value={ownerId}
                  onValueChange={setOwnerId}
                  options={ownerOptions}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Priority
                </label>
                <InlineSelect
                  ariaLabel="Task priority"
                  value={priority}
                  onValueChange={setPriority}
                  options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Due date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Task type
                </label>
                <InlineSelect
                  ariaLabel="Task type"
                  value={taskType}
                  onValueChange={setTaskType}
                  options={TASK_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={createAsDraft}
                onChange={(e) => setCreateAsDraft(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-[#3CCED7] focus:ring-[#3CCED7]"
              />
              <span>Create as draft (do not auto-submit)</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !item}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {submitting ? 'Converting…' : 'Convert to task'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
