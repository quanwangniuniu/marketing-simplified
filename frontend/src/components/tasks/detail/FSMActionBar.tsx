'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData, UserSummary } from '@/types/task';
import type { ProjectMemberData } from '@/lib/api/projectApi';
import InlineSelect, { UserInitialsAvatar, type InlineSelectOption } from './InlineSelect';
import { getTypeSchema } from '@/lib/tasks/typeFieldSchemas';
import { useAuthStore } from '@/lib/authStore';

type Variant = 'primary' | 'ghost' | 'danger';

interface Props {
  task: TaskData;
  members: ProjectMemberData[];
  onMutated: () => void | Promise<void>;
}

const BASE =
  'inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium leading-none transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto';
const VARIANT: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white shadow-sm hover:opacity-95',
  ghost: 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300',
  danger: 'bg-white text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50',
};

function ActionBtn({
  label,
  variant,
  onClick,
  disabled,
  title,
}: {
  label: string;
  variant: Variant;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`${BASE} ${VARIANT[variant]}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {label}
    </button>
  );
}

export default function FSMActionBar({ task, members, onMutated }: Props) {
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardApprover, setForwardApprover] = useState<number | null>(null);

  const currentUser = useAuthStore((s) => s.user);
  const isApprover =
    currentUser?.id != null &&
    task.current_approver?.id != null &&
    Number(currentUser.id) === Number(task.current_approver.id);

  const isOwner =
    currentUser?.id != null &&
    task.owner?.id != null &&
    Number(currentUser.id) === Number(task.owner.id);

  const status = task.status ?? 'DRAFT';
  const id = task.id;
  if (!id) return null;

  const run = async (op: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await op();
      await onMutated();
    } catch (e) {
      const data = (e as any)?.response?.data;
      const detail = data?.detail || data?.error || (e as Error)?.message || 'Action failed';
      toast.error(detail);
    } finally {
      setBusy(false);
    }
  };

  const submitReject = async () => {
    if (!rejectComment.trim()) {
      toast.error('Comment is required to reject');
      return;
    }
    await run(() => TaskAPI.makeApproval(id, { action: 'reject', comment: rejectComment.trim() }));
    setRejectOpen(false);
    setRejectComment('');
  };

  const submitForward = async () => {
    if (!forwardApprover) {
      toast.error('Select an approver');
      return;
    }
    await run(() => TaskAPI.forward(id, { next_approver_id: forwardApprover }));
    setForwardOpen(false);
    setForwardApprover(null);
  };

  const activeMembers = members.filter((m) => m.is_active);

  const buttons: Array<{ label: string; variant: Variant; action: () => void | Promise<void>; extraDisabled?: boolean; title?: string }> = [];
  switch (status) {
    case 'DRAFT':
      if (isOwner) buttons.push({
        label: 'Submit',
        variant: 'primary',
        extraDisabled: !task.current_approver || !task.owner,
        title: !task.current_approver
          ? 'Assign an approver before submitting'
          : !task.owner
          ? 'Assign an owner before submitting'
          : undefined,
        action: () => {
          if (!task.current_approver) {
            toast.error('Assign an approver before submitting.', { id: 'fsm-submit-no-approver' });
            return;
          }
          if (!task.owner) {
            toast.error('Assign an owner before submitting.', { id: 'fsm-submit-no-owner' });
            return;
          }
          const schema = getTypeSchema(task.type);
          if (schema) {
            // Mirror TaskTypeBlock's displayObj: in DRAFT, draft_payload is the working copy
            // and overrides the linked object (user may have cleared a field in the form).
            const linkedObj = (task.linked_object as Record<string, unknown> | null | undefined);
            const hasLinked = linkedObj && typeof linkedObj === 'object' && Object.keys(linkedObj).length > 0;
            const draftPayload = (task.draft_payload as Record<string, unknown> | null | undefined);
            const checkObj: Record<string, unknown> = hasLinked
              ? (draftPayload ? { ...linkedObj!, ...draftPayload } : linkedObj!)
              : (draftPayload ?? {});

            const missingFields = (schema.editFields ?? schema.fields)
              .filter((f) => f.required && (!f.showWhen || f.showWhen(checkObj)))
              .filter((f) => {
                // When draft_payload is present it uses form keys; otherwise the API response
                // shape uses linkedKey (e.g. budget_pool vs budget_pool_composite).
                const checkKey = (hasLinked && !draftPayload) ? (f.linkedKey ?? f.key) : f.key;
                const val = checkObj[checkKey];
                return !val || !String(val).trim();
              });

            if (missingFields.length > 0) {
              toast.error(
                `Fill required fields before submitting: ${missingFields.map((f) => f.label).join(', ')}`,
                { duration: 3000, id: 'fsm-submit-missing-fields' },
              );
              return;
            }
          }
          run(() => TaskAPI.submitTask(id));
        },
      });
      break;
    case 'SUBMITTED':
      if (isApprover) {
        buttons.push({ label: 'Start Review', variant: 'primary', action: () => run(() => TaskAPI.startReview(id)) });
      }
      if (isApprover || isOwner) {
        buttons.push({ label: 'Cancel', variant: 'danger', action: () => run(() => TaskAPI.cancelTask(id)) });
      }
      break;
    case 'UNDER_REVIEW':
      if (isApprover) {
        buttons.push({
          label: 'Approve',
          variant: 'primary',
          action: () => run(() => TaskAPI.makeApproval(id, { action: 'approve' })),
        });
        buttons.push({ label: 'Reject', variant: 'danger', action: () => setRejectOpen(true) });
        buttons.push({ label: 'Cancel', variant: 'danger', action: () => run(() => TaskAPI.cancelTask(id)) });
      }
      break;
    case 'APPROVED':
      if (isApprover) {
        buttons.push({ label: 'Lock', variant: 'primary', action: () => run(() => TaskAPI.lock(id)) });
        buttons.push({ label: 'Forward', variant: 'ghost', action: () => setForwardOpen(true) });
        buttons.push({ label: 'Cancel', variant: 'danger', action: () => run(() => TaskAPI.cancelTask(id)) });
      }
      break;
    case 'REJECTED':
    case 'CANCELLED':
      buttons.push({ label: 'Revise', variant: 'primary', action: () => run(() => TaskAPI.revise(id)) });
      break;
    case 'LOCKED':
      if (isApprover) {
        buttons.push({ label: 'Unlock', variant: 'ghost', action: () => run(() => TaskAPI.unlock(id)) });
      }
      break;
  }

  if (buttons.length === 0 && !rejectOpen && !forwardOpen) return null;

  const submitBlockReasons: string[] = [];
  if (status === 'DRAFT') {
    if (!task.owner) submitBlockReasons.push('an owner must be assigned');
    if (!task.current_approver) submitBlockReasons.push('an approver must be assigned');
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {buttons.map((b) => (
          <ActionBtn
            key={b.label}
            label={b.label}
            variant={b.variant}
            onClick={b.action}
            disabled={busy || !!b.extraDisabled}
            title={b.title}
          />
        ))}
      </div>

      {submitBlockReasons.length > 0 && (
        <p className="mt-2 text-xs text-amber-600">
          Cannot submit: {submitBlockReasons.join(' and ')}.
        </p>
      )}

      {rejectOpen && (
        <div className="mt-3 rounded-lg bg-rose-50 p-3 ring-1 ring-rose-200">
          <label className="mb-1 block text-xs font-medium text-rose-700">
            Reject reason (required)
          </label>
          <textarea
            className="w-full rounded-md border border-rose-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-rose-400"
            rows={3}
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Explain why you're rejecting…"
          />
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={`${BASE} ${VARIANT.ghost}`}
              onClick={() => {
                setRejectOpen(false);
                setRejectComment('');
              }}
              disabled={busy}
            >
              Back
            </button>
            <button
              type="button"
              className={`${BASE} ${VARIANT.danger}`}
              onClick={submitReject}
              disabled={busy}
            >
              Confirm reject
            </button>
          </div>
        </div>
      )}

      {forwardOpen && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3 ring-1 ring-gray-200">
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            Forward to approver
          </label>
          <InlineSelect
            ariaLabel="Forward approver"
            placeholder="Select an active project member…"
            value={forwardApprover ? String(forwardApprover) : ''}
            onValueChange={(v) => setForwardApprover(v ? Number(v) : null)}
            options={activeMembers.map<InlineSelectOption>((m) => {
              const name = m.user.username || m.user.email || `User ${m.user.id}`;
              return {
                value: String(m.user.id),
                label: name,
                leading: <UserInitialsAvatar name={name} />,
                sub: m.role,
              };
            })}
          />
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={`${BASE} ${VARIANT.ghost}`}
              onClick={() => {
                setForwardOpen(false);
                setForwardApprover(null);
              }}
              disabled={busy}
            >
              Back
            </button>
            <button
              type="button"
              className={`${BASE} ${VARIANT.primary}`}
              onClick={submitForward}
              disabled={busy}
            >
              Forward
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
