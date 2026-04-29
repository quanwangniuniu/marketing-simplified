'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ChatFAB from '@/components/global-chat/ChatFAB';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useTaskData } from '@/hooks/useTaskData';
import { useProjectStore } from '@/lib/projectStore';
import TabNav, { type TasksTab } from '@/components/tasks-v2/TabNav';
import SummaryView from '@/components/tasks-v2/SummaryView';
import ListView from '@/components/tasks-v2/ListView';
import BoardView from '@/components/tasks-v2/BoardView';
import { Skeleton } from '@/components/ui/skeleton';

const VALID_TABS: TasksTab[] = ['summary', 'tasks', 'board'];

export default function TasksV2Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams?.get('project_id');
  const tabParam = searchParams?.get('tab') as TasksTab | null;
  const activeProject = useProjectStore((s) => s.activeProject);
  const hasProjectStoreHydrated = useProjectStore((s) => s.hasHydrated);
  const projectId = projectIdParam
    ? Number(projectIdParam)
    : activeProject?.id ?? null;

  const tab: TasksTab = useMemo(
    () => (tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'tasks'),
    [tabParam]
  );

  const { tasks, loading, error, fetchTasks } = useTaskData();
  const [hasLoadedTaskListOnce, setHasLoadedTaskListOnce] = useState(false);
  const projectContextLoading = !projectIdParam && !hasProjectStoreHydrated;

  useEffect(() => {
    let cancelled = false;

    if (projectContextLoading) {
      setHasLoadedTaskListOnce(false);
      return () => {
        cancelled = true;
      };
    }

    if (!projectId) {
      setHasLoadedTaskListOnce(false);
      return () => {
        cancelled = true;
      };
    }

    setHasLoadedTaskListOnce(false);
    fetchTasks({ project_id: projectId, page: 1 })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setHasLoadedTaskListOnce(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchTasks, projectContextLoading, projectId]);

  const taskListLoading =
    projectContextLoading || (Boolean(projectId) && (!hasLoadedTaskListOnce || loading));

  const setTab = useCallback(
    (next: TasksTab) => {
      const params = new URLSearchParams(searchParams?.toString() || '');
      if (next === 'tasks') params.delete('tab');
      else params.set('tab', next);
      const qs = params.toString();
      router.replace(qs ? `/tasks?${qs}` : '/tasks');
    },
    [router, searchParams]
  );

  const headerActions = (
    <button
      type="button"
      onClick={() => router.push('/tasks/new')}
      className="inline-flex items-center gap-2 rounded-md bg-gradient-to-br from-[#3CCED7] to-[#A6E661] px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
    >
      <Plus className="h-4 w-4" />
      Create task
    </button>
  );

  return (
    <ProtectedRoute renderChildrenWhileLoading>
      <DashboardLayout alerts={[]} upcomingMeetings={[]}>
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <header className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                {projectContextLoading ? (
                  <Skeleton className="h-4 w-40" />
                ) : (
                  <span>{activeProject?.name ?? (projectId ? '' : 'No project selected')}</span>
                )}
                {projectId && !activeProject?.name && !projectContextLoading ? (
                  <Skeleton className="h-4 w-36" />
                ) : null}
                <span aria-hidden="true">·</span>
                <span className="text-gray-400">
                  {taskListLoading ? (
                    <Skeleton className="h-4 w-16" />
                  ) : (
                    `${tasks.length} item${tasks.length === 1 ? '' : 's'}`
                  )}
                </span>
              </div>
            </div>
          </header>

          <TabNav active={tab} onChange={setTab} trailing={headerActions} />

          {tab === 'summary' && (
            <SummaryView projectId={projectId} projectContextLoading={projectContextLoading} />
          )}
          {tab === 'tasks' && (
            <ListView tasks={tasks} loading={taskListLoading} error={error} projectId={projectId} />
          )}
          {tab === 'board' && <BoardView tasks={tasks} loading={taskListLoading} error={error} />}
        </div>
        <ChatFAB />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
