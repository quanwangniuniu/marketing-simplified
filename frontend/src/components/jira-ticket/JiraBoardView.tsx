import React, { useEffect, useMemo, useRef, useState } from "react";
import { Filter, Plus, Search } from "lucide-react";
import {
  JiraBoardCard,
  JiraBoardColumn,
  JiraBoardColumns,
} from "@/components/jira-ticket/JiraBoard";

type BoardColumn = {
  key: string;
  title: string;
  empty: string;
};

type TaskLike = {
  id?: number;
  summary?: string;
  description?: string;
  type?: string;
  status?: string;
  due_date?: string;
  owner?: { username?: string; email?: string } | string | null;
  is_subtask?: boolean;
  parent_relationship?: Array<{ parent_task_id?: number }>;
  current_approver?: {
    username?: string;
    email?: string;
  } | null;
};

type BoardHeaderUser = {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string | null;
};

interface JiraBoardViewProps {
  boardColumns: BoardColumn[];
  tasksByType: Record<string, TaskLike[]>;
  /** Open create modal; from a column pass work type key and optional summary prefill. */
  onCreateTask: (workTypeKey?: string, summaryPrefill?: string) => void;
  onTaskClick: (task: TaskLike) => void;
  getTicketKey: (task: TaskLike) => string;
  getBoardTypeIcon: (type?: string) => string;
  formatBoardDate: (dateString?: string) => string;
  getDueTone: (dateString?: string) => "default" | "warning" | "danger";
  editingTaskId: number | null;
  editingSummary: string;
  setEditingSummary: (value: string) => void;
  startBoardEdit: (task: TaskLike) => void;
  cancelBoardEdit: () => void;
  saveBoardEdit: (task: TaskLike) => void;
  currentUser?: BoardHeaderUser;
  hideInternalFilters?: boolean;
  externalFilters?: React.ReactNode;
}

type BoardFilters = {
  assignee: string;
  workType: string;
};

const DEFAULT_BOARD_FILTERS: BoardFilters = {
  assignee: "all",
  workType: "all",
};

const getUserInitials = (user?: BoardHeaderUser) => {
  if (!user) return "U";

  const first = (user.first_name || "").trim();
  const last = (user.last_name || "").trim();
  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "U";
  }

  const fallback = (user.username || user.email || "").trim();
  if (!fallback) return "U";

  return fallback
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
};

const getTaskAssignee = (task: TaskLike) => {
  return (
    task.current_approver?.username ||
    task.current_approver?.email ||
    "Unassigned"
  );
};

const getTaskWorkType = (task: TaskLike) => task.type || "other";

const getTaskOwnerText = (task: TaskLike) => {
  if (!task.owner) return "";
  if (typeof task.owner === "string") return task.owner;
  return task.owner.username || task.owner.email || "";
};

const getSelectOptions = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );

const BoardFilterPanel = ({
  filters,
  assigneeOptions,
  workTypeOptions,
  activeFilterCount,
  onFilterChange,
  onReset,
}: {
  filters: BoardFilters;
  assigneeOptions: string[];
  workTypeOptions: string[];
  activeFilterCount: number;
  onFilterChange: (patch: Partial<BoardFilters>) => void;
  onReset: () => void;
}) => (
  <div className="w-[360px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
    <div className="grid grid-cols-1 gap-3 p-4">
      <div className="space-y-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Assignee
        </label>
        <select
          value={filters.assignee}
          onChange={(event) => onFilterChange({ assignee: event.target.value })}
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">All assignees</option>
          {assigneeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Work type
        </label>
        <select
          value={filters.workType}
          onChange={(event) => onFilterChange({ workType: event.target.value })}
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">All work types</option>
          {workTypeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
      <span>
        {activeFilterCount > 0
          ? `${activeFilterCount} active filter${
              activeFilterCount === 1 ? "" : "s"
            }`
          : "No active filters"}
      </span>
      <button
        type="button"
        onClick={onReset}
        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        Reset
      </button>
    </div>
  </div>
);

const FilterPopover = ({
  trigger,
  children,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <span onClick={() => setOpen((prev) => !prev)}>{trigger}</span>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2">
          {children}
        </div>
      ) : null}
    </div>
  );
};

const JiraBoardView: React.FC<JiraBoardViewProps> = ({
  boardColumns,
  tasksByType,
  onCreateTask,
  onTaskClick,
  getTicketKey,
  getBoardTypeIcon,
  formatBoardDate,
  getDueTone,
  editingTaskId,
  editingSummary,
  setEditingSummary,
  startBoardEdit,
  cancelBoardEdit,
  saveBoardEdit,
  currentUser,
  hideInternalFilters = false,
  externalFilters,
}) => {
  const [boardSearchQuery, setBoardSearchQuery] = useState("");
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_BOARD_FILTERS);
  const allBoardTasks = useMemo(
    () =>
      boardColumns.flatMap((column) => {
        return tasksByType[column.key] || [];
      }),
    [boardColumns, tasksByType]
  );

  const assigneeOptions = useMemo(
    () => getSelectOptions(allBoardTasks.map((task) => getTaskAssignee(task))),
    [allBoardTasks]
  );
  const workTypeOptions = useMemo(
    () => getSelectOptions(allBoardTasks.map((task) => getTaskWorkType(task))),
    [allBoardTasks]
  );
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => value !== "all").length,
    [filters]
  );

  useEffect(() => {
    setFilters((prev) => ({
      assignee:
        prev.assignee === "all" || assigneeOptions.includes(prev.assignee)
          ? prev.assignee
          : "all",
      workType:
        prev.workType === "all" || workTypeOptions.includes(prev.workType)
          ? prev.workType
          : "all",
    }));
  }, [assigneeOptions, workTypeOptions]);

  const filteredTasksByType = useMemo(() => {
    const query = boardSearchQuery.trim().toLowerCase();

    const matches = (task: TaskLike) => {
      if (filters.assignee !== "all" && getTaskAssignee(task) !== filters.assignee) {
        return false;
      }
      if (filters.workType !== "all" && getTaskWorkType(task) !== filters.workType) {
        return false;
      }

      if (!query) return true;

      const searchable = [
        task.id ? String(task.id) : "",
        task.summary || "",
        task.description || "",
        task.type || "",
        task.status || "",
        getTaskAssignee(task),
        getTaskOwnerText(task),
        getTicketKey(task),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    };

    return boardColumns.reduce<Record<string, TaskLike[]>>((acc, column) => {
      const list = tasksByType[column.key] || [];
      acc[column.key] = list.filter(matches);
      return acc;
    }, {});
  }, [boardColumns, boardSearchQuery, filters, getTicketKey, tasksByType]);

  const orderedColumns = useMemo(() => {
    return boardColumns
      .map((column, index) => ({
        column,
        index,
        count: (filteredTasksByType[column.key] || []).length,
      }))
      .sort((a, b) => {
        const aHas = a.count > 0;
        const bHas = b.count > 0;
        if (aHas !== bHas) return aHas ? -1 : 1;
        return a.index - b.index;
      })
      .map((entry) => entry.column);
  }, [boardColumns, filteredTasksByType]);

  return (
    <div className="mt-4 min-w-0 space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-[280px] md:w-[340px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search board"
            value={boardSearchQuery}
            onChange={(event) => setBoardSearchQuery(event.target.value)}
            aria-label="Search board"
            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          </div>
          <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.username || currentUser.email || "Current user"}
                className="h-full w-full object-cover"
              />
            ) : (
              getUserInitials(currentUser)
            )}
          </div>
          {externalFilters ? (
            externalFilters
          ) : (
            !hideInternalFilters && (
              <FilterPopover
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Filter className="h-4 w-4 text-slate-500" />
                    Filter
                    {activeFilterCount > 0 ? (
                      <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#3CCED7] px-1.5 text-[10px] font-semibold text-white">
                        {activeFilterCount}
                      </span>
                    ) : null}
                  </button>
                }
              >
                <BoardFilterPanel
                  filters={filters}
                  assigneeOptions={assigneeOptions}
                  workTypeOptions={workTypeOptions}
                  activeFilterCount={activeFilterCount}
                  onFilterChange={(patch) =>
                    setFilters((prev) => ({ ...prev, ...patch }))
                  }
                  onReset={() => setFilters(DEFAULT_BOARD_FILTERS)}
                />
              </FilterPopover>
            )
          )}
        </div>
        </div>
        <button
          type="button"
          onClick={() => onCreateTask()}
          className="inline-flex items-center gap-2 rounded-md bg-[#3CCED7] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2AB5BD]"
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
      </div>
      <div className="relative min-w-0 max-w-full overflow-x-hidden">
        <JiraBoardColumns>
          {orderedColumns.map((column) => {
            const columnTasks = filteredTasksByType[column.key] || [];
            return (
              <JiraBoardColumn
                key={column.key}
                title={column.title}
                count={columnTasks.length}
                footer={
                  <button
                    type="button"
                    onClick={() =>
                      onCreateTask(column.key, `${column.title}`)
                    }
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
                  >
                    <span className="text-base">+</span>
                    Create
                  </button>
                }
              >
                {columnTasks.length === 0 ? (
                  <p className="text-xs text-slate-400">{column.empty}</p>
                ) : (
                  columnTasks.map((task) => (
                    <JiraBoardCard
                      key={task.id}
                      summary={
                        editingTaskId === task.id ? (
                          <input
                            value={editingSummary}
                            onChange={(event) =>
                              setEditingSummary(event.target.value)
                            }
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                saveBoardEdit(task);
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelBoardEdit();
                              }
                            }}
                            onBlur={() => saveBoardEdit(task)}
                            className="w-full max-w-full rounded border border-slate-300 px-2 py-1 text-[13px] text-slate-900 focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-blue-100"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              startBoardEdit(task);
                            }}
                            className="w-full min-w-0 max-w-full overflow-hidden text-left text-[13px] font-medium leading-5 text-slate-900 hover:text-slate-900"
                            title={task.summary || "Untitled task"}
                          >
                            {/* Line-clamp on inner span: Safari often ignores -webkit-line-clamp on <button>. */}
                            <span className="line-clamp-2 block min-w-0 break-words">
                              {task.summary || "Untitled task"}
                            </span>
                          </button>
                        )
                      }
                      ticketKey={getTicketKey(task)}
                      type={getBoardTypeIcon(task.type)}
                      dueDate={formatBoardDate(task.due_date)}
                      dueTone={getDueTone(task.due_date)}
                      assignee={
                        task?.current_approver
                          ? {
                              name:
                                task.current_approver.username ||
                                task.current_approver.email ||
                                "User",
                              initials: (
                                task.current_approver.username ||
                                task.current_approver.email ||
                                "?"
                              )
                                .slice(0, 2)
                                .toUpperCase(),
                            }
                          : null
                      }
                      onClick={() => onTaskClick(task)}
                    />
                  ))
                )}
              </JiraBoardColumn>
            );
          })}
        </JiraBoardColumns>
      </div>
    </div>
  );
};

export default JiraBoardView;
