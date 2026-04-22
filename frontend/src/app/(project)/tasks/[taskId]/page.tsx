'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ChatFAB from '@/components/global-chat/ChatFAB';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { TaskAPI } from '@/lib/api/taskApi';
import { ProjectAPI, type ProjectMemberData } from '@/lib/api/projectApi';
import type { TaskData } from '@/types/task';

import TaskDetailHeader from '@/components/tasks-v2/detail/TaskDetailHeader';
import TaskDescriptionBlock from '@/components/tasks-v2/detail/TaskDescriptionBlock';
import TaskTypeBlock from '@/components/tasks-v2/detail/TaskTypeBlock';
import TaskSubtasksBlock from '@/components/tasks-v2/detail/TaskSubtasksBlock';
import TaskRelationsBlock from '@/components/tasks-v2/detail/TaskRelationsBlock';
import TaskAttachmentsBlock from '@/components/tasks-v2/detail/TaskAttachmentsBlock';
import TaskActivityBlock from '@/components/tasks-v2/detail/TaskActivityBlock';
import PropertiesPanel from '@/components/tasks-v2/detail/PropertiesPanel';
import ApprovalTimelinePanel from '@/components/tasks-v2/detail/ApprovalTimelinePanel';

export default function TaskV2DetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.taskId ? Number(params.taskId) : null;

  const [task, setTask] = useState<TaskData | null>(null);
  const [members, setMembers] = useState<ProjectMemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) return;
    try {
      const resp = await TaskAPI.getTask(taskId);
      setTask(resp.data as TaskData);
      setError(null);
    } catch (e) {
      setError((e as any)?.response?.data?.detail || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const pid = task?.project?.id ?? task?.project_id;
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
  }, [task?.project?.id, task?.project_id]);

  const onMutated = useCallback(async () => {
    setRefreshKey((k) => k + 1);
    await load();
  }, [load]);

  const doDelete = async () => {
    if (!task?.id) return;
    try {
      await TaskAPI.deleteTask(task.id);
      router.push('/tasks');
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Delete failed');
    }
  };

  const readOnly = task?.status === 'LOCKED';
  const taskShell = (task ?? {
    id: taskId ?? undefined,
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
    <ProtectedRoute renderChildrenWhileLoading>
      <DashboardLayout alerts={[]} upcomingMeetings={[]}>
        <div className="bg-gray-50">
          {error && !loading && (
          <div className="px-6 py-12 text-center text-sm text-rose-600">{error}</div>
        )}
          {(!error && (task || loading)) && (
          <div className="mx-auto max-w-[1440px] px-6 py-4">
            <TaskDetailHeader
              task={taskShell}
              members={members}
              readOnly={Boolean(readOnly)}
              onUpdated={onMutated}
              onMutated={onMutated}
              onDelete={() => setConfirmDelete(true)}
              loading={loading}
            />

            <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
              <div className="min-w-0 space-y-5">
                <TaskDescriptionBlock
                  task={taskShell}
                  readOnly={Boolean(readOnly)}
                  onUpdated={onMutated}
                  loading={loading}
                />
                <TaskTypeBlock task={taskShell} loading={loading} />
                <TaskSubtasksBlock
                  task={taskShell}
                  readOnly={Boolean(readOnly)}
                  refreshKey={refreshKey}
                  loading={loading}
                />
                <TaskRelationsBlock task={taskShell} readOnly={Boolean(readOnly)} loading={loading} />
                {(task?.id || loading) && (
                  <TaskAttachmentsBlock
                    taskId={task?.id ?? 0}
                    readOnly={Boolean(readOnly)}
                    loading={loading}
                  />
                )}
                {(task?.id || loading) && (
                  <TaskActivityBlock
                    taskId={task?.id ?? 0}
                    readOnly={Boolean(readOnly)}
                    refreshKey={refreshKey}
                    loading={loading}
                  />
                )}
              </div>

              <aside className="space-y-5">
                <PropertiesPanel
                  task={taskShell}
                  members={members}
                  readOnly={Boolean(readOnly)}
                  onUpdated={onMutated}
                  loading={loading}
                />
                {(task?.id || loading) && (
                  <ApprovalTimelinePanel
                    taskId={task?.id ?? 0}
                    refreshKey={refreshKey}
                    loading={loading}
                  />
                )}
              </aside>
            </div>
          </div>
        )}

        {confirmDelete && task && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-gray-100">
              <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />
              <div className="p-5">
                <h3 className="text-base font-semibold text-gray-900">Delete this task?</h3>
                <p className="mt-2 text-sm text-gray-600">
                  &quot;{task.summary}&quot; will be permanently removed. This cannot be undone.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={doDelete}
                    className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-medium text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
        <ChatFAB />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
