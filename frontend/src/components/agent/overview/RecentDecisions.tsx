"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { AgentAPI } from "@/lib/api/agentApi"
import { AgentListSkeleton } from "@/components/agent/skeletons/AgentSkeletons"

interface DecisionItem {
  id: number
  title: string
  status: string
  risk_level: string
  confidence: number | null
  author: string
  created_at: string
}

const statusStyles: Record<string, string> = {
  predraft: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  committed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  awaiting_approval: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  reviewed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  draft: "bg-muted/50 text-muted-foreground border-input",
  archived: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

const statusLabels: Record<string, string> = {
  predraft: "Pre-Draft",
  approved: "Approved",
  committed: "Committed",
  awaiting_approval: "Awaiting",
  reviewed: "Reviewed",
  draft: "Draft",
  archived: "Archived",
}

const riskStyles: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  high: "bg-red-500/10 text-red-400 border-red-500/20",
}

const riskLabels: Record<string, string> = {
  low: "Low Risk",
  medium: "Med Risk",
  high: "High Risk",
}

interface RecentDecisionsProps {
  compact?: boolean
  onSelect?: (decisionId: number) => void
  loadingFallback?: ReactNode
}

export function RecentDecisions({ compact = false, onSelect, loadingFallback }: RecentDecisionsProps) {
  const [decisions, setDecisions] = useState<DecisionItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await AgentAPI.fetchRecentDecisions()
        if (cancelled) return
        setDecisions(data)
      } catch {
        // keep empty on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    } catch {
      return iso
    }
  }

  const content = (
    <div className="space-y-2">
      {loading ? (
        loadingFallback || <AgentListSkeleton compact={compact} rows={compact ? 4 : 5} />
      ) : decisions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No decisions yet</p>
      ) : (
        decisions.map((d) => (
          <div
            key={d.id}
            className={cn("rounded-lg bg-muted/50 p-3", onSelect && "cursor-pointer hover:bg-muted")}
            onClick={() => onSelect?.(d.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground/60 font-mono">#{d.id}</span>
                  <p className="text-sm text-foreground truncate">{d.title}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">{d.author}</span>
                  <span className="text-[10px] text-muted-foreground/60">|</span>
                  <span className="text-[10px] text-muted-foreground">{formatDate(d.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="outline" className={cn("text-[10px]", statusStyles[d.status] || statusStyles.draft)}>
                  {statusLabels[d.status] || d.status}
                </Badge>
                {d.risk_level && (
                  <Badge variant="outline" className={cn("text-[10px]", riskStyles[d.risk_level] || "")}>
                    {riskLabels[d.risk_level] || d.risk_level}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )

  if (compact) return content

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-card-foreground">Recent Decisions</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
