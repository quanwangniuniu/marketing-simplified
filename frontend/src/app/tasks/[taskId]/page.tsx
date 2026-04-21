"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import useAuth from "@/hooks/useAuth";
import { useTaskData } from "@/hooks/useTaskData";
import TaskDetail from "@/components/tasks/TaskDetail";
import {
  TaskDetailBodySkeleton,
} from "@/components/tasks/TaskLoadingSkeletons";
import { useMinimumLoading } from "@/hooks/useMinimumLoading";
import { Skeleton } from "@/components/ui/skeleton";

const buildIssueKey = (projectName?: string, taskId?: number) => {
  const prefix = (projectName || "TASK")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase();
  return `${prefix || "TASK"}-${taskId ?? "NEW"}`;
};

export default function TaskPage() {
  const params = useParams();
  const taskId = params?.taskId ? Number(params.taskId) : null;
  const router = useRouter();
  const { user, logout } = useAuth();
  const { currentTask, fetchTask, loading, error } = useTaskData();
  const delayedLoading = useMinimumLoading(loading);
  const taskMatchesRoute = currentTask?.id === taskId;
  const taskPageLoading =
    Boolean(taskId) && (delayedLoading || (!taskMatchesRoute && !error));

  useEffect(() => {
    if (!taskId) return;
    fetchTask(taskId);
  }, [taskId, fetchTask]);

  const layoutUser = user
    ? {
        name: user.username || user.email,
        email: user.email,
        role: user.roles && user.roles.length > 0 ? user.roles[0] : undefined,
      }
    : undefined;

  const breadcrumb = useMemo(() => {
    if (!taskMatchesRoute || !currentTask) return null;
    const projectName = currentTask.project?.name || "Project";
    const projectId = currentTask.project?.id ?? currentTask.project_id;
    const issueKey = buildIssueKey(currentTask.project?.name, currentTask.id);
    return { projectName, projectId, issueKey };
  }, [currentTask, taskMatchesRoute]);

  const handleUserAction = async (action: string) => {
    if (action === "logout") {
      await logout();
    }
  };

  return (
    <ProtectedRoute renderChildrenWhileLoading>
      <Layout
        user={layoutUser}
        onUserAction={handleUserAction}
        mainScrollMode="page"
      >
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-[1680px] px-2 py-8 sm:px-3 lg:px-4">
            <div className="mb-6 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Link href="/tasks" className="hover:text-slate-700">
                  Tasks
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                {breadcrumb?.projectId != null ? (
                  <Link
                    href={`/tasks?project_id=${breadcrumb.projectId}`}
                    className="hover:text-slate-700 hover:underline"
                  >
                    {breadcrumb.projectName}
                  </Link>
                ) : (
                  <span>
                    {taskPageLoading ? (
                      <Skeleton className="h-4 w-24" />
                    ) : (
                      breadcrumb?.projectName || "Project"
                    )}
                  </span>
                )}
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-semibold text-slate-700">
                  {taskPageLoading ? (
                    <Skeleton className="h-4 w-16" />
                  ) : (
                    breadcrumb?.issueKey || "TASK"
                  )}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Link
                    href="/tasks"
                    data-testid="back-to-tasks"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Back to Tasks
                  </Link>
                  {taskPageLoading ? (
                    <Skeleton className="h-4 w-20" />
                  ) : currentTask ? (
                    <span data-testid="task-id-label" className="text-sm text-slate-500">
                      Task #{currentTask.id}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {taskPageLoading ? (
              <div data-testid="task-detail-loading">
                <TaskDetailBodySkeleton />
              </div>
            ) : error ? (
              <div data-testid="task-detail-error" className="rounded-lg border border-slate-200 bg-white p-10 text-center">
                <p className="text-sm text-red-600">
                  {error?.response?.data?.detail ||
                    error?.response?.data?.message ||
                    error?.message ||
                    "Failed to load task."}
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/tasks")}
                  className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Back to Tasks
                </button>
              </div>
            ) : currentTask ? (
              <TaskDetail
                task={currentTask}
                currentUser={user || undefined}
                onTaskUpdate={() => {
                  if (taskId) fetchTask(taskId);
                }}
                onTaskDeleted={() => router.push("/tasks")}
              />
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
                <p className="text-sm text-slate-600">Task not found.</p>
                <button
                  type="button"
                  onClick={() => router.push("/tasks")}
                  className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Back to Tasks
                </button>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
