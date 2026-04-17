"use client"

import { useEffect, useState } from "react"
import { useAgentLayout } from "../AgentLayoutContext"
import { cn } from "@/lib/utils"
import { AnomalyAlerts } from "../overview/AnomalyAlerts"
import { RecentDecisions } from "../overview/RecentDecisions"
import { AgentAPI } from "@/lib/api/agentApi"
import { AgentListSkeleton } from "@/components/agent/skeletons/AgentSkeletons"

type TabValue = "alerts" | "decisions"

const tabs: { value: TabValue; label: string }[] = [
  { value: "alerts", label: "Alerts" },
  { value: "decisions", label: "Decisions" },
]

export function RightPanel() {
  const { isRightPanelOpen, setActiveView, setPendingDecisionId } = useAgentLayout()
  const [activeTab, setActiveTab] = useState<TabValue>("alerts")
  const [anomalies, setAnomalies] = useState<{ type: string; severity: string; campaign: string; description: string; cost: number; roas?: number }[]>([])
  const [anomaliesLoading, setAnomaliesLoading] = useState(true)

  // Load latest anomalies from backend on mount
  useEffect(() => {
    AgentAPI.fetchLatestAnomalies()
      .then((data) => { if (data?.length) setAnomalies(data) })
      .catch(() => {})
      .finally(() => setAnomaliesLoading(false))
  }, [])

  // Listen for analysis-complete events from chat (session restore only)
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

  // Listen for individual anomaly additions from the AnomalyCard "+ Add" button.
  // Converts AnomalyItem shape into the RightPanel anomaly shape.
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

  const handleDecisionSelect = (decisionId: number) => {
    setActiveView("decisions")
    setPendingDecisionId(decisionId)
  }

  return (
    <div
      data-tour="tour-right-panel"
      className={cn(
        "h-full border-l border-border bg-background transition-all duration-300 overflow-hidden",
        isRightPanelOpen ? "w-80" : "w-0"
      )}
    >
      <div className="w-80 h-full flex flex-col">
        {/* Custom Tab Buttons */}
        <div className="flex border-b border-border px-2 pt-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
                activeTab === tab.value
                  ? "border-blue-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-card-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Alerts Tab */}
          <div className={cn("p-3", activeTab !== "alerts" && "hidden")}>
            <AnomalyAlerts anomalies={anomalies} loading={anomaliesLoading} compact />
          </div>

          {/* Decisions Tab */}
          <div className={cn("p-3", activeTab !== "decisions" && "hidden")}>
            <RecentDecisions
              compact
              onSelect={handleDecisionSelect}
              loadingFallback={<AgentListSkeleton compact rows={4} />}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
