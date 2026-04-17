"use client"

import { useEffect, useState } from "react"
import { RotateCcw, Workflow, ChevronDown, ChevronRight } from "lucide-react"
import { getDebugMode, setDebugMode } from "@/lib/agentDebug"
import { AgentAPI } from "@/lib/api/agentApi"
import type { AgentWorkflowDefinition, AgentWorkflowStep } from "@/types/agent"
import {
  AgentSettingsConnectionsSkeleton,
  AgentWorkflowListSkeleton,
  AgentWorkflowStepsSkeleton,
} from "@/components/agent/skeletons/AgentSkeletons"
import { withMinimumDelay } from "@/lib/agentLoading"

interface ConfigStatus {
  dify_api: boolean
  dify_chat: boolean
  dify_calendar: boolean
  dify_miro: boolean
  anthropic: boolean
}

const CONFIG_LABELS: Record<string, string> = {
  dify_api: "Analysis API (Dify)",
  dify_chat: "Chat API (Dify)",
  dify_calendar: "Calendar API (Dify)",
  dify_miro: "Miro API (Dify)",
  anthropic: "Anthropic API",
}

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${
        connected ? "bg-emerald-500" : "bg-gray-300"
      }`}
      title={connected ? "Connected" : "Not configured"}
    />
  )
}

function WorkflowStepList({ workflowId }: { workflowId: string }) {
  const [steps, setSteps] = useState<AgentWorkflowStep[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    withMinimumDelay(AgentAPI.listSteps(workflowId))
      .then(setSteps)
      .catch(() => setSteps([]))
      .finally(() => setLoading(false))
  }, [workflowId])

  if (loading) {
    return <AgentWorkflowStepsSkeleton />
  }

  if (steps.length === 0) {
    return <p className="text-xs text-muted-foreground pl-4 py-1">No steps defined</p>
  }

  return (
    <div className="pl-4 space-y-1 mt-1">
      {steps.map((step) => (
        <div key={step.id} className="flex items-start gap-2 rounded bg-muted/20 px-3 py-1.5">
          <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5">
            #{step.order}
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-card-foreground block truncate">
              {step.name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {step.step_type}
              {step.config && Object.keys(step.config).length > 0 && (
                <> &middot; {Object.keys(step.config).length} config key{Object.keys(step.config).length !== 1 ? "s" : ""}</>
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function WorkflowItem({ workflow }: { workflow: AgentWorkflowDefinition }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-card-foreground block truncate">
            {workflow.name}
          </span>
          {workflow.description && (
            <span className="text-xs text-muted-foreground line-clamp-1">
              {workflow.description}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
            {workflow.status}
          </span>
          <span className="text-xs text-muted-foreground">{workflow.step_count ?? 0} steps</span>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border px-2 py-2 bg-muted/10">
          <WorkflowStepList workflowId={workflow.id} />
        </div>
      )}
    </div>
  )
}

export function SettingsPage() {
  const [debugEnabled, setDebugEnabled] = useState(true)
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [workflows, setWorkflows] = useState<AgentWorkflowDefinition[]>([])
  const [workflowsLoading, setWorkflowsLoading] = useState(true)

  useEffect(() => {
    setDebugEnabled(getDebugMode())
  }, [])

  useEffect(() => {
    withMinimumDelay(AgentAPI.getConfigStatus())
      .then(setConfigStatus)
      .catch(() => setConfigStatus(null))
      .finally(() => setConfigLoading(false))
  }, [])

  useEffect(() => {
    withMinimumDelay(AgentAPI.listWorkflows())
      .then((data) => setWorkflows(data.filter((w) => w.is_system && w.status === "active")))
      .catch(() => setWorkflows([]))
      .finally(() => setWorkflowsLoading(false))
  }, [])

  const handleToggleDebug = () => {
    const next = !debugEnabled
    setDebugEnabled(next)
    setDebugMode(next)
  }

  const handleRestartTour = () => {
    localStorage.removeItem("agent-tour-completed")
    window.dispatchEvent(new CustomEvent("agent:restart-tour"))
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agent configuration, API connections, and workflow overview.
          </p>
        </div>

        {/* General section */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-foreground uppercase tracking-wider">General</h2>

          <div className="rounded-lg border border-border divide-y divide-border">
            {/* Debug Mode */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="text-sm text-card-foreground">Debug Mode</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Log agent events to browser console
                </p>
              </div>
              <button
                onClick={handleToggleDebug}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  debugEnabled ? "bg-blue-600" : "bg-input"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    debugEnabled ? "translate-x-[18px]" : "translate-x-[3px]"
                  }`}
                />
              </button>
            </div>

            {/* Agent Tour */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="text-sm text-card-foreground">Agent Tour</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Replay the onboarding walkthrough
                </p>
              </div>
              <button
                onClick={handleRestartTour}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restart
              </button>
            </div>
          </div>
        </section>

        {/* API Connection Status */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-foreground uppercase tracking-wider">
            API Connection Status
          </h2>

          {configLoading ? (
            <AgentSettingsConnectionsSkeleton />
          ) : configStatus === null ? (
            <p className="text-sm text-muted-foreground py-2">
              Unable to fetch configuration status.
            </p>
          ) : (
            <div className="rounded-lg border border-border divide-y divide-border">
              {Object.entries(CONFIG_LABELS).map(([key, label]) => {
                const connected = configStatus[key as keyof ConfigStatus] ?? false
                return (
                  <div key={key} className="flex items-center gap-3 px-4 py-3">
                    <StatusDot connected={connected} />
                    <span className="text-sm text-card-foreground flex-1">{label}</span>
                    <span className={`text-xs ${connected ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {connected ? "Connected" : "Not configured"}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Internal Workflows */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground uppercase tracking-wider">
              Internal Workflows
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            System-managed workflow definitions and their step configurations.
          </p>

          {workflowsLoading ? (
            <AgentWorkflowListSkeleton />
          ) : workflows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No active system workflows</p>
          ) : (
            <div className="space-y-2">
              {workflows.map((wf) => (
                <WorkflowItem key={wf.id} workflow={wf} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
