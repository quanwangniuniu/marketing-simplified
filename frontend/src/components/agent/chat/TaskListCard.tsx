"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ChevronDown, ChevronRight, Clock, ListChecks, Loader2, AlertCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RecommendedTask } from "@/types/agent"

const priorityColors = {
  HIGH: { bg: "bg-red-500/20", text: "text-red-400" },
  MEDIUM: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  LOW: { bg: "bg-green-500/20", text: "text-green-400" },
} as const

export type TaskGenerationStatus = "idle" | "generating" | "awaiting_approval" | "completed" | "error"

interface TaskListCardProps {
  tasks: RecommendedTask[]
  /** Legacy action (pre-approval selection): creates tasks for all recommendations. */
  onCreateAll?: () => void
  approvalRequired?: boolean
  /** Indexes of recommended tasks that have been created in the DB. */
  generatedTaskIndexes?: number[]
  /** Indexes of recommendations the user explicitly chose NOT to create (approval flow). */
  skippedTaskIndexes?: number[]
  /** Map from recommended task index -> created Task ID for deep-link navigation. */
  createdTaskIdByIndex?: Record<number, number>
  /** When true (approval off), but tasks not yet created, show a generating state. */
  generating?: boolean
  /** When true, render selection + destination + create actions. */
  approvalMode?: boolean
  /** When true, render per-task checkboxes (defaults to approvalMode). */
  selectionMode?: boolean
  selectedIndexes?: number[]
  onSelectedIndexesChange?: (next: number[]) => void
  onCreateSelected?: (selectedIndexes: number[]) => void
  createButtonDisabled?: boolean
  generationStatus?: TaskGenerationStatus
}

export function TaskListCard({
  tasks,
  onCreateAll,
  approvalRequired,
  generatedTaskIndexes,
  skippedTaskIndexes,
  createdTaskIdByIndex,
  generating,
  approvalMode,
  selectionMode,
  selectedIndexes,
  onSelectedIndexesChange,
  onCreateSelected,
  createButtonDisabled,
  generationStatus = "idle",
}: TaskListCardProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const generatedSet = useMemo(() => {
    return new Set(Array.isArray(generatedTaskIndexes) ? generatedTaskIndexes : [])
  }, [generatedTaskIndexes])

  const skippedSet = useMemo(() => {
    return new Set(Array.isArray(skippedTaskIndexes) ? skippedTaskIndexes : [])
  }, [skippedTaskIndexes])

  const selectedSet = useMemo(() => {
    return new Set(Array.isArray(selectedIndexes) ? selectedIndexes : [])
  }, [selectedIndexes])

  const showSelection = selectionMode ?? Boolean(approvalMode)

  const toggleSelected = (idx: number) => {
    const next = new Set(selectedSet)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    onSelectedIndexesChange?.(Array.from(next).sort((a, b) => a - b))
  }

  const canCreateSelected =
    typeof onCreateSelected === "function" &&
    selectedSet.size > 0 &&
    !createButtonDisabled

  // In approval mode, we still want the Create Tasks button visible while the user is
  // deciding which tasks to create (even if the global status shows "Awaiting approval").
  // Hide only once we're actively generating/creating tasks (or disabled).
  const showCreateActions = approvalMode
    ? generationStatus !== "generating" && !generating && !createButtonDisabled
    : generationStatus === "idle" && !generating && !createButtonDisabled

  const handleRowClick = (idx: number) => {
    const taskId = createdTaskIdByIndex?.[idx]
    if (taskId != null && Number.isFinite(taskId)) {
      window.location.href = `/tasks/${taskId}`
      return
    }
    setExpandedIndex((prev) => (prev === idx ? null : idx))
  }

  if (!tasks.length) return null

  const statusChip = (() => {
    if (generationStatus === "generating") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating…
        </span>
      )
    }
    if (generationStatus === "awaiting_approval") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Awaiting approval
        </span>
      )
    }
    if (generationStatus === "completed") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600">
          <CheckCircle2 className="h-3 w-3" />
          Generated
        </span>
      )
    }
    if (generationStatus === "error") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3" />
          Failed
        </span>
      )
    }
    return null
  })()

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 shrink-0">
            <ListChecks className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold text-card-foreground">
              Recommended Tasks ({tasks.length})
            </CardTitle>
          </div>
          {statusChip ? <div className="shrink-0">{statusChip}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-2">
        {tasks.map((task, i) => {
          const priority = priorityColors[task.priority] || priorityColors.MEDIUM
          const isGenerated = generatedSet.has(i)
          const isSelected = selectedSet.has(i)
          const isSkipped = skippedSet.has(i)
          const statusNode = (() => {
            if (isGenerated) {
              return (
                <span
                  className="inline-flex items-center text-emerald-600"
                  title={`${task.summary} is generated`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              )
            }
            if (isSkipped) {
              return (
                <span
                  className="inline-flex items-center text-destructive"
                  title={`${task.summary} was not selected`}
                >
                  <XCircle className="h-4 w-4" />
                </span>
              )
            }
            if (generating || generationStatus === "generating") {
              return (
                <span
                  className="inline-flex items-center text-muted-foreground"
                  title="Generating tasks..."
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                </span>
              )
            }
            if (approvalRequired) {
              return (
                <span
                  className="inline-flex items-center text-muted-foreground"
                  title="Waiting for approval"
                >
                  <Clock className="h-4 w-4" />
                </span>
              )
            }
            return null
          })()
          return (
            <div
              key={i}
              className={cn(
                "rounded-md hover:bg-muted/40 transition-colors",
                showSelection && isSelected && "bg-muted/40"
              )}
            >
              <button
                type="button"
                className="w-full text-left flex items-start gap-3 py-2 px-2 rounded-md"
                onClick={() => handleRowClick(i)}
              >
                {showSelection && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelected(i)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 shrink-0 rounded border border-input"
                    disabled={createButtonDisabled || isGenerated}
                    aria-label={`Select task ${i + 1}`}
                  />
                )}
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5",
                    priority.bg,
                    priority.text
                  )}
                >
                  {task.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{task.summary}</p>
                  <p className="text-xs text-muted-foreground capitalize">{task.type}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  {statusNode}
                  {expandedIndex === i ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>
              {expandedIndex === i && (
                <div className={cn("px-2 pb-2", showSelection ? "pl-[72px]" : "pl-[52px]")}>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {task.description?.trim() ? task.description : "No description provided."}
                  </p>
                </div>
              )}
            </div>
          )
        })}

        {(onCreateSelected || onCreateAll) && showCreateActions && (
          <div className="pt-2">
            <Button
              size="sm"
              onClick={() => {
                if (onCreateSelected) {
                  const selected = Array.from(selectedSet)
                  onSelectedIndexesChange?.([])
                  onCreateSelected(selected)
                  return
                }
                onCreateAll?.()
              }}
              disabled={onCreateSelected ? !canCreateSelected : Boolean(createButtonDisabled)}
            >
              Create Tasks
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
