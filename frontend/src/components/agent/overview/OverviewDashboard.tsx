"use client"

import { useEffect, useState } from "react"
import { DollarSign, Megaphone, AlertCircle, TrendingUp } from "lucide-react"
import { KPICard } from "./KPICard"
import { PerformanceChart } from "./PerformanceChart"
import { TaskStatusChart } from "./TaskStatusChart"
import { CampaignRanking } from "./CampaignRanking"
import { ActivityFeed } from "./ActivityFeed"
import { AgentAPI } from "@/lib/api/agentApi"
import {
  AgentCampaignPerformanceSkeleton,
  AgentOverviewKpiSkeleton,
} from "@/components/agent/skeletons/AgentSkeletons"
import { withMinimumDelay } from "@/lib/agentLoading"

const fallbackKpi: { title: string; value: string; change: string; changeType: "up" | "down" | "neutral"; icon: React.ElementType }[] = [
  { title: "Total Cost", value: "$—", change: "—", changeType: "neutral" as const, icon: DollarSign },
  { title: "Active Ads", value: "—", change: "—", changeType: "neutral" as const, icon: Megaphone },
  { title: "Anomalies", value: "—", change: "—", changeType: "neutral" as const, icon: AlertCircle },
  { title: "Avg ROAS", value: "—", change: "—", changeType: "neutral" as const, icon: TrendingUp },
]

interface CampaignItem {
  name: string
  cost: number
  revenue: number
  roas: number
}

export function OverviewDashboard() {
  const [kpiData, setKpiData] = useState(fallbackKpi)
  const [campaignData, setCampaignData] = useState<{ top: CampaignItem[]; bottom: CampaignItem[] }>({ top: [], bottom: [] })
  const [summaryLoading, setSummaryLoading] = useState(true)

  useEffect(() => {
    async function loadSummary() {
      try {
        const summary = await withMinimumDelay(AgentAPI.fetchReportsSummary())
        if (summary && summary.total_cost !== undefined) {
          setKpiData([
            { title: "Total Cost", value: `$${summary.total_cost.toLocaleString()}`, change: `${summary.file_count} files`, changeType: "neutral" as const, icon: DollarSign },
            { title: "Active Ads", value: String(summary.active_campaigns), change: "campaigns", changeType: "up" as const, icon: Megaphone },
            { title: "Anomalies", value: "—", change: "—", changeType: "neutral" as const, icon: AlertCircle },
            { title: "Avg ROAS", value: `${summary.avg_roas}x`, change: summary.avg_roas >= 1 ? "healthy" : "below target", changeType: summary.avg_roas >= 1 ? "up" as const : "down" as const, icon: TrendingUp },
          ])
          setCampaignData({ top: summary.top_campaigns || [], bottom: summary.bottom_campaigns || [] })
        }
      } catch {
        // keep fallback
      } finally {
        setSummaryLoading(false)
      }
    }
    loadSummary()
  }, [])

  return (
    <div className="p-6 space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        {summaryLoading ? (
          <AgentOverviewKpiSkeleton />
        ) : (
          kpiData.map((kpi) => (
            <KPICard key={kpi.title} {...kpi} />
          ))
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <PerformanceChart />
        </div>
        <TaskStatusChart />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-4">
        {summaryLoading ? (
          <AgentCampaignPerformanceSkeleton />
        ) : (
          <CampaignRanking topCampaigns={campaignData.top} />
        )}
        <ActivityFeed />
      </div>
    </div>
  )
}
