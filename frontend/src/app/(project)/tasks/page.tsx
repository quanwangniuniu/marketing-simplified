'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ChatFAB from '@/components/global-chat/ChatFAB';
import { useTaskData } from '@/hooks/useTaskData';
import { useProjectStore } from '@/lib/projectStore';
import TabNav, { type TasksTab } from '@/components/tasks-v2/TabNav';
import SummaryView from '@/components/tasks-v2/SummaryView';
import ListView from '@/components/tasks-v2/ListView';
import BoardView from '@/components/tasks-v2/BoardView';

const VALID_TABS: TasksTab[] = ['summary', 'tasks', 'board'];

export default function TasksV2Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams?.get('project_id');
  const tabParam = searchParams?.get('tab') as TasksTab | null;
  const activeProject = useProjectStore((s) => s.activeProject);
  const projectId = projectIdParam
    ? Number(projectIdParam)
    : activeProject?.id ?? null;

  const tab: TasksTab = useMemo(
    () => (tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'tasks'),
    [tabParam]
  );

  const { tasks, loading, error, fetchTasks } = useTaskData();

  useEffect(() => {
    if (projectId) {
      fetchTasks({ project_id: projectId, page: 1 });
    }
  }, [fetchTasks, projectId]);

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
    <DashboardLayout alerts={[]} upcomingMeetings={[]}>
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <header className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
            <p className="mt-1 text-sm text-gray-500">
              {activeProject?.name ?? 'No project selected'}
              {' · '}
              <span className="text-gray-400">
                {tasks.length} item{tasks.length === 1 ? '' : 's'}
              </span>
            </p>
          </div>
        </header>

        <TabNav active={tab} onChange={setTab} trailing={headerActions} />

        {tab === 'summary' && <SummaryView projectId={projectId} />}
        {tab === 'tasks' && <ListView tasks={tasks} loading={loading} error={error} />}
        {tab === 'board' && <BoardView tasks={tasks} loading={loading} error={error} />}
      </div>
      <ChatFAB />
    </DashboardLayout>
  );
}
