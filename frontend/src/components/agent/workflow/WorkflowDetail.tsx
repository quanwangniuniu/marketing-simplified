"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ArrowLeft, Plus, GripVertical, Trash2, Save, Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AgentAPI } from "@/lib/api/agentApi"
import { cn } from "@/lib/utils"
import type {
  AgentWorkflowDefinition,
  AgentWorkflowStep,
  WorkflowStepType,
} from "@/types/agent"

const STEP_TYPE_OPTIONS: { value: WorkflowStepType; label: string }[] = [
  { value: "analyze_data", label: "Analyze Data" },
  { value: "call_dify", label: "Call Dify" },
  { value: "call_llm", label: "Call LLM" },
  { value: "create_decision", label: "Create Decision" },
  { value: "create_tasks", label: "Create Tasks" },
  { value: "await_confirmation", label: "Await Confirmation" },
  { value: "custom_api", label: "Custom API" },
]

interface WorkflowDetailProps {
  workflowId: string
  onBack: () => void
  onUpdate: (wf: AgentWorkflowDefinition) => void
}

export function WorkflowDetail({ workflowId, onBack, onUpdate }: WorkflowDetailProps) {
  const [workflow, setWorkflow] = useState<AgentWorkflowDefinition | null>(null)
  const [steps, setSteps] = useState<AgentWorkflowStep[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [wfStatus, setWfStatus] = useState<string>("draft")
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const isSystem = workflow?.is_system ?? false

  const loadWorkflow = useCallback(async () => {
    try {
      const wf = await AgentAPI.getWorkflow(workflowId)
      setWorkflow(wf)
      setName(wf.name)
      setDescription(wf.description)
      setWfStatus(wf.status)
      setSteps(wf.steps || [])
    } catch {
      // handle error silently
    } finally {
      setLoading(false)
    }
  }, [workflowId])

  useEffect(() => {
    loadWorkflow()
  }, [loadWorkflow])

  const handleSave = async () => {
    if (isSystem || saving) return
    setSaving(true)
    try {
      const updated = await AgentAPI.updateWorkflow(workflowId, {
        name,
        description,
        status: wfStatus,
      })
      setWorkflow(updated)
      onUpdate(updated)
    } catch {
      // handle error silently
    } finally {
      setSaving(false)
    }
  }

  const handleAddStep = async () => {
    if (isSystem) return
    try {
      const newStep = await AgentAPI.createStep(workflowId, {
        name: "New Step",
        step_type: "call_llm",
      })
      setSteps((prev) => [...prev, newStep])
    } catch {
      // handle error silently
    }
  }

  const handleDragStart = (idx: number) => {
    if (isSystem) return
    setDragIdx(idx)
  }

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === targetIdx) return
    setSteps((prev) => {
      const updated = [...prev]
      const [moved] = updated.splice(dragIdx, 1)
      updated.splice(targetIdx, 0, moved)
      return updated
    })
    setDragIdx(targetIdx)
  }

  const handleDragEnd = async () => {
    if (dragIdx === null || isSystem) return
    setDragIdx(null)
    try {
      const reordered = await AgentAPI.reorderSteps(
        workflowId,
        steps.map((s) => s.id)
      )
      setSteps(reordered)
    } catch {
      // revert on error
      loadWorkflow()
    }
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>

        <div className="space-y-3 mb-6">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Name</label>
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Steps</h2>
          <Skeleton className="h-7 w-24 rounded-md" />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={`workflow-step-skeleton-${idx}`}
              className="flex items-center gap-2 rounded-md border border-border bg-background p-2"
            >
              <Skeleton className="h-4 w-4 rounded-sm" />
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48 rounded-sm" />
                <Skeleton className="h-3 w-24 rounded-sm" />
              </div>
              <Skeleton className="h-4 w-4 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Workflow not found</p>
        <Button variant="ghost" size="sm" onClick={onBack} className="mt-2">
          Go back
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex-1" />
        {isSystem && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            System workflow (read-only)
          </div>
        )}
        {!isSystem && (
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-3 mb-6">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSystem}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSystem}
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 resize-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
          <select
            value={wfStatus}
            onChange={(e) => setWfStatus(e.target.value)}
            disabled={isSystem}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Steps</h2>
        {!isSystem && (
          <Button variant="outline" size="sm" onClick={handleAddStep} className="gap-1 h-7 text-xs">
            <Plus className="h-3 w-3" />
            Add Step
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5">
        {steps.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-8">
            No steps defined. Add a step to get started.
          </div>
        ) : (
          steps.map((step, idx) => (
            <div
              key={step.id}
              draggable={!isSystem}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-2 rounded-md border border-border p-2 bg-background transition-all",
                dragIdx === idx && "opacity-50 border-primary",
                !isSystem && "cursor-grab active:cursor-grabbing"
              )}
            >
              {!isSystem && (
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              )}
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium text-muted-foreground shrink-0">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">{step.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {STEP_TYPE_OPTIONS.find((o) => o.value === step.step_type)?.label || step.step_type}
                </div>
              </div>
              {!isSystem && (
                <button
                  onClick={async () => {
                    try {
                      await AgentAPI.deleteStep(workflowId, step.id)
                      setSteps((prev) => prev.filter((s) => s.id !== step.id))
                    } catch {
                      // revert on error
                    }
                  }}
                  className="text-muted-foreground/40 hover:text-red-500 transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
