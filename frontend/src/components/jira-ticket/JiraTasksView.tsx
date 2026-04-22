import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, Plus, Search, Settings2, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/hooks/useAutoResizeTextarea";
import JiraTicketTypeIcon from "./JiraTicketTypeIcon";
import { TaskAPI } from "@/lib/api/taskApi";
import { ProjectAPI } from "@/lib/api/projectApi";
import { useTaskStore } from "@/lib/taskStore";
import { useAuthStore } from "@/lib/authStore";
import toast from "react-hot-toast";
import type { TaskData } from "@/types/task";
import SubtaskModal from "@/components/tasks/SubtaskModal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import BulkActionBar from "@/components/tasks/BulkActionBar";

interface MemberOption {
  id: number;
  username: string;
  email?: string;
}

export type JiraTaskItem = {
  id: number | string;
  summary: string;
  type: string;
  status: string;
  backendStatus?: string;
  owner?: string;
  ownerId?: number;
  approver?: string;
  approverId?: number;
  dueDate?: string;
  dueDateRaw?: string;
  project?: string;
  projectId?: number;
  description?: string;
  issueKey?: string;
  content_type?: string;
  object_id?: string;
  statusRaw?: string;
};

export type JiraTasksViewMode = "list" | "timeline";

interface JiraTasksViewProps {
  tasks: JiraTaskItem[];
  viewMode: JiraTasksViewMode;
  onViewModeChange: (mode: JiraTasksViewMode) => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  rightOfSearch?: React.ReactNode;
  onTaskClick?: (task: JiraTaskItem) => void;
  onTaskUpdate?: () => void;
  renderList?: () => React.ReactNode;
  renderTimeline?: () => React.ReactNode;
}

const ViewButton = ({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-md border px-4 py-1.5 text-sm",
      active
        ? "border-[#3CCED7] bg-[#3CCED7] text-white"
        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
    )}
  >
    {children}
  </button>
);

const JiraTasksToolbar = ({
  viewMode,
  onViewModeChange,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  rightOfSearch,
}: {
  viewMode: JiraTasksViewMode;
  onViewModeChange: (mode: JiraTasksViewMode) => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  rightOfSearch?: React.ReactNode;
}) => (
  <div className="flex flex-wrap items-center gap-3">
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        placeholder={searchPlaceholder || "Search tasks..."}
        value={searchValue ?? ""}
        onChange={(event) => onSearchChange?.(event.target.value)}
        className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </div>
    {rightOfSearch}
    <div className="flex items-center gap-2">
      <ViewButton
        active={viewMode === "list"}
        onClick={() => onViewModeChange("list")}
      >
        <span data-testid="view-button-list">List View</span>
      </ViewButton>
      <ViewButton
        active={viewMode === "timeline"}
        onClick={() => onViewModeChange("timeline")}
      >
        <span data-testid="view-button-timeline">Timeline View</span>
      </ViewButton>
    </div>
  </div>
);

const typeBadgeStyles: Record<string, string> = {
  task: "bg-slate-100 text-slate-700",
  budget: "bg-[#3CCED7]/15 text-[#1a9ba3]",
  asset: "bg-indigo-100 text-indigo-700",
  retrospective: "bg-purple-100 text-purple-700",
  report: "bg-slate-100 text-slate-700",
  scaling: "bg-teal-100 text-teal-700",
  alert: "bg-rose-100 text-rose-700",
  experiment: "bg-amber-100 text-amber-700",
  optimization: "bg-violet-100 text-violet-700",
  communication: "bg-cyan-100 text-cyan-700",
};

const formatTypeLabel = (value?: string) => {
  if (!value) return "Task";
  const normalized = value.toLowerCase();
  const labelMap: Record<string, string> = {
    task: "Task",
    budget: "Budget Request",
    asset: "Asset",
    retrospective: "Retrospective",
    report: "Report",
    scaling: "Scaling",
    alert: "Alert",
    experiment: "Experiment",
    optimization: "Optimization",
    communication: "Communication",
  };
  if (labelMap[normalized]) return labelMap[normalized];
  return normalized
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

const getTypeKey = (value?: string) => {
  if (!value) return "task";
  return value.toLowerCase();
};

const getIssueKey = (task: JiraTaskItem) => {
  if (task.issueKey) return task.issueKey;
  const rawProject = task.project || "TASK";
  const compact = rawProject.replace(/[^a-zA-Z0-9]/g, "");
  const prefix = (compact.slice(0, 4) || "TASK").toUpperCase();
  return `${prefix}-${task.id}`;
};

const getInitials = (name?: string) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const JiraTasksList = ({
  tasks,
  selectedTaskId,
  onSelectTask,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onActivateTask,
}: {
  tasks: JiraTaskItem[];
  selectedTaskId: JiraTaskItem["id"] | null;
  onSelectTask: (taskId: JiraTaskItem["id"]) => void;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onSelectAll?: () => void;
  onActivateTask?: (task: JiraTaskItem) => void;
}) => (
  <div className="rounded-md border border-slate-200 bg-white">
    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
      <div className="flex items-center gap-2">
        {onSelectAll && selectedIds && (
          <input
            type="checkbox"
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            checked={selectedIds.size === tasks.length && tasks.length > 0}
            onChange={onSelectAll}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-semibold text-slate-600"
        >
          Created
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div
      role="listbox"
      aria-label="Task list"
      className="max-h-[70vh] space-y-2 overflow-y-auto p-2"
    >
      {tasks.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          No tasks to show.
        </div>
      ) : (
        tasks.map((task) => {
          const typeKey = getTypeKey(task.type);
          const typeClass = typeBadgeStyles[typeKey] || typeBadgeStyles.task;
          const isSelected = task.id === selectedTaskId;
          const initials = getInitials(task.owner);
          const isDraft = task.backendStatus === "DRAFT";
          return (
            <button
              key={task.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => {
                onSelectTask(task.id);
                onActivateTask?.(task);
              }}
              className={cn(
                "group w-full rounded-md border px-3 py-2 text-left transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7] focus-visible:ring-offset-1",
                isSelected
                  ? "border-[#3CCED7] bg-[#3CCED7]/10 shadow-sm"
                  : "border-transparent hover:border-slate-200 hover:bg-slate-50"
              )}
            >
              <div className="flex items-start gap-2">
                {onToggleSelect && selectedIds && (
                  <div
                    className="mt-0.5 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={selectedIds.has(Number(task.id))}
                      onChange={() => onToggleSelect(Number(task.id))}
                    />
                  </div>
                )}
                <JiraTicketTypeIcon
                  type={task.type}
                  size={18}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-500">
                      {getIssueKey(task)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        typeClass
                      )}
                    >
                      {formatTypeLabel(task.type)}
                    </span>
                    {isDraft ? (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        Draft
                      </span>
                    ) : null}
                    {task.content_type === "decision" && task.object_id ? (
                      <span className="text-slate-400" title="From decision">
                        From{" "}
                        <Link
                          href={`/decisions/${task.object_id}${task.projectId ? `?project_id=${task.projectId}` : ""}`}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Decision #{task.object_id}
                        </Link>
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">
                    {task.summary}
                  </div>
                </div>
                {initials ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                    {initials}
                  </div>
                ) : null}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span className="truncate">{task.project || "No project"}</span>
                <span>{task.dueDate || "No due date"}</span>
              </div>
            </button>
          );
        })
      )}
    </div>
    <div className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500">
      {tasks.length} work items
    </div>
  </div>
);

const JiraTasksTimeline = () => (
  <div className="mt-4 rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-500">
    Timeline view placeholder (hook up existing timeline rendering here).
  </div>
);

const JiraTasksView: React.FC<JiraTasksViewProps> = ({
  tasks,
  viewMode,
  onViewModeChange,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  rightOfSearch,
  onTaskClick,
  onTaskUpdate,
  renderList,
  renderTimeline,
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<
    JiraTaskItem["id"] | null
  >(tasks[0]?.id ?? null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const {
    textareaRef: descriptionTextareaRef,
    resizeTextarea: resizeDescriptionTextarea,
  } = useAutoResizeTextarea(descriptionDraft, {
    enabled: editingDescription,
    minHeight: 96,
  });
  const [savingDescription, setSavingDescription] = useState(false);
  const [descriptionOverrides, setDescriptionOverrides] = useState<
    Record<string | number, string>
  >({});
  const [subtasks, setSubtasks] = useState<TaskData[]>([]);
  const [subtasksLoading, setSubtasksLoading] = useState(false);
  const [subtasksModalOpen, setSubtasksModalOpen] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<number | null>(null);
  const [subtaskSummaryDraft, setSubtaskSummaryDraft] = useState("");
  const [savingSubtaskSummary, setSavingSubtaskSummary] = useState(false);
  const [projectMembers, setProjectMembers] = useState<MemberOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [savingAssignee, setSavingAssignee] = useState(false);
  const [savingApprover, setSavingApprover] = useState(false);
  const [savingDueDate, setSavingDueDate] = useState(false);
  const [dueDateInput, setDueDateInput] = useState("");
  const [watchedTaskIds, setWatchedTaskIds] = useState<Record<string, boolean>>(
    {}
  );
  const [detailsOverrides, setDetailsOverrides] = useState<
    Record<
      string | number,
      {
        ownerId?: number | null;
        owner?: string;
        approverId?: number | null;
        approver?: string;
        dueDate?: string | null;
      }
    >
  >({});
  const assigneeSelectRef = useRef<HTMLSelectElement | null>(null);
  const dueDateFieldRef = useRef<HTMLInputElement | null>(null);
  const activityCardRef = useRef<HTMLDivElement | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<JiraTaskItem | null>(null);
  const router = useRouter();
  const { updateTask: updateTaskStore } = useTaskStore();
  const authUser = useAuthStore((state) => state.user);

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === tasks.length && tasks.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map((t) => Number(t.id))));
    }
  };

  const loadSubtasks = useCallback(async (parentId: number | string) => {
    try {
      setSubtasksLoading(true);
      const data = await TaskAPI.getSubtasks(Number(parentId));
      setSubtasks(data);
    } catch (e) {
      console.error("Failed to load subtasks:", e);
      setSubtasks([]);
    } finally {
      setSubtasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedTaskId) {
      setSubtasks([]);
      return;
    }
    loadSubtasks(selectedTaskId);
  }, [selectedTaskId, loadSubtasks]);

  useEffect(() => {
    if (tasks.length === 0) {
      setSelectedTaskId(null);
      return;
    }

    if (!tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [tasks, selectedTaskId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("mj-task-watchers-local");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      if (parsed && typeof parsed === "object") {
        setWatchedTaskIds(parsed);
      }
    } catch {
      // ignore invalid local watcher cache
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "mj-task-watchers-local",
        JSON.stringify(watchedTaskIds)
      );
    } catch {
      // ignore storage errors
    }
  }, [watchedTaskIds]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return tasks.find((task) => task.id === selectedTaskId) || null;
  }, [selectedTaskId, tasks]);

  const handleActivateTask = useCallback(
    (task: JiraTaskItem) => {
      if (task.backendStatus === "DRAFT" && onTaskClick) {
        onTaskClick(task);
      }
    },
    [onTaskClick]
  );

  useEffect(() => {
    if (!selectedTask) {
      setEditingDescription(false);
      return;
    }
    setEditingDescription(false);
    setDescriptionDraft(
      descriptionOverrides[selectedTask.id] ??
        selectedTask.description ??
        ""
    );
  }, [selectedTask?.id]);

  const handleSaveDescription = async () => {
    if (!selectedTask) return;
    const taskId = Number(selectedTask.id);
    if (Number.isNaN(taskId)) return;
    setSavingDescription(true);
    try {
      await TaskAPI.updateTask(taskId, { description: descriptionDraft });
      setDescriptionOverrides((prev) => ({
        ...prev,
        [selectedTask.id]: descriptionDraft,
      }));
      setEditingDescription(false);
      toast.success("Description updated");
      onTaskUpdate?.();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to update description";
      toast.error(msg);
    } finally {
      setSavingDescription(false);
    }
  };

  const displayDescription =
    selectedTask && (descriptionOverrides[selectedTask.id] ?? selectedTask.description);

  const handleSubtaskAdded = useCallback(() => {
    if (selectedTask?.id) {
      loadSubtasks(selectedTask.id);
      onTaskUpdate?.();
    }
    setSubtasksModalOpen(false);
  }, [selectedTask?.id, loadSubtasks, onTaskUpdate]);

  const handleSaveSubtaskSummary = async () => {
    if (!editingSubtaskId || !subtaskSummaryDraft.trim()) return;
    setSavingSubtaskSummary(true);
    try {
      await TaskAPI.updateTask(editingSubtaskId, {
        summary: subtaskSummaryDraft.trim(),
      });
      setSubtasks((prev) =>
        prev.map((t) =>
          t.id === editingSubtaskId
            ? { ...t, summary: subtaskSummaryDraft.trim() }
            : t
        )
      );
      setEditingSubtaskId(null);
      setSubtaskSummaryDraft("");
      toast.success("Subtask updated");
      onTaskUpdate?.();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to update subtask";
      toast.error(msg);
    } finally {
      setSavingSubtaskSummary(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.projectId) {
      setProjectMembers([]);
      return;
    }
    const fetchMembers = async () => {
      try {
        setLoadingMembers(true);
        const members = await ProjectAPI.getProjectMembers(selectedTask.projectId!);
        const opts: MemberOption[] = (members || []).map((m) => ({
          id: m.user.id,
          username: m.user.username || m.user.email || `User #${m.user.id}`,
          email: m.user.email,
        }));
        setProjectMembers(opts);
      } catch (e) {
        console.error("Failed to fetch project members:", e);
        setProjectMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };
    fetchMembers();
  }, [selectedTask?.projectId]);

  const handleAssigneeChange = async (ownerId: string) => {
    if (!selectedTask) return;
    const taskId = Number(selectedTask.id);
    if (Number.isNaN(taskId)) return;
    setSavingAssignee(true);
    try {
      const response = await TaskAPI.updateTask(taskId, {
        owner_id: ownerId ? Number(ownerId) : null,
      } as any);
      const updated = response.data as TaskData;
      const key = selectedTask.id;
      setDetailsOverrides((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          ownerId: updated.owner?.id ?? null,
          owner: updated.owner?.username ?? undefined,
        },
      }));
      updateTaskStore(taskId, { owner: updated.owner });
      onTaskUpdate?.();
      toast.success("Assignee updated");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to update assignee";
      toast.error(msg);
    } finally {
      setSavingAssignee(false);
    }
  };

  const handleApproverChange = async (approverId: string) => {
    if (!selectedTask) return;
    const taskId = Number(selectedTask.id);
    if (Number.isNaN(taskId)) return;
    setSavingApprover(true);
    try {
      const response = await TaskAPI.updateTask(taskId, {
        current_approver_id: approverId ? Number(approverId) : undefined,
      });
      const updated = response.data as TaskData;
      const key = selectedTask.id;
      setDetailsOverrides((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          approverId: updated.current_approver?.id ?? null,
          approver: updated.current_approver?.username ?? undefined,
        },
      }));
      updateTaskStore(taskId, { current_approver: updated.current_approver });
      onTaskUpdate?.();
      toast.success("Approver updated");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to update approver";
      toast.error(msg);
    } finally {
      setSavingApprover(false);
    }
  };

  const handleDueDateChange = async (dueDate: string) => {
    if (!selectedTask) return;
    const taskId = Number(selectedTask.id);
    if (Number.isNaN(taskId)) return;
    setSavingDueDate(true);
    try {
      const value = dueDate || undefined;
      const response = await TaskAPI.updateTask(taskId, { due_date: value });
      const updated = response.data as TaskData;
      const key = selectedTask.id;
      setDetailsOverrides((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          dueDate: updated.due_date ?? null,
        },
      }));
      updateTaskStore(taskId, { due_date: updated.due_date });
      onTaskUpdate?.();
      toast.success("Due date updated");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to update due date";
      toast.error(msg);
    } finally {
      setSavingDueDate(false);
    }
  };

  const detailsKey = selectedTask?.id;
  const overrides = detailsKey ? detailsOverrides[detailsKey] : undefined;
  const displayOwnerId = overrides?.ownerId ?? selectedTask?.ownerId ?? null;
  const displayApproverId =
    overrides?.approverId ?? selectedTask?.approverId ?? null;
  const displayDueDate = overrides?.dueDate ?? selectedTask?.dueDateRaw ?? "";
  const isWatchingSelectedTask = selectedTask
    ? !!watchedTaskIds[String(selectedTask.id)]
    : false;

  useEffect(() => {
    setDueDateInput(displayDueDate || "");
  }, [displayDueDate, selectedTask?.id]);

  const scrollIntoViewCentered = (
    element: HTMLElement | null | undefined,
    focusable?: { focus: () => void; showPicker?: () => void }
  ) => {
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    if (focusable) {
      window.requestAnimationFrame(() => {
        focusable.focus();
      });
    }
  };

  const handleQuickAssignToMe = async () => {
    if (!selectedTask) return;

    scrollIntoViewCentered(assigneeSelectRef.current, assigneeSelectRef.current ?? undefined);

    const currentUserId = authUser?.id != null ? String(authUser.id) : null;
    const currentUsername = (authUser as any)?.username?.toString?.() ?? "";
    const currentEmail = (authUser as any)?.email?.toString?.() ?? "";

    const me =
      projectMembers.find((m) => String(m.id) === currentUserId) ||
      projectMembers.find(
        (m) =>
          (currentUsername && m.username === currentUsername) ||
          (currentEmail && m.email === currentEmail)
      );

    if (!me) {
      toast("Current user is not available in project members. Select assignee manually.");
      return;
    }

    if (String(displayOwnerId ?? "") === String(me.id)) {
      toast("Already assigned to you.");
      return;
    }

    await handleAssigneeChange(String(me.id));
  };

  const handleQuickToggleWatcher = () => {
    if (!selectedTask) return;
    const key = String(selectedTask.id);
    setWatchedTaskIds((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
    scrollIntoViewCentered(activityCardRef.current);
    toast.success(isWatchingSelectedTask ? "Watcher removed" : "Watcher added");
  };

  const handleQuickSetDueDate = () => {
    const input = dueDateFieldRef.current;
    if (!input) return;
    scrollIntoViewCentered(input, input);
    if (typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === "function") {
      try {
        (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      } catch {
        // ignore if browser blocks programmatic picker
      }
    }
  };

  return (
    <>
    <div className="space-y-4">
      <JiraTasksToolbar
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        searchPlaceholder={searchPlaceholder}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        rightOfSearch={rightOfSearch}
      />
      {viewMode === "list" &&
        (renderList ? (
          renderList()
        ) : (
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <JiraTasksList
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onActivateTask={handleActivateTask}
            />
            {selectedTask ? (
              <div data-testid="task-detail-panel" className="rounded-md border border-slate-200 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <JiraTicketTypeIcon type={selectedTask.type} size={18} />
                      <span className="text-[11px] font-semibold text-slate-500">
                        {getIssueKey(selectedTask)}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          typeBadgeStyles[getTypeKey(selectedTask.type)] ||
                            typeBadgeStyles.task
                        )}
                      >
                        {formatTypeLabel(selectedTask.type)}
                      </span>
                      {selectedTask.backendStatus === "DRAFT" ? (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          Draft
                        </span>
                      ) : null}
                      {selectedTask.content_type === "decision" && selectedTask.object_id ? (
                        <span className="text-slate-400 text-[11px]">
                          From{" "}
                          <Link
                            href={`/decisions/${selectedTask.object_id}${selectedTask.projectId ? `?project_id=${selectedTask.projectId}` : ""}`}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            Decision #{selectedTask.object_id}
                          </Link>
                        </span>
                      ) : null}
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {selectedTask.summary}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {onTaskClick ? (
                      <button
                        type="button"
                        data-testid="task-open-button"
                        onClick={() => onTaskClick(selectedTask)}
                        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </button>
                    ) : null}
                    {selectedTask.id ? (
                      <button
                        type="button"
                        onClick={() => setTaskToDelete(selectedTask)}
                        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-4 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-4">
                    <div
                      ref={activityCardRef}
                      className="rounded-md border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Description
                      </div>
                      {!editingDescription ? (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setDescriptionDraft(
                              descriptionOverrides[selectedTask.id] ??
                                selectedTask.description ??
                                ""
                            );
                            setEditingDescription(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setDescriptionDraft(
                                descriptionOverrides[selectedTask.id] ??
                                  selectedTask.description ??
                                  ""
                              );
                              setEditingDescription(true);
                            }
                          }}
                          className="mt-2 cursor-text rounded px-1 -mx-1 py-1 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                          <p className="whitespace-pre-wrap break-words text-sm text-slate-600">
                            {displayDescription ||
                              "Click to add description"}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          <textarea
                            ref={descriptionTextareaRef}
                            autoFocus
                            value={descriptionDraft}
                            onChange={(e) => {
                              setDescriptionDraft(e.target.value);
                              resizeDescriptionTextarea();
                            }}
                            onInput={resizeDescriptionTextarea}
                            placeholder="Enter task description..."
                            className="w-full min-h-[80px] resize-none overflow-hidden rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            rows={4}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleSaveDescription}
                              disabled={savingDescription}
                              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {savingDescription ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDescription(false);
                                setDescriptionDraft(
                                  descriptionOverrides[selectedTask.id] ??
                                    selectedTask.description ??
                                    ""
                                );
                              }}
                              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Subtasks
                        </div>
                        {selectedTask.projectId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSubtasksModalOpen(true);
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                            aria-label="Add subtask"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {subtasksLoading ? (
                        <p className="mt-2 text-sm text-slate-500">
                          Loading subtasks...
                        </p>
                      ) : subtasks.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">
                          No subtasks yet. Click + to add one.
                        </p>
                      ) : (
                        <div className="mt-2 divide-y divide-slate-200">
                          {subtasks.map((subtask) => (
                            <div
                              key={subtask.id}
                              className="flex items-center gap-2 py-2 first:pt-0"
                            >
                              <Square
                                className="h-4 w-4 flex-shrink-0 text-slate-400"
                                aria-hidden
                              />
                              {editingSubtaskId === subtask.id ? (
                                <div className="flex flex-1 items-center gap-2">
                                  <input
                                    type="text"
                                    value={subtaskSummaryDraft}
                                    onChange={(e) =>
                                      setSubtaskSummaryDraft(e.target.value)
                                    }
                                    onBlur={handleSaveSubtaskSummary}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleSaveSubtaskSummary();
                                      } else if (e.key === "Escape") {
                                        setEditingSubtaskId(null);
                                        setSubtaskSummaryDraft("");
                                      }
                                    }}
                                    autoFocus
                                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200"
                                  />
                                  <button
                                    type="button"
                                    onClick={handleSaveSubtaskSummary}
                                    disabled={savingSubtaskSummary}
                                    className="text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                                  >
                                    {savingSubtaskSummary ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSubtaskId(null);
                                      setSubtaskSummaryDraft("");
                                    }}
                                    className="text-xs text-slate-500 hover:text-slate-700"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingSubtaskId(subtask.id!);
                                    setSubtaskSummaryDraft(
                                      subtask.summary || ""
                                    );
                                  }}
                                  className="flex-1 text-left text-sm text-slate-700 hover:text-indigo-600 hover:underline"
                                >
                                  {subtask.summary || `Task #${subtask.id}`}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (subtask.id)
                                    router.push(`/tasks/${subtask.id}`);
                                }}
                                className="text-xs text-slate-500 hover:text-indigo-600"
                              >
                                Open
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedTask.projectId && (
                        <SubtaskModal
                          isOpen={subtasksModalOpen}
                          onClose={() => setSubtasksModalOpen(false)}
                          onSubtaskAdded={handleSubtaskAdded}
                          parentTaskId={Number(selectedTask.id)}
                          parentTaskProjectId={selectedTask.projectId}
                          parentTaskIsSubtask={false}
                        />
                      )}
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Activity
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        Recent updates and comments will appear here.
                      </p>
                    </div>
                  </div>
                  <aside className="min-w-0 space-y-4">
                    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                        Details
                        <Settings2 className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="mt-3 space-y-3 text-sm">
                        <div className="grid min-w-0 grid-cols-[110px_minmax(0,1fr)] gap-3 items-center">
                          <span className="text-slate-500">Assignee</span>
                          <select
                            ref={assigneeSelectRef}
                            value={displayOwnerId ?? ""}
                            onChange={(e) =>
                              handleAssigneeChange(e.target.value)
                            }
                            disabled={savingAssignee || loadingMembers}
                            className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 disabled:opacity-50"
                          >
                            <option value="">Unassigned</option>
                            {projectMembers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.username}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid min-w-0 grid-cols-[110px_minmax(0,1fr)] gap-3 items-center">
                          <span className="text-slate-500">Approver</span>
                          <select
                            value={displayApproverId ?? ""}
                            onChange={(e) =>
                              handleApproverChange(e.target.value)
                            }
                            disabled={savingApprover || loadingMembers}
                            className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 disabled:opacity-50"
                          >
                            <option value="">Unassigned</option>
                            {projectMembers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.username}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid min-w-0 grid-cols-[110px_minmax(0,1fr)] gap-3 items-center">
                          <span className="text-slate-500">Work type</span>
                          <span className="min-w-0 truncate text-slate-800">
                            {formatTypeLabel(selectedTask.type)}
                          </span>
                        </div>
                        <div className="grid min-w-0 grid-cols-[110px_minmax(0,1fr)] gap-3 items-center">
                          <span className="text-slate-500">Due date</span>
                          <input
                            ref={dueDateFieldRef}
                            type="date"
                            value={dueDateInput || ""}
                            onChange={(e) => setDueDateInput(e.target.value)}
                            onBlur={(e) => {
                              const v = e.target.value;
                              const current =
                                overrides?.dueDate ?? selectedTask?.dueDateRaw ?? "";
                              if (v !== current) {
                                handleDueDateChange(v);
                              }
                            }}
                            disabled={savingDueDate}
                            className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 disabled:opacity-50"
                          />
                        </div>
                        <div className="grid min-w-0 grid-cols-[110px_minmax(0,1fr)] gap-3 items-center">
                          <span className="text-slate-500">Project</span>
                          <span className="min-w-0 break-words text-slate-800">
                            {selectedTask.project || "None"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Quick actions
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleQuickAssignToMe}
                          disabled={savingAssignee || loadingMembers}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Assign to me
                        </button>
                        <button
                          type="button"
                          onClick={handleQuickToggleWatcher}
                          className={cn(
                            "rounded-full border bg-white px-3 py-1 text-xs hover:bg-slate-50",
                            isWatchingSelectedTask
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 text-slate-600"
                          )}
                        >
                          {isWatchingSelectedTask ? "Watching" : "Add watcher"}
                        </button>
                        <button
                          type="button"
                          onClick={handleQuickSetDueDate}
                          disabled={savingDueDate}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Set due date
                        </button>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[320px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-white text-sm text-slate-500">
                Select a task to preview its details.
              </div>
            )}
          </div>
        ))}
      {viewMode === "timeline" &&
        (renderTimeline ? renderTimeline() : <JiraTasksTimeline />)}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedIds={Array.from(selectedIds)}
          selectedTasks={tasks
            .filter((t) => selectedIds.has(Number(t.id)))
            .map((t) => ({
              id: Number(t.id),
              status: t.statusRaw ?? t.status,
            }))}
          projectId={tasks[0]?.projectId}
          onSuccess={() => {
            setSelectedIds(new Set());
            onTaskUpdate?.();
          }}
        />
      )}
    </div>
    <ConfirmDialog
      isOpen={!!taskToDelete}
      title="Delete task"
      message={
        taskToDelete
          ? `Delete task #${taskToDelete.id} "${taskToDelete.summary}"?`
          : ""
      }
      type="danger"
      confirmText="Delete"
      onConfirm={async () => {
        if (!taskToDelete) return;
        try {
          await TaskAPI.deleteTask(Number(taskToDelete.id));
          toast.success("Task deleted");
          onTaskUpdate?.();
        } catch (err: unknown) {
          const msg =
            err && typeof err === "object" && "message" in err
              ? String((err as { message: string }).message)
              : "Failed to delete task";
          toast.error(msg);
        }
        setTaskToDelete(null);
      }}
      onCancel={() => setTaskToDelete(null)}
    />
  </>
  );
};

export default JiraTasksView;
