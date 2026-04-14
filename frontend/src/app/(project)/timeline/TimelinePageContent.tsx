"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Layout from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useTaskData } from "@/hooks/useTaskData";
import TimelineView from "@/components/tasks/timeline/TimelineView";
import Modal from "@/components/ui/Modal";
import { TaskAPI } from "@/lib/api/taskApi";
import { ProjectAPI } from "@/lib/api/projectApi";
import { useProjectStore } from "@/lib/projectStore";
import { useTaskFilterParams } from "@/hooks/useTaskFilterParams";
import { TaskFilterPanel } from "@/components/tasks/TaskFilterPanel";
import { TimelineTaskCreateFlow } from "@/components/tasks/TimelineTaskCreateFlow";

export function TimelinePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectIdParam = searchParams.get("project_id");
  const originMeetingIdParam = searchParams.get("origin_meeting_id");
  const { activeProject } = useProjectStore();
  const projectId = projectIdParam
    ? Number(projectIdParam)
    : activeProject?.id ?? null;

  const originMeetingIdNum = useMemo(() => {
    if (!originMeetingIdParam) return null;
    const n = Number(originMeetingIdParam);
    return Number.isFinite(n) && n >= 1 ? n : null;
  }, [originMeetingIdParam]);

  const [filters, setFilters, clearFilters] = useTaskFilterParams();
  const [taskTypeOptions, setTaskTypeOptions] = useState<
    { value: string; label: string }[]
  >([]);

  useEffect(() => {
    const loadTypes = async () => {
      try {
        const types = await TaskAPI.getTaskTypes();
        setTaskTypeOptions(Array.isArray(types) ? types : []);
      } catch {
        setTaskTypeOptions([]);
      }
    };
    loadTypes();
  }, []);

  useEffect(() => {
    if (projectIdParam || !activeProject?.id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("project_id", String(activeProject.id));
    router.replace(`/timeline?${params.toString()}`);
  }, [projectIdParam, activeProject?.id, router, searchParams]);

  const {
    tasks,
    loading,
    error,
    fetchTasks,
    reloadTasks,
    createTask,
    updateTask,
  } = useTaskData();

  const [projectOptions, setProjectOptions] = useState<any[]>([]);
  const [projectOptionsLoading, setProjectOptionsLoading] = useState(false);
  const [projectOptionsError, setProjectOptionsError] = useState<string | null>(
    null,
  );
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [recentProjectIds, setRecentProjectIds] = useState<number[]>([]);

  const loadProjectOptions = useCallback(async () => {
    try {
      setProjectOptionsLoading(true);
      setProjectOptionsError(null);
      const projects = await ProjectAPI.getProjects();
      setProjectOptions(projects || []);
    } catch (error) {
      console.error("Failed to load projects:", error);
      setProjectOptionsError("Failed to load projects.");
    } finally {
      setProjectOptionsLoading(false);
    }
  }, []);

  const openProjectPicker = useCallback(async () => {
    setProjectPickerOpen(true);
    setProjectSearchQuery("");
    if (projectOptions.length === 0) {
      await loadProjectOptions();
    }
  }, [loadProjectOptions, projectOptions.length]);

  useEffect(() => {
    if (projectOptions.length === 0 && !projectOptionsLoading) {
      loadProjectOptions();
    }
  }, [projectOptions.length, projectOptionsLoading, loadProjectOptions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("recentProjectIds");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setRecentProjectIds(parsed.filter((id) => Number.isFinite(id)));
      }
    } catch (error) {
      console.warn("Failed to parse recent projects:", error);
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      await fetchTasks({
        ...filters,
        project_id: projectId,
        include_subtasks: true,
      });
    };
    load();
  }, [projectId, fetchTasks, filters]);

  const visibleTasks = useMemo(() => {
    if (!projectId) return [];
    if (!Array.isArray(tasks)) return [];
    return tasks;
  }, [projectId, tasks]);

  const hasTasks = visibleTasks.length > 0;

  const handlePickProject = (selectedProjectId: number | null) => {
    if (!selectedProjectId) return;
    setRecentProjectIds((prev) => {
      const next = [
        selectedProjectId,
        ...prev.filter((id) => id !== selectedProjectId),
      ].slice(0, 5);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("recentProjectIds", JSON.stringify(next));
      }
      return next;
    });
    const params = new URLSearchParams(searchParams.toString());
    params.set("project_id", String(selectedProjectId));
    router.push(`/timeline?${params.toString()}`);
  };

  const filteredProjects = useMemo(() => {
    if (!projectSearchQuery.trim()) return projectOptions;
    const query = projectSearchQuery.trim().toLowerCase();
    return projectOptions.filter((project) => {
      const name = (project.name || "").toLowerCase();
      const idText = project.id ? String(project.id) : "";
      return name.includes(query) || idText.includes(query);
    });
  }, [projectOptions, projectSearchQuery]);

  const recentProjects = useMemo(() => {
    if (!recentProjectIds.length) return [];
    const byId = new Map(
      filteredProjects
        .filter((project) => project?.id)
        .map((project) => [project.id, project]),
    );
    return recentProjectIds.map((id) => byId.get(id)).filter(Boolean);
  }, [filteredProjects, recentProjectIds]);

  const otherProjects = useMemo(() => {
    const recentSet = new Set(recentProjectIds);
    return filteredProjects.filter((project) => !recentSet.has(project?.id));
  }, [filteredProjects, recentProjectIds]);

  return (
    <TimelineTaskCreateFlow
      projectId={projectId}
      originMeetingId={originMeetingIdNum}
      createTask={createTask}
      reloadTasks={reloadTasks}
      updateTask={updateTask}
    >
      {({ openCreateTask }) => (
        <>
          <div className="px-6 py-6">
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-4">
                <h1 className="text-2xl font-semibold text-gray-900">
                  Timeline
                </h1>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      projectId ? `/tasks?project_id=${projectId}` : "/tasks",
                    )
                  }
                  className="rounded px-3 py-1.5 text-sm font-medium text-indigo-600 ring-1 ring-indigo-200 transition-colors hover:bg-indigo-50"
                >
                  Return to Tasks
                </button>
              </div>
              <p className="text-sm text-gray-500">
                Long stories grouped by project.
              </p>
            </div>

            <div className="mb-6 rounded-xl border border-gray-200 bg-gradient-to-r from-white via-white to-indigo-50/60 p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {projectId
                      ? "Project selected"
                      : "You haven't selected a project yet."}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {projectId
                      ? "Switch projects to see a different timeline."
                      : "Choose a project to view its timeline."}
                  </p>
                </div>
                <div className="w-full sm:max-w-xs">
                  <label
                    htmlFor="timeline-project-selector"
                    className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    Select project
                  </label>
                  <button
                    type="button"
                    onClick={openProjectPicker}
                    id="timeline-project-selector"
                    className={`flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition ${
                      projectId
                        ? "border-indigo-400 ring-2 ring-indigo-100"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <span className="truncate">
                      {projectId
                        ? `#${projectId} ${
                            projectOptions.find(
                              (project) => project.id === projectId,
                            )?.name || "Unknown"
                          }`
                        : "Select project"}
                    </span>
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {projectOptionsError && (
                    <p className="mt-2 text-sm text-red-600">
                      {projectOptionsError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {projectId && (
              <div className="space-y-4">
                <TaskFilterPanel
                  filters={filters}
                  onChange={setFilters}
                  onClearAll={clearFilters}
                  projectOptions={projectOptions}
                  typeOptions={taskTypeOptions}
                />
                {loading ? (
                  <div className="py-8 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
                    <p className="mt-2 text-gray-600">Loading tasks...</p>
                  </div>
                ) : error && !hasTasks ? (
                  <div className="py-8 text-center">
                    <p className="text-red-600">Error loading tasks.</p>
                  </div>
                ) : (
                  <TimelineView
                    tasks={visibleTasks}
                    reloadTasks={reloadTasks}
                    onCreateTask={openCreateTask}
                  />
                )}
              </div>
            )}
          </div>

          <Modal
            isOpen={projectPickerOpen}
            onClose={() => setProjectPickerOpen(false)}
          >
            <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
              <div className="relative border-b border-slate-100 px-6 py-5">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-white to-sky-50" />
                <div className="absolute -left-10 -top-14 h-32 w-32 rounded-full bg-indigo-100/70 blur-2xl" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-white text-indigo-600 shadow-sm">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h7"
                        />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Select project
                      </h2>
                      <p className="text-sm text-gray-500">
                        Choose a project to load its timeline.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProjectPickerOpen(false)}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="border-b border-slate-100 px-6 py-4">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-300">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={projectSearchQuery}
                    onChange={(event) =>
                      setProjectSearchQuery(event.target.value)
                    }
                    placeholder="Search by project name or ID..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                {projectOptionsLoading && (
                  <div className="py-8 text-center text-sm text-gray-500">
                    Loading projects...
                  </div>
                )}
                {!projectOptionsLoading && projectOptionsError && (
                  <div className="py-8 text-center text-sm text-red-600">
                    {projectOptionsError}
                  </div>
                )}
                {!projectOptionsLoading &&
                  !projectOptionsError &&
                  filteredProjects.length === 0 && (
                    <div className="py-8 text-center text-sm text-gray-500">
                      No projects found.
                    </div>
                  )}
                {!projectOptionsLoading &&
                  !projectOptionsError &&
                  recentProjects.length > 0 && (
                    <div className="mb-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Recent
                      </div>
                      {recentProjects.map((project) => (
                        <button
                          key={`recent-${project.id}`}
                          type="button"
                          onClick={() => {
                            handlePickProject(project.id);
                            setProjectPickerOpen(false);
                          }}
                          className={`group mb-3 w-full rounded-2xl border px-4 py-3 text-left transition ${
                            project.id === projectId
                              ? "border-indigo-200 bg-gradient-to-r from-indigo-50 to-white"
                              : "border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-gray-900">
                              #{project.id} {project.name || "Untitled Project"}
                            </div>
                            {project.id === projectId && (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {project.description || "No description"}
                          </div>
                          <div className="mt-3 h-[1px] w-full bg-gradient-to-r from-transparent via-indigo-100 to-transparent opacity-0 transition group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  )}
                {!projectOptionsLoading &&
                  !projectOptionsError &&
                  otherProjects.length > 0 && (
                    <div>
                      {recentProjects.length > 0 && (
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          All projects
                        </div>
                      )}
                      {otherProjects.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => {
                            handlePickProject(project.id);
                            setProjectPickerOpen(false);
                          }}
                          className={`group mb-3 w-full rounded-2xl border px-4 py-3 text-left transition ${
                            project.id === projectId
                              ? "border-indigo-200 bg-gradient-to-r from-indigo-50 to-white"
                              : "border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-gray-900">
                              #{project.id} {project.name || "Untitled Project"}
                            </div>
                            {project.id === projectId && (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {project.description || "No description"}
                          </div>
                          <div className="mt-3 h-[1px] w-full bg-gradient-to-r from-transparent via-indigo-100 to-transparent opacity-0 transition group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          </Modal>
        </>
      )}
    </TimelineTaskCreateFlow>
  );
}
