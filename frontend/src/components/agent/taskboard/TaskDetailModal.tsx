"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TaskAPI } from "@/lib/api/taskApi"
import type { Task } from "./TaskCard"
import { typeLabels, priorityLabels, priorityColors } from "./constants"

interface TaskDetailModalProps {
  task: Task | null
  onClose: () => void
}

export function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  const [description, setDescription] = useState<string>("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!task) {
      setDescription("")
      return
    }
    setLoading(true)
    TaskAPI.getTask(Number(task.id))
      .then((res) => {
        setDescription(res.data?.description || "")
      })
      .catch(() => {
        setDescription("")
      })
      .finally(() => setLoading(false))
  }, [task])

  return (
    <Dialog open={!!task} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{task?.summary}</DialogTitle>
          <DialogDescription className="sr-only">Task details</DialogDescription>
        </DialogHeader>

        {task && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Type</span>
                <p className="mt-0.5 font-medium">{typeLabels[task.type] || task.type}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Priority</span>
                <div className="mt-0.5">
                  <Badge variant="secondary" className={priorityColors[task.priority]}>
                    {priorityLabels[task.priority]}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <p className="mt-0.5 font-medium">{task.status.replace(/_/g, " ")}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Due Date</span>
                <p className="mt-0.5 font-medium">{task.dueDate}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Owner</span>
                <p className="mt-0.5 font-medium">{task.owner.name}</p>
              </div>
            </div>

            <div>
              <span className="text-sm text-muted-foreground">Description</span>
              {loading ? (
                <div className="mt-2 space-y-2">
                  <Skeleton className="h-4 w-full rounded-sm" />
                  <Skeleton className="h-4 w-5/6 rounded-sm" />
                  <Skeleton className="h-4 w-2/3 rounded-sm" />
                </div>
              ) : (
                <p className="mt-1 text-sm whitespace-pre-wrap">{description || "No description"}</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  window.location.href = `/tasks/${task.id}`
                }}
              >
                View Full Detail
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
