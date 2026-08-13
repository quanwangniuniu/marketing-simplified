"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Copy,
  GitBranch,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  Workflow,
} from "lucide-react"
import toast from "react-hot-toast"
import ConfirmDialog from "@/components/common/ConfirmDialog"
import { CreateWorkflowModal } from "@/components/agent/workflow/CreateWorkflowModal"
import type { AgentWorkflowDefinition } from "@/types/agent"
import { useAgentWorkflows } from "./hooks/useAgentWorkflows"
import { WorkflowStatusBadge } from "./WorkflowStatusBadge"
import { useBuildUrl } from "@/lib/buildUrl"

type StatusFilter = "all" | AgentWorkflowDefinition["status"]

function WorkflowCard({
  workflow,
  onEdit,
  onDuplicate,
  onDelete,
  duplicateDisabled,
  duplicating,
}: {
  workflow: AgentWorkflowDefinition
  onEdit: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  duplicateDisabled?: boolean
  duplicating?: boolean
}) {
  return (
    <div className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#3CCED7]/10 text-[#1a9ba3]">
        <Workflow className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-gray-900">{workflow.name}</h3>
          {workflow.is_system && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              <Lock className="h-3 w-3" />
              System
            </span>
          )}
          <WorkflowStatusBadge status={workflow.status} />
          {workflow.is_default && (
            <span className="rounded-full bg-[#3CCED7]/10 px-2 py-0.5 text-[10px] font-medium text-[#1a9ba3]">
              Default
            </span>
          )}
        </div>
        {workflow.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-gray-500">{workflow.description}</p>
        ) : (
          <p className="mt-1 text-sm text-gray-400">No description</p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          {workflow.step_count ?? 0} step{(workflow.step_count ?? 0) === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {workflow.is_system ? (
          <button
            type="button"
            disabled={duplicateDisabled || duplicating}
            onClick={onDuplicate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {duplicating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            Duplicate
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              aria-label="Delete workflow"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function AgentWorkflowList() {
  const router = useRouter()
  const buildUrl = useBuildUrl()
  const {
    activeProject,
    hasHydrated,
    listWorkflows,
    createWorkflow,
    duplicateWorkflow,
    deleteWorkflow,
  } = useAgentWorkflows()

  const [workflows, setWorkflows] = useState<AgentWorkflowDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deletingWorkflow, setDeletingWorkflow] = useState<AgentWorkflowDefinition | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  const fetchWorkflows = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listWorkflows()
      setWorkflows(data)
    } catch {
      toast.error("Failed to load workflows")
      setWorkflows([])
    } finally {
      setLoading(false)
    }
  }, [listWorkflows])

  useEffect(() => {
    if (!hasHydrated) return
    fetchWorkflows()
  }, [fetchWorkflows, hasHydrated])

  const filteredWorkflows = useMemo(() => {
    return workflows.filter((wf) => {
      const q = search.trim().toLowerCase()
      const matchesSearch =
        !q ||
        wf.name.toLowerCase().includes(q) ||
        wf.description?.toLowerCase().includes(q)
      const matchesStatus = statusFilter === "all" || wf.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [workflows, search, statusFilter])

  const systemWorkflows = filteredWorkflows.filter((w) => w.is_system)
  const myWorkflows = filteredWorkflows.filter((w) => !w.is_system)
  const defaultSystemWorkflow =
    systemWorkflows.find((w) => w.is_default) || systemWorkflows[0]
  const needsProject = hasHydrated && !activeProject?.id
  const openEditor = (workflowId: string) => {
    router.push(buildUrl(`/workflows/${workflowId}`))
  }

  const handleCreate = async (data: { name: string; description?: string }) => {
    const created = await createWorkflow({ ...data, status: "draft" })
    toast.success("Workflow created")
    await fetchWorkflows()
    openEditor(created.slug)
  }

  const handleDuplicate = async (workflow: AgentWorkflowDefinition) => {
    if (!activeProject?.id) {
      toast.error("Select a project before duplicating a workflow")
      return
    }
    setDuplicatingId(workflow.id)
    try {
      const created = await duplicateWorkflow(workflow.id)
      toast.success("Workflow duplicated")
      await fetchWorkflows()
      openEditor(created.slug)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to duplicate workflow"
      toast.error(message)
    } finally {
      setDuplicatingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deletingWorkflow) return
    try {
      await deleteWorkflow(deletingWorkflow.id)
      toast.success("Workflow deleted")
      setDeletingWorkflow(null)
      await fetchWorkflows()
    } catch {
      toast.error("Failed to delete workflow")
    }
  }

  const counts = useMemo(
    () => ({
      total: workflows.length,
      active: workflows.filter((w) => w.status === "active").length,
      draft: workflows.filter((w) => w.status === "draft").length,
    }),
    [workflows]
  )

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#1a9ba3]">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3CCED7]/15">
                <GitBranch className="h-4 w-4" />
              </div>
              Agent workflows
            </div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Workflows</h1>
            <p className="max-w-xl text-sm text-gray-600">
              Define step sequences for the AI Agent — column detection, analysis, task creation,
              and more. Duplicate a system workflow or build your own pipeline.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={needsProject}
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#3CCED7] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#35b8c0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Create workflow
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-md">
          {[
            { label: "Total", value: counts.total },
            { label: "Active", value: counts.active },
            { label: "Draft", value: counts.draft },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-gray-200"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                {stat.label}
              </p>
              <p className="text-lg font-semibold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {needsProject && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Select an active project to create or duplicate custom workflows.
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workflows..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/20 sm:w-44"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-[#3CCED7]" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <Workflow className="mb-4 h-14 w-14 text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-900">No workflows yet</h2>
            <p className="mt-2 max-w-md text-sm text-gray-500">
              Duplicate the default system pipeline or create a blank workflow and add steps in the
              editor.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {defaultSystemWorkflow && (
                <button
                  type="button"
                  disabled={needsProject || duplicatingId === defaultSystemWorkflow.id}
                  onClick={() => handleDuplicate(defaultSystemWorkflow)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {duplicatingId === defaultSystemWorkflow.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Duplicate default workflow
                </button>
              )}
              <button
                type="button"
                disabled={needsProject}
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#3CCED7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#35b8c0] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Create blank workflow
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {systemWorkflows.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  System workflows
                </h2>
                <div className="space-y-3">
                  {systemWorkflows.map((workflow) => (
                    <WorkflowCard
                      key={workflow.id}
                      workflow={workflow}
                      duplicateDisabled={needsProject}
                      duplicating={duplicatingId === workflow.id}
                      onDuplicate={() => handleDuplicate(workflow)}
                      onEdit={() => openEditor(workflow.slug)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                My workflows
              </h2>
              {myWorkflows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500">
                  No custom workflows yet. Duplicate a system workflow or create a new one.
                </div>
              ) : (
                <div className="space-y-3">
                  {myWorkflows.map((workflow) => (
                    <WorkflowCard
                      key={workflow.id}
                      workflow={workflow}
                      onEdit={() => openEditor(workflow.slug)}
                      onDelete={() => setDeletingWorkflow(workflow)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <CreateWorkflowModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
      />

      <ConfirmDialog
        isOpen={!!deletingWorkflow}
        title="Delete workflow?"
        message={`This will permanently delete "${deletingWorkflow?.name}". This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeletingWorkflow(null)}
      />
    </div>
  )
}
