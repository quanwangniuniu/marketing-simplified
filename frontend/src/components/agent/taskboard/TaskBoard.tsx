"use client"

import { useCallback, useEffect, useState } from "react"
import { FilterBar } from "./FilterBar"
import { KanbanColumn, type ColumnStatus } from "./KanbanColumn"
import type { Task, TaskType, TaskPriority } from "./TaskCard"
import { TaskAPI } from "@/lib/api/taskApi"
// import { useBatchManage } from "@/hooks/useBatchManage"
// import ConfirmDialog from "@/components/common/ConfirmDialog"
import { TaskDetailModal } from "./TaskDetailModal"
import { NewTaskModal } from "./NewTaskModal"
// import toast from "react-hot-toast"
import { useTaskFilterParams } from "@/hooks/useTaskFilterParams"
import { TaskFilterPanel } from "@/components/tasks/TaskFilterPanel"
import { AgentTaskBoardSkeleton } from "@/components/agent/skeletons/AgentSkeletons"

const columns: ColumnStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED"]

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-"
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return dateStr
  }
}

export function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [ownerFilter, setOwnerFilter] = useState("all")
  // const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)

  const [filters, setFilters, clearFilters] = useTaskFilterParams()

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const response = await TaskAPI.getTasks(filters)
      const results = response.data.results || response.data || []
      const mapped: Task[] = results.map((t: Record<string, unknown>) => {
        const ownerObj = t.owner as Record<string, string> | null
        const ownerName = ownerObj
          ? `${ownerObj.first_name || ""} ${ownerObj.last_name || ""}`.trim() || ownerObj.email || "Unknown"
          : "Unassigned"
        return {
          id: String(t.id),
          summary: (t.summary as string) || "Untitled",
          type: (t.type as TaskType) || "execution",
          priority: (t.priority as TaskPriority) || "MEDIUM",
          status: (t.status as string) || "DRAFT",
          dueDate: formatDate(t.due_date as string | null),
          owner: {
            name: ownerName,
            initials: getInitials(ownerName),
          },
        }
      })
      setTasks(mapped)
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const handler = () => { reload() }
    window.addEventListener("agent:tasks-changed", handler)
    return () => window.removeEventListener("agent:tasks-changed", handler)
  }, [reload])

  // const batchDeleteFn = useCallback(async (id: string | number) => {
  //   await TaskAPI.deleteTask(Number(id))
  // }, [])
  //
  // const batchDeleteComplete = useCallback((deletedIds: (string | number)[]) => {
  //   const idSet = new Set(deletedIds.map(String))
  //   setTasks((prev) => prev.filter((t) => !idSet.has(t.id)))
  //   toast.success(`Deleted ${deletedIds.length} task${deletedIds.length > 1 ? "s" : ""}`)
  // }, [])
  //
  // const batch = useBatchManage({
  //   items: tasks.map((t) => ({ id: t.id })),
  //   deleteFn: batchDeleteFn,
  //   onDeleteComplete: batchDeleteComplete,
  // })

  // Extract unique owners for filter dropdown
  const owners = Array.from(
    new Map(tasks.map((t) => [t.owner.initials, t.owner])).values()
  )

  const filteredTasks = tasks.filter((task) => {
    if (typeFilter !== "all" && task.type !== typeFilter) return false
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false
    if (ownerFilter !== "all" && task.owner.initials !== ownerFilter) return false
    return true
  })

  if (loading) {
    return <AgentTaskBoardSkeleton />
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between gap-3">
        <TaskFilterPanel
          filters={filters}
          onChange={setFilters}
          onClearAll={clearFilters}
        />
      </div>
      <FilterBar
        typeFilter={typeFilter}
        priorityFilter={priorityFilter}
        ownerFilter={ownerFilter}
        onTypeChange={setTypeFilter}
        onPriorityChange={setPriorityFilter}
        onOwnerChange={setOwnerFilter}
        owners={owners}
        // Manage batch delete removed
        onNewTask={() => setShowNewTask(true)}
      />

      <div className="flex gap-4 flex-1 overflow-hidden">
        {columns.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={filteredTasks.filter((t) => t.status === status)}
            onCardClick={(task) => setSelectedTask(task)}
          />
        ))}
      </div>

      <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      <NewTaskModal open={showNewTask} onClose={() => setShowNewTask(false)} onCreated={reload} />

      {/* Manage batch delete confirm dialog removed
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Tasks"
        message={`Are you sure you want to delete ${batch.selectedCount} task${batch.selectedCount > 1 ? "s" : ""}? This action cannot be undone.`}
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => {
          setShowDeleteConfirm(false)
          batch.deleteSelected()
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      */}
    </div>
  )
}
