"use client"

import { useEffect, useState } from "react"
import { useAgentLayout } from "../AgentLayoutContext"
import { cn } from "@/lib/utils"
import { AnomalyAlerts } from "../overview/AnomalyAlerts"
import { AgentAPI } from "@/lib/api/agentApi"
import { Button } from "@/components/ui/button"
import { CheckCircle2, X, XCircle } from "lucide-react"

type MiroDialogState =
  | null
  | {
      status: "success" | "failed"
      boardId?: string
      workflowRunId?: string
      lastUpdatedAt: number
    }

export function RightPanel() {
  const { isRightPanelOpen } = useAgentLayout()
  const [anomalies, setAnomalies] = useState<{ type: string; severity: string; campaign: string; description: string; cost: number; roas?: number }[]>([])
  const [anomaliesLoading, setAnomaliesLoading] = useState(true)
  const [miroDialog, setMiroDialog] = useState<MiroDialogState>(null)

  useEffect(() => {
    AgentAPI.fetchLatestAnomalies()
      .then((data) => { if (data?.length) setAnomalies(data) })
      .catch(() => {})
      .finally(() => setAnomaliesLoading(false))
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.anomalies) {
        localStorage.removeItem("agent-dismissed-alerts")
        setAnomalies(detail.anomalies)
      }
    }
    window.addEventListener("agent:analysis-complete", handler)
    return () => window.removeEventListener("agent:analysis-complete", handler)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const raw = (e as CustomEvent).detail
      if (!raw) return
      const mapped = {
        type: raw.metric || raw.type || "",
        severity: raw.severity || "info",
        campaign: raw.campaign || "",
        description: raw.description || "",
        cost: typeof raw.current_value === "number" ? raw.current_value : 0,
        roas: undefined as number | undefined,
      }
      setAnomalies((prev) => {
        const exists = prev.some(
          (a) => a.description === mapped.description && a.campaign === mapped.campaign
        )
        if (exists) return prev
        return [...prev, mapped]
      })
    }
    window.addEventListener("agent:add-alert", handler)
    return () => window.removeEventListener("agent:add-alert", handler)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { status?: "success" | "failed"; boardId?: string; workflowRunId?: string }
        | undefined
      if (!detail?.status) return
      setMiroDialog({
        status: detail.status,
        boardId: detail.boardId,
        workflowRunId: detail.workflowRunId,
        lastUpdatedAt: Date.now(),
      })
    }
    window.addEventListener("agent:miro-status", handler)
    return () => window.removeEventListener("agent:miro-status", handler)
  }, [])

  return (
    <div
      data-tour="tour-right-panel"
      className={cn(
        "h-full border-l border-border bg-background transition-all duration-300 overflow-hidden",
        isRightPanelOpen ? "w-80" : "w-0"
      )}
    >
      <div className="w-80 h-full flex flex-col">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-xs font-medium text-foreground">Alerts</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {miroDialog && (
            <div
              className={cn(
                "mb-3 rounded-lg border px-3 py-2 text-sm",
                miroDialog.status === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-destructive/20 bg-destructive/10 text-foreground"
              )}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">
                  {miroDialog.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {miroDialog.status === "success"
                          ? "Miro board generated successfully."
                          : "Miro board generation failed."}
                      </p>
                      {miroDialog.status !== "success" && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Please try again.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md p-1 hover:bg-black/5"
                      aria-label="Dismiss"
                      onClick={() => setMiroDialog(null)}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  {miroDialog.status === "success" && miroDialog.boardId && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          window.location.href = `/miro/${miroDialog.boardId}`
                        }}
                      >
                        Open Miro board
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <AnomalyAlerts anomalies={anomalies} loading={anomaliesLoading} compact />
        </div>
      </div>
    </div>
  )
}
