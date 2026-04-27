'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  Calendar,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Link2,
  Tag,
  Trash2,
  User,
  UserCheck,
} from 'lucide-react';
import type { TaskData } from '@/types/task';
import type { ProjectMemberData } from '@/lib/api/projectApi';
import { TaskAPI } from '@/lib/api/taskApi';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { PRIORITY_META, PRIORITY_OPTIONS } from './TYPE_META';
import { dueDateNextWeek, dueDateToday, dueDateTomorrow } from './taskDueDateQuickPick';
import {
  getMvpWorkflowMenuItems,
  runWorkflowMvpAction,
  type WorkflowMvpKind,
} from './taskWorkflowMvp';

const MENU_W = 220;
const MENU_H_COLLAPSED = 440;
const MENU_H_EXPANDED = 600;

const LABELS_NOT_SUPPORTED_TITLE = 'Task labels are not supported yet';

export type TaskListRowContextMenuState = {
  task: TaskData;
  x: number;
  y: number;
} | null;

type ExpandedSection = null | 'workflow' | 'priority' | 'dueDate' | 'owner' | 'approver';

function clampPosition(x: number, y: number, expanded: ExpandedSection) {
  let nx = x;
  let ny = y;
  const pad = 8;
  const menuH = expanded ? MENU_H_EXPANDED : MENU_H_COLLAPSED;
  if (nx + MENU_W > window.innerWidth - pad) {
    nx = window.innerWidth - MENU_W - pad;
  }
  if (ny + menuH > window.innerHeight - pad) {
    ny = window.innerHeight - menuH - pad;
  }
  if (nx < pad) nx = pad;
  if (ny < pad) ny = pad;
  return { x: nx, y: ny };
}

function taskDetailUrl(taskId: number) {
  if (typeof window === 'undefined') return `/tasks/${taskId}`;
  return `${window.location.origin}/tasks/${taskId}`;
}

function memberLabel(m: ProjectMemberData): string {
  return m.user.username || m.user.email || `User ${m.user.id}`;
}

type Props = {
  state: TaskListRowContextMenuState;
  menuMembers: ProjectMemberData[];
  menuMembersLoading: boolean;
  onRequestClose: () => void;
  onOpenDetail: (taskId: number) => void;
  onTaskDeleted: (taskId: number) => void;
  onTaskPatched: (taskId: number, data: Partial<TaskData>) => void;
};

const itemClass =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50';
const subItemClass =
  'flex w-full min-w-0 items-center px-3 py-1.5 pl-8 text-left text-xs text-gray-700 hover:bg-gray-100';

export default function TaskListRowContextMenu({
  state,
  menuMembers,
  menuMembersLoading,
  onRequestClose,
  onOpenDetail,
  onTaskDeleted,
  onTaskPatched,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pendingDelete, setPendingDelete] = useState<TaskData | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedSection>(null);
  const [patchBusy, setPatchBusy] = useState(false);

  const closeMenu = onRequestClose;

  useEffect(() => {
    setExpanded(null);
  }, [state?.task.id]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, closeMenu]);

  useEffect(() => {
    if (!state) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [state, closeMenu]);

  const taskIsReadOnly = state?.task.status === 'LOCKED';
  const disabledPatch = patchBusy || taskIsReadOnly;
  const projectId = state?.task.project_id ?? state?.task.project?.id ?? null;
  const memberPickDisabled = disabledPatch || projectId == null;
  const activeMembers = menuMembers.filter((m) => m.is_active);

  const workflowItems = useMemo(
    () => (state?.task ? getMvpWorkflowMenuItems(state.task) : []),
    [state?.task]
  );

  const runWorkflow = useCallback(
    async (kind: WorkflowMvpKind, successMessage: string) => {
      const id = state?.task.id;
      if (id == null || patchBusy) return;
      setPatchBusy(true);
      try {
        const next = await runWorkflowMvpAction(id, kind);
        onTaskPatched(id, next as Partial<TaskData>);
        toast.success(successMessage);
        closeMenu();
      } catch (e) {
        const data = (e as { response?: { data?: { detail?: string; error?: string } } })?.response?.data;
        toast.error(data?.detail || data?.error || (e as Error)?.message || 'Action failed');
      } finally {
        setPatchBusy(false);
      }
    },
    [state?.task.id, patchBusy, onTaskPatched, closeMenu]
  );

  const runPatch = useCallback(
    async (payload: Partial<TaskData>, successMessage: string) => {
      const id = state?.task.id;
      if (id == null || patchBusy || taskIsReadOnly) return;
      setPatchBusy(true);
      try {
        const res = await TaskAPI.updateTask(id, payload);
        const data = res.data as TaskData;
        const merged: Partial<TaskData> = {};
        if ('priority' in payload) merged.priority = data.priority;
        if ('due_date' in payload) merged.due_date = data.due_date ?? undefined;
        if ('owner_id' in payload) {
          merged.owner = data.owner;
          if (data.owner_id !== undefined) merged.owner_id = data.owner_id;
        }
        if ('current_approver_id' in payload) {
          merged.current_approver = data.current_approver;
          if (data.current_approver_id !== undefined) merged.current_approver_id = data.current_approver_id;
        }
        onTaskPatched(id, merged);
        toast.success(successMessage);
        closeMenu();
      } catch (e) {
        toast.error(
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Update failed'
        );
      } finally {
        setPatchBusy(false);
      }
    },
    [state?.task.id, patchBusy, taskIsReadOnly, onTaskPatched, closeMenu]
  );

  const handleOpen = () => {
    const id = state?.task.id;
    if (id == null) return;
    closeMenu();
    onOpenDetail(id);
  };

  const handleCopyLink = async () => {
    const id = state?.task.id;
    if (id == null) return;
    const url = taskDetailUrl(id);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
      closeMenu();
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleDeleteClick = () => {
    const task = state?.task;
    closeMenu();
    if (task?.id != null) setPendingDelete(task);
  };

  const handleConfirmDelete = useCallback(async () => {
    if (deleteBusy) return;
    const id = pendingDelete?.id;
    if (id == null) return;
    setDeleteBusy(true);
    try {
      await TaskAPI.deleteTask(id);
      toast.success('Task deleted');
      onTaskDeleted(id);
      setPendingDelete(null);
    } catch (e) {
      toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Delete failed');
    } finally {
      setDeleteBusy(false);
    }
  }, [pendingDelete, onTaskDeleted, deleteBusy]);

  const cancelDelete = () => setPendingDelete(null);

  if (!state && !pendingDelete) return null;

  const pos = state ? clampPosition(state.x, state.y, expanded) : { x: 0, y: 0 };
  const deleteMessage = pendingDelete
    ? `"${pendingDelete.summary || `Task #${pendingDelete.id}`}" will be permanently removed. This cannot be undone.`
    : '';

  const ownerApproverTitle =
    projectId == null ? 'Task has no project' : taskIsReadOnly ? 'Task is locked' : undefined;

  return (
    <>
      {state &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100] min-w-[220px] max-w-[260px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            style={{ left: pos.x, top: pos.y }}
            onContextMenu={(e) => e.preventDefault()}
            role="menu"
          >
            <button type="button" role="menuitem" className={itemClass} onClick={handleOpen}>
              <ExternalLink className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              Open task
            </button>
            <button type="button" role="menuitem" className={itemClass} onClick={() => void handleCopyLink()}>
              <Link2 className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              Copy task link
            </button>

            {workflowItems.length > 0 ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  disabled={patchBusy}
                  className={`${itemClass} disabled:cursor-not-allowed disabled:opacity-50`}
                  onClick={() => setExpanded((e) => (e === 'workflow' ? null : 'workflow'))}
                >
                  <GitBranch className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                  <span className="flex-1">Workflow</span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded === 'workflow' ? 'rotate-90' : ''}`}
                    aria-hidden
                  />
                </button>
                {expanded === 'workflow' && (
                  <div className="max-h-48 overflow-y-auto border-t border-gray-100 bg-gray-50/80 py-1">
                    {workflowItems.map(({ kind, label }) => (
                      <button
                        key={kind}
                        type="button"
                        role="menuitem"
                        disabled={patchBusy}
                        className={subItemClass}
                        onClick={() => void runWorkflow(kind, `${label} succeeded`)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : null}

            <button
              type="button"
              role="menuitem"
              disabled={disabledPatch || memberPickDisabled}
              title={ownerApproverTitle}
              className={`${itemClass} disabled:cursor-not-allowed disabled:opacity-50`}
              onClick={() => setExpanded((e) => (e === 'owner' ? null : 'owner'))}
            >
              <User className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              <span className="flex-1">Owner</span>
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded === 'owner' ? 'rotate-90' : ''}`}
                aria-hidden
              />
            </button>
            {expanded === 'owner' && (
              <div className="max-h-48 overflow-y-auto border-t border-gray-100 bg-gray-50/80 py-1">
                {menuMembersLoading ? (
                  <div className="px-3 py-2 text-xs text-gray-500">Loading…</div>
                ) : (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={disabledPatch}
                      className={subItemClass}
                      onClick={() =>
                        void runPatch({ owner_id: null } as unknown as Partial<TaskData>, 'Owner updated')
                      }
                    >
                      Unassigned
                    </button>
                    {activeMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="menuitem"
                        disabled={disabledPatch}
                        className={subItemClass}
                        onClick={() =>
                          void runPatch({ owner_id: m.user.id }, 'Owner updated')
                        }
                      >
                        <span className="truncate">{memberLabel(m)}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              role="menuitem"
              disabled={disabledPatch || memberPickDisabled}
              title={ownerApproverTitle}
              className={`${itemClass} disabled:cursor-not-allowed disabled:opacity-50`}
              onClick={() => setExpanded((e) => (e === 'approver' ? null : 'approver'))}
            >
              <UserCheck className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              <span className="flex-1">Approver</span>
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded === 'approver' ? 'rotate-90' : ''}`}
                aria-hidden
              />
            </button>
            {expanded === 'approver' && (
              <div className="max-h-48 overflow-y-auto border-t border-gray-100 bg-gray-50/80 py-1">
                {menuMembersLoading ? (
                  <div className="px-3 py-2 text-xs text-gray-500">Loading…</div>
                ) : (
                  activeMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="menuitem"
                      disabled={disabledPatch}
                      className={subItemClass}
                      title={m.role}
                      onClick={() =>
                        void runPatch({ current_approver_id: m.user.id }, 'Approver updated')
                      }
                    >
                      <span className="min-w-0 flex-1 truncate">{memberLabel(m)}</span>
                      <span className="shrink-0 pl-2 text-[10px] uppercase text-gray-400">{m.role}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            <button
              type="button"
              role="menuitem"
              disabled={disabledPatch}
              title={taskIsReadOnly ? 'Task is locked' : undefined}
              className={`${itemClass} disabled:cursor-not-allowed disabled:opacity-50`}
              onClick={() => setExpanded((e) => (e === 'priority' ? null : 'priority'))}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
                Priority
              </span>
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded === 'priority' ? 'rotate-90' : ''}`}
                aria-hidden
              />
            </button>
            {expanded === 'priority' && (
              <div className="border-t border-gray-100 bg-gray-50/80 py-1">
                {PRIORITY_OPTIONS.map((p) => {
                  const meta = PRIORITY_META[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      role="menuitem"
                      disabled={disabledPatch}
                      className={subItemClass}
                      onClick={() => void runPatch({ priority: p }, 'Priority updated')}
                    >
                      <span className={`mr-2 inline-block h-2 w-2 shrink-0 rounded-full ${meta?.dot ?? 'bg-gray-300'}`} />
                      {meta?.label ?? p}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              role="menuitem"
              disabled={disabledPatch}
              title={taskIsReadOnly ? 'Task is locked' : undefined}
              className={`${itemClass} disabled:cursor-not-allowed disabled:opacity-50`}
              onClick={() => setExpanded((e) => (e === 'dueDate' ? null : 'dueDate'))}
            >
              <Calendar className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              <span className="flex-1">Due date</span>
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded === 'dueDate' ? 'rotate-90' : ''}`}
                aria-hidden
              />
            </button>
            {expanded === 'dueDate' && (
              <div className="border-t border-gray-100 bg-gray-50/80 py-1">
                {(
                  [
                    ['Today', () => dueDateToday()],
                    ['Tomorrow', () => dueDateTomorrow()],
                    ['Next week', () => dueDateNextWeek()],
                  ] as const
                ).map(([label, getDate]) => (
                  <button
                    key={label}
                    type="button"
                    role="menuitem"
                    disabled={disabledPatch}
                    className={subItemClass}
                    onClick={() => void runPatch({ due_date: getDate() }, 'Due date updated')}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  disabled={disabledPatch}
                  className={subItemClass}
                  onClick={() =>
                    void runPatch({ due_date: null } as unknown as Partial<TaskData>, 'Due date updated')
                  }
                >
                  Clear due date
                </button>
              </div>
            )}

            <button
              type="button"
              role="menuitem"
              disabled
              title={LABELS_NOT_SUPPORTED_TITLE}
              className={`${itemClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <Tag className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              <span className="flex-1">Labels</span>
            </button>

            <button
              type="button"
              role="menuitem"
              className={`${itemClass} text-rose-600 hover:bg-rose-50`}
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              Delete task…
            </button>
          </div>,
          document.body
        )}

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Delete task"
        message={deleteMessage}
        type="danger"
        confirmText={deleteBusy ? 'Deleting…' : 'Delete'}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={cancelDelete}
      />
    </>
  );
}
