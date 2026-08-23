"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactFlow, {
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "reactflow"
import "reactflow/dist/style.css"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, X } from "lucide-react"
import toast from "react-hot-toast"
import { AgentAPI } from "@/lib/api/agentApi"
import { useBuildUrl } from "@/lib/buildUrl"
import type { AgentWorkflowDefinition, WorkflowStepType } from "@/types/agent"
import { useAgentWorkflowProjectParams } from "../hooks/useAgentWorkflows"
import useCanvasState, { makeTempId } from "./useCanvasState"
import { getStepMeta } from "./canvasStepMeta"
import AgentStepNode, { type AgentStepNodeData } from "./nodes/AgentStepNode"
import AgentAddNode, { type AgentAddNodeData } from "./nodes/AgentAddNode"
import AgentStepEdge, { type AgentStepEdgeData } from "./edges/AgentStepEdge"
import StepPickerPanel from "./panels/StepPickerPanel"
import StepConfigPanel from "./panels/StepConfigPanel"
import CanvasToolbar from "./CanvasToolbar"
import { CreateTemplateModal } from "@/components/agent/templates/CreateTemplateModal"
import TriggerDrawer from "./TriggerDrawer"

// ── Unsaved-changes guard dialog ──────────────────────────────────────────────
interface UnsavedChangesDialogProps {
  isSaving: boolean
  onClose: () => void
  onLeave: () => void
  onSave: () => void
}

function UnsavedChangesDialog({ isSaving, onClose, onLeave, onSave }: UnsavedChangesDialogProps) {
  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <h2 className="text-base font-semibold text-slate-800">Unsaved Changes</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          You have unsaved changes. Would you like to save before leaving?
        </p>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={onLeave}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Leave
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── React Flow node and edge type registry ────────────────────────────────────
const nodeTypes = {
  agentStep: AgentStepNode,
  agentAdd: AgentAddNode,
}

const edgeTypes = {
  agentStepEdge: AgentStepEdge,
}

// Layout constants
const STEP_X_GAP = 200
const NODE_Y = 0
const ADD_NODE_ID = "__add__"

// ── Inner canvas (needs ReactFlow context) ────────────────────────────────────
interface CanvasInnerProps {
  workflowId: string
  workflow: AgentWorkflowDefinition
  currentStatus: AgentWorkflowDefinition["status"]
  onStatusChange: (status: AgentWorkflowDefinition["status"]) => void
  onWorkflowUpdate: (workflow: AgentWorkflowDefinition) => void
  isUpdatingStatus: boolean
}

function CanvasInner({ workflowId, workflow, currentStatus, onStatusChange, onWorkflowUpdate, isUpdatingStatus }: CanvasInnerProps) {
  const router = useRouter()
  const buildUrl = useBuildUrl()
  const searchParams = useSearchParams()
  const isNew = searchParams.get("new") === "1"
  const { fitView } = useReactFlow()
  const { projectParams } = useAgentWorkflowProjectParams()

  // ── Editable workflow name ──────────────────────────────────────────────────
  const [nameValue, setNameValue] = useState(workflow.name)
  const [nameError, setNameError] = useState<string | null>(null)
  const [isRenamingName, setIsRenamingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // On mount: auto-focus + check for duplicate default name when arriving from "Create workflow"
  useEffect(() => {
    if (!isNew) return
    AgentAPI.listWorkflows(projectParams).then((existing) => {
      const duplicate = existing.some(
        (w) => w.name.trim().toLowerCase() === "new workflow" && w.id !== workflowId
      )
      if (duplicate) {
        setNameError("A workflow with this name already exists. Please choose a different name.")
        setNameValue("")
        nameInputRef.current?.focus()
      } else {
        nameInputRef.current?.focus()
        nameInputRef.current?.select()
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On mount: check if openTrigger URL param is set, and if so, open trigger drawer
  useEffect(() => {
    const openTrigger = searchParams.get("openTrigger")
    if (openTrigger === "true") {
      setShowTriggerDrawer(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleNameBlur = useCallback(async () => {
    const trimmed = nameValue.trim()
    if (!trimmed) {
      setNameValue(workflow.name)
      setNameError(null)
      return
    }
    if (trimmed === workflow.name) {
      setNameError(null)
      return
    }
    setIsRenamingName(true)
    try {
      const existing = await AgentAPI.listWorkflows(projectParams)
      const duplicate = existing.some(
        (w) => w.name.trim().toLowerCase() === trimmed.toLowerCase() && w.id !== workflowId
      )
      if (duplicate) {
        setNameError("A workflow with this name already exists. Please choose a different name.")
        setNameValue("")
        setTimeout(() => nameInputRef.current?.focus(), 0)
        return
      }
      await AgentAPI.updateWorkflow(workflowId, { name: trimmed }, projectParams)
      workflow.name = trimmed
      setNameError(null)
    } catch {
      toast.error("Failed to rename workflow")
      setNameValue(workflow.name)
    } finally {
      setIsRenamingName(false)
    }
  }, [nameValue, workflow, workflowId, projectParams])

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") nameInputRef.current?.blur()
      if (e.key === "Escape") {
        setNameValue(workflow.name)
        setNameError(null)
        nameInputRef.current?.blur()
      }
    },
    [workflow.name]
  )

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [isSavingAndLeaving, setIsSavingAndLeaving] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showTriggerDrawer, setShowTriggerDrawer] = useState(false)
  // picker state: insertion index + viewport anchor coordinates
  const [pickerState, setPickerState] = useState<{
    insertAfter: number
    anchorX: number
    anchorY: number
  } | null>(null)

  // Helpers that enforce mutual exclusivity between picker and config panel
  const openPicker = useCallback((insertAfter: number, e: React.MouseEvent) => {
    setSelectedStepId(null)       // close config panel
    setPickerState({ insertAfter, anchorX: e.clientX, anchorY: e.clientY })
  }, [])

  const openConfig = useCallback((stepId: string) => {
    setPickerState(null)          // close picker
    setSelectedStepId((prev) => (prev === stepId ? null : stepId))
  }, [])

  const canvasState = useCanvasState(workflow.steps ?? [])
  const { steps, canUndo, canRedo, isDirty, isSaving, dispatch, save } = canvasState

  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? null

  // ── Derive RF nodes ─────────────────────────────────────────────────────────
  const rfNodes: Node[] = useMemo(() => {
    const nodes: Node[] = steps.map((step, idx): Node<AgentStepNodeData> => ({
      id: step.id,
      type: "agentStep",
      position: { x: idx * STEP_X_GAP, y: NODE_Y },
      draggable: false,
      selectable: false,
      data: {
        step,
        isSelected: selectedStepId === step.id,
        hasNext: idx < steps.length - 1,
        onSelect: () => openConfig(step.id),
        onAddAfter: (e) => openPicker(idx, e),
        onDelete: () => {
          dispatch({ type: "DELETE", stepId: step.id })
          if (selectedStepId === step.id) setSelectedStepId(null)
        },
      },
    }))

    // Add-node only when canvas is empty — acts as the entry-point prompt.
    // When steps exist, the hover "+" on each AgentStepNode covers all insertion cases.
    if (steps.length === 0) {
      nodes.push({
        id: ADD_NODE_ID,
        type: "agentAdd",
        position: { x: 0, y: 0 },
        draggable: false,
        selectable: false,
        data: {
          isEmpty: true,
          onClick: (e) => openPicker(-1, e),
        } satisfies AgentAddNodeData,
      })
    }

    return nodes
  }, [steps, selectedStepId, dispatch])

  // ── Derive RF edges ─────────────────────────────────────────────────────────
  const rfEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = []

    for (let i = 0; i < steps.length - 1; i++) {
      const meta = getStepMeta(steps[i].step_type)
      edges.push({
        id: `e-${steps[i].id}-${steps[i + 1].id}`,
        source: steps[i].id,
        target: steps[i + 1].id,
        type: "agentStepEdge",
        markerEnd: { type: MarkerType.ArrowClosed, color: meta.edgeColor, width: 16, height: 16 },
        style: { stroke: meta.edgeColor, strokeWidth: 2 },
        data: {
          onAddBetween: (e: React.MouseEvent) => openPicker(i, e),
        } satisfies AgentStepEdgeData,
      })
    }

    return edges
  }, [steps, openPicker])

  // ── Fit view when step count changes ───────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.6, duration: 350 }), 80)
    return () => clearTimeout(t)
  }, [steps.length, fitView])

  // ── Add a step (from picker) ────────────────────────────────────────────────
  const handlePickStep = useCallback(
    (type: WorkflowStepType) => {
      const meta = getStepMeta(type)
      const insertAfter = pickerState?.insertAfter ?? steps.length - 1
      setPickerState(null)

      const tempStep = {
        id: makeTempId(),
        name: meta.label,
        step_type: type,
        order: insertAfter + 2,
        config: {},
        _isTemp: true,
        _isDirty: false,
      }

      dispatch({ type: "ADD", step: tempStep, insertAfter })
      // After adding, open the config panel for the new step (picker already closed above)
      openConfig(tempStep.id)
    },
    [pickerState, steps.length, dispatch]
  )

  // ── Back (with unsaved-changes guard) ──────────────────────────────────────
  const handleBack = useCallback(async () => {
    // Auto-delete if user exited without doing anything to a newly created workflow
    if (isNew && !isDirty && steps.length === 0 && workflow.name === "New workflow") {
      try {
        await AgentAPI.deleteWorkflow(workflowId, projectParams)
      } catch {
        // best-effort; navigate regardless
      }
      router.push(buildUrl("/workflows"))
      return
    }
    if (isDirty) {
      setShowUnsavedDialog(true)
    } else {
      router.push(buildUrl("/workflows"))
    }
  }, [isNew, isDirty, steps.length, workflow, workflowId, projectParams, router])

  const handleLeave = useCallback(() => {
    router.push(buildUrl("/workflows"))
  }, [router])

  const handleSaveAndLeave = useCallback(async () => {
    setIsSavingAndLeaving(true)
    try {
      await save(workflowId, projectParams)
      router.push(buildUrl("/workflows"))
    } catch {
      // save() already shows a toast error; keep dialog open so user can retry
      setIsSavingAndLeaving(false)
    }
  }, [save, workflowId, projectParams, router])

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    save(workflowId, projectParams)
  }, [save, workflowId, projectParams])

  return (
    <div className="relative h-screen w-full bg-slate-100">
      {/* Unsaved-changes dialog */}
      {showUnsavedDialog && (
        <UnsavedChangesDialog
          isSaving={isSavingAndLeaving}
          onClose={() => setShowUnsavedDialog(false)}
          onLeave={handleLeave}
          onSave={handleSaveAndLeave}
        />
      )}

      {/* React Flow canvas */}
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.6 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        // Required: React Flow v11 sets pointer-events:none on nodes when
        // nodesDraggable=false AND elementsSelectable=false AND onNodeClick is
        // absent. Providing this handler (even empty) keeps pointer-events:all
        // so buttons inside custom nodes remain interactive.
        onNodeClick={() => {}}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#cbd5e1" />
      </ReactFlow>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3">
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {/* Editable workflow name */}
          <div className="relative">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-300">
              <input
                ref={nameInputRef}
                type="text"
                value={nameValue}
                onChange={(e) => { setNameValue(e.target.value); setNameError(null) }}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKeyDown}
                placeholder="Workflow name"
                className="min-w-[120px] bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                style={{ width: `${Math.max(nameValue.length, 12)}ch` }}
              />
              {isRenamingName && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
              {isDirty && !isRenamingName && (
                <span className="text-xs font-medium text-amber-500">· Unsaved</span>
              )}
            </div>
            {nameError && (
              <p className="absolute left-0 top-full mt-1 whitespace-nowrap px-1 text-xs text-red-500">{nameError}</p>
            )}
          </div>
        </div>

        <div className="pointer-events-auto">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              currentStatus === "active"
                ? "bg-emerald-100 text-emerald-700"
                : currentStatus === "archived"
                ? "bg-gray-100 text-gray-500"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {currentStatus}
          </span>
        </div>
      </div>

      {/* ── Right side panels (mutually exclusive) ──────────────────────────── */}

      {/* Step picker — floating bubble anchored to the + button */}
      {pickerState !== null && (
        <StepPickerPanel
          anchorX={pickerState.anchorX}
          anchorY={pickerState.anchorY}
          onSelect={handlePickStep}
          onClose={() => setPickerState(null)}
        />
      )}

      {/* Step config — slides in from the right when a node is selected */}
      {selectedStep && (
        <div className="absolute right-0 top-0 z-20 h-full">
          <StepConfigPanel
            step={selectedStep}
            onClose={() => setSelectedStepId(null)}
            onUpdate={(patch) => dispatch({ type: "UPDATE", stepId: selectedStep.id, patch })}
            onDelete={() => {
              dispatch({ type: "DELETE", stepId: selectedStep.id })
              setSelectedStepId(null)
            }}
          />
        </div>
      )}

      {/* ── Bottom toolbar ───────────────────────────────────────────────────── */}
      <CanvasToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        isDirty={isDirty}
        isSaving={isSaving}
        currentStatus={currentStatus}
        isUpdatingStatus={isUpdatingStatus}
        onUndo={() => dispatch({ type: "UNDO" })}
        onRedo={() => dispatch({ type: "REDO" })}
        onSave={handleSave}
        onStatusChange={onStatusChange}
        onSaveAsTemplate={() => setShowTemplateModal(true)}
        onOpenTriggers={() => setShowTriggerDrawer(true)}
      />

      {/* Save as Template modal */}
      <CreateTemplateModal
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSuccess={() => {
          setShowTemplateModal(false)
          toast.success("Template created successfully")
        }}
        defaultSourceWorkflowId={workflowId}
        defaultName={nameValue || workflow.name}
        defaultDescription={workflow.description}
        lockSourceWorkflow
      />

      {/* Trigger Drawer */}
      <TriggerDrawer
        isOpen={showTriggerDrawer}
        workflowId={workflowId}
        workflowStatus={workflow.status}
        initialConfig={workflow.trigger_config}
        isSystem={workflow.is_system}
        onClose={() => setShowTriggerDrawer(false)}
        onSave={() => {
          // Reload workflow to get updated trigger config
          AgentAPI.getWorkflow(workflowId, projectParams)
            .then((wf) => {
              // Update the workflow state to sync trigger changes
              onWorkflowUpdate(wf)
            })
            .catch(() => {
              // Error already handled by TriggerConfigPanel
            })
        }}
      />
    </div>
  )
}

// ── Loader wrapper ────────────────────────────────────────────────────────────
interface AgentWorkflowCanvasProps {
  workflowId: string
}

export default function AgentWorkflowCanvas({ workflowId }: AgentWorkflowCanvasProps) {
  const { projectParams } = useAgentWorkflowProjectParams()
  const [workflow, setWorkflow] = useState<AgentWorkflowDefinition | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentStatus, setCurrentStatus] = useState<AgentWorkflowDefinition["status"]>("draft")
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  useEffect(() => {
    AgentAPI.getWorkflow(workflowId, projectParams)
      .then((wf) => {
        setWorkflow(wf)
        setCurrentStatus(wf.status)
      })
      .catch(() => toast.error("Failed to load workflow"))
      .finally(() => setLoading(false))
  }, [workflowId, projectParams])

  const handleStatusChange = useCallback(
    async (status: AgentWorkflowDefinition["status"]) => {
      setIsUpdatingStatus(true)
      try {
        await AgentAPI.updateWorkflow(workflowId, { status }, projectParams)
        setCurrentStatus(status)
        // Update workflow object to sync status change to all components
        setWorkflow((prev) => prev ? { ...prev, status } : null)
        toast.success(`Workflow set to ${status}`)
      } catch {
        toast.error("Failed to update status")
      } finally {
        setIsUpdatingStatus(false)
      }
    },
    [workflowId, projectParams]
  )

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    )
  }

  if (!workflow) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-600">Workflow not found.</p>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <CanvasInner
        workflowId={workflowId}
        workflow={workflow}
        currentStatus={currentStatus}
        onStatusChange={handleStatusChange}
        onWorkflowUpdate={setWorkflow}
        isUpdatingStatus={isUpdatingStatus}
      />
    </ReactFlowProvider>
  )
}
