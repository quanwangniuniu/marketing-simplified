'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { TaskAPI } from '@/lib/api/taskApi';
import { ProjectAPI, type ProjectMemberData } from '@/lib/api/projectApi';
import type { TaskData } from '@/types/task';
import { normalizeTaskFromApi } from '@/lib/tasks/normalizeTaskFromApi';
import { useTaskStore } from '@/lib/taskStore';
import { useAuthStore } from '@/lib/authStore';
import { useBuildUrl } from '@/lib/buildUrl';

import TaskDetailHeader from '@/components/tasks/detail/TaskDetailHeader';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import TaskDescriptionBlock from '@/components/tasks/detail/TaskDescriptionBlock';
import TaskTypeBlock from '@/components/tasks/detail/TaskTypeBlock';
import TaskSubtasksBlock from '@/components/tasks/detail/TaskSubtasksBlock';
import TaskRelationsBlock from '@/components/tasks/detail/TaskRelationsBlock';
import TaskAttachmentsBlock from '@/components/tasks/detail/TaskAttachmentsBlock';
import CommentSection from '@/components/comments/CommentSection';
import TaskFieldHistoryBlock from '@/components/tasks/detail/TaskFieldHistoryBlock';
import PropertiesPanel from '@/components/tasks/detail/PropertiesPanel';

interface TaskDrawerProps {
  taskSlug: string | null;
  onClose: () => void;
  onTaskUpdate?: () => void;
  taskSlugs?: string[];
  onNavigate?: (dir: 'next' | 'prev') => void;
  externalRefreshKey?: number;
}

export default function TaskDrawer({
  taskSlug,
  onClose,
  onTaskUpdate,
  taskSlugs = [],
  onNavigate,
  externalRefreshKey,
}: TaskDrawerProps) {
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const updateTaskInStore = useTaskStore((s) => s.updateTask);

  const [task, setTask] = useState<TaskData | null>(null);
  const [members, setMembers] = useState<ProjectMemberData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [visible, setVisible] = useState(false);
  const [attachmentPreviewOpen, setAttachmentPreviewOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (taskSlug !== null) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
  }, [taskSlug]);

  useEffect(() => {
    setDeleteConfirmOpen(false);
    setDeleteBusy(false);
    setActiveTab('details');
  }, [taskSlug]);

  const load = useCallback(async (silent = false): Promise<TaskData | null> => {
    if (!taskSlug) return null;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const resp = await TaskAPI.getTask(taskSlug);
      const fresh = normalizeTaskFromApi(resp.data);
      setTask(fresh);
      if (fresh.id) updateTaskInStore(fresh.id, fresh);
      return fresh;
    } catch (e) {
      setError((e as any)?.response?.data?.detail || 'Failed to load task');
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [taskSlug, updateTaskInStore]);

  useEffect(() => {
    if (taskSlug === null) {
      setTask(null);
      setMembers([]);
      setError(null);
      return;
    }
    void load();
  }, [taskSlug, load]);

  useEffect(() => {
    if (externalRefreshKey && taskSlug !== null) void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalRefreshKey]);

  useEffect(() => {
    const pid = task?.project?.slug ?? task?.project?.id ?? task?.project_id;
    if (!pid) return;
    let cancelled = false;
    ProjectAPI.getProjectMembers(pid)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [task?.project?.id, task?.project_id, task?.project?.slug]);

  const onMutated = useCallback(async (updatedTask?: TaskData) => {
    if (updatedTask?.id) {
      const normalized = normalizeTaskFromApi(updatedTask);
      const id = normalized.id;
      setTask(normalized);
      if (typeof id === 'number') {
        updateTaskInStore(id, normalized);
      }
    }
    setRefreshKey((k) => k + 1);
    const fresh = await load(true);
    await onTaskUpdate?.();
    if (fresh?.id) {
      updateTaskInStore(fresh.id, fresh);
    }
  }, [load, onTaskUpdate, updateTaskInStore]);

  useEffect(() => {
    if (taskSlug === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable;
      if (!isEditable && !attachmentPreviewOpen && onNavigate) {
        if (e.key === 'j') { e.preventDefault(); onNavigate('next'); }
        if (e.key === 'k') { e.preventDefault(); onNavigate('prev'); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [taskSlug, onClose, onNavigate, attachmentPreviewOpen]);

  useEffect(() => {
    if (taskSlug !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [taskSlug]);

  const currentUser = useAuthStore((s) => s.user);

  if (taskSlug === null) return null;

  const currentIndex = taskSlugs.indexOf(taskSlug);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < taskSlugs.length - 1;
  const fullPageSlug = task?.slug ?? taskSlug;
  const drawerLabel = task?.summary?.trim() || taskSlug;

  const isOwner = currentUser?.id != null && task?.owner?.id != null &&
    Number(currentUser.id) === Number(task.owner.id);
  const isApprover = currentUser?.id != null && task?.current_approver?.id != null &&
    Number(currentUser.id) === Number(task.current_approver.id);
  const isCreator = currentUser?.id != null && task?.created_by?.id != null &&
    Number(currentUser.id) === Number(task.created_by.id);
  const creatorCanEditUnassignedDraft = Boolean(
    task?.status === 'DRAFT' && !task.owner && !task.current_approver && isCreator
  );
  const readOnly = task?.status === 'LOCKED' || (!isOwner && !isApprover && !creatorCanEditUnassignedDraft);
  const taskShell = (task ?? {
    id: undefined,
    slug: taskSlug,
    summary: '',
    description: '',
    status: 'DRAFT',
    type: 'task',
    project: null,
    project_id: null,
    owner: null,
    current_approver: null,
    linked_object: null,
    start_date: null,
    due_date: null,
  }) as TaskData;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        data-testid="task-drawer-backdrop"
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        data-testid="task-drawer"
        className={`absolute right-0 top-0 h-full w-full max-w-[600px] overflow-y-auto bg-gray-50 shadow-2xl transition-transform duration-300 ease-in-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="max-w-[240px] truncate text-xs font-medium text-gray-500"
              title={drawerLabel}
            >
              {loading && !task?.summary ? 'Loading…' : drawerLabel}
            </span>
            {onNavigate && taskSlugs.length > 1 && (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onNavigate('prev')}
                  disabled={!hasPrev}
                  title="Previous task (k)"
                  aria-label="Previous task"
                  data-testid="drawer-nav-prev"
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('next')}
                  disabled={!hasNext}
                  title="Next task (j)"
                  aria-label="Next task"
                  data-testid="drawer-nav-next"
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <a
              href={buildUrl(`/tasks/${fullPageSlug}`)}
              data-testid="task-drawer-open-full"
              onClick={(e) => {
                e.preventDefault();
                router.push(buildUrl(`/tasks/${fullPageSlug}`));
              }}
              title="Open full page"
              aria-label="Open full page"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              data-testid="task-drawer-close"
              onClick={onClose}
              title="Close drawer"
              aria-label="Close drawer"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="sticky top-[53px] z-10 flex border-b border-gray-100 bg-white px-4">
          {(['details', 'history'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              data-testid={`drawer-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`relative mr-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'text-gray-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[#3CCED7]'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="px-4 py-4 space-y-4">
          {error && !loading && (
            <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
          )}

          {(!error || loading) && (
            <>
              <TaskDetailHeader
                task={taskShell}
                members={members}
                readOnly={Boolean(readOnly)}
                onUpdated={onMutated}
                onMutated={onMutated}
                onDelete={() => setDeleteConfirmOpen(true)}
                loading={loading}
                isDrawer
              />

              {activeTab === 'details' && (
                <div className="space-y-4">
                  <TaskDescriptionBlock
                    task={taskShell}
                    readOnly={Boolean(readOnly)}
                    onUpdated={onMutated}
                    loading={loading}
                  />
                  <TaskTypeBlock
                    task={taskShell}
                    loading={loading}
                    readOnly={Boolean(readOnly)}
                    onUpdated={onMutated}
                  />
                  <TaskSubtasksBlock
                    task={taskShell}
                    readOnly={Boolean(readOnly)}
                    refreshKey={refreshKey}
                    loading={loading}
                    onMutated={onMutated}
                  />
                  <TaskRelationsBlock
                    task={taskShell}
                    readOnly={Boolean(readOnly)}
                    loading={loading}
                    onMutated={onMutated}
                  />
                  {(task?.id || loading) && (
                    <TaskAttachmentsBlock
                      taskId={task?.id ?? 0}
                      readOnly={Boolean(readOnly)}
                      loading={loading}
                      onPreviewChange={setAttachmentPreviewOpen}
                      onMutated={onMutated}
                    />
                  )}
                  <PropertiesPanel
                    task={taskShell}
                    members={members}
                    readOnly={Boolean(readOnly)}
                    onUpdated={onMutated}
                    loading={loading}
                  />
                  {task?.id ? (
                    <CommentSection
                      entityType="task"
                      entityId={task.id}
                      readOnlyComposer={task.status === 'LOCKED'}
                    />
                  ) : null}
                </div>
              )}

              {activeTab === 'history' && task?.id && (
                <TaskFieldHistoryBlock
                  taskId={task.id}
                  refreshKey={refreshKey}
                  loading={loading}
                />
              )}

            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Delete task"
        message={
          task
            ? `"${task.summary || task.slug || 'Task'}" will be permanently removed. This cannot be undone.`
            : ''
        }
        type="danger"
        confirmText={deleteBusy ? 'Deleting…' : 'Delete'}
        confirmDisabled={deleteBusy}
        onConfirm={async () => {
          if (!task?.id || deleteBusy) return;
          setDeleteBusy(true);
          try {
            await TaskAPI.deleteTask(task.slug ?? task.id);
            toast.success('Task deleted');
            setDeleteConfirmOpen(false);
            onTaskUpdate?.();
            onClose();
          } catch (e) {
            toast.error((e as any)?.response?.data?.detail || 'Delete failed');
          } finally {
            setDeleteBusy(false);
          }
        }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
