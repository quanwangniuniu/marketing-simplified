"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { BarChart3 } from "lucide-react"

export function AgentDecisionListSkeleton({
  rows = 4,
  compact = false,
}: {
  rows?: number
  compact?: boolean
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`agent-decision-skeleton-${index}`}
          className={`rounded-lg bg-muted/50 ${compact ? "px-4 py-4" : "px-4 py-3"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-10" />
                <Skeleton className={`h-4 max-w-full ${compact ? "w-32" : "w-56"}`} />
              </div>
              {compact && (
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-px" />
                  <Skeleton className="h-3 w-10" />
                </div>
              )}
            </div>
            <div className={`flex items-center gap-1.5 shrink-0 ${compact ? "pt-0" : "pt-0.5"}`}>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className={`${compact ? "h-6 w-24" : "h-5 w-14"} rounded-full`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AgentAlertListSkeleton({
  rows = 4,
  compact = false,
}: {
  rows?: number
  compact?: boolean
}) {
  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`agent-alert-skeleton-${index}`}
          className={`rounded-lg bg-muted/50 ${compact ? "px-4 py-4" : "px-3 py-2.5"}`}
        >
          <div className={`flex ${compact ? "items-center" : "items-start"} gap-3`}>
            <Skeleton className="h-4 w-4 rounded-full shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              {compact ? (
                <>
                  <Skeleton className="h-4 w-[92%] max-w-full" />
                  <Skeleton className="h-4 w-[88%] max-w-full" />
                  <Skeleton className="h-4 w-[90%] max-w-full" />
                  <Skeleton className="h-4 w-[72%] max-w-full" />
                </>
              ) : (
                <>
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-3 w-32" />
                </>
              )}
            </div>
            {compact ? (
              <Skeleton className="h-6 w-6 rounded-md shrink-0" />
            ) : (
              <>
                <Skeleton className="h-3 w-16 shrink-0" />
                <Skeleton className="h-6 w-6 rounded-md shrink-0" />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function AgentRecentSessionsSkeleton() {
  return (
    <div className="pb-2 space-y-1.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={`agent-session-skeleton-${index}`} className="rounded-lg">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AgentOverviewKpiSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={`agent-kpi-skeleton-${index}`} className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2 min-w-0 flex-1">
                <Skeleton className="h-3 w-24" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  )
}

export function AgentChartCardSkeleton({
  title,
  height = "h-[280px]",
}: {
  title: string
  height?: string
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-card-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Skeleton className={`w-full ${height} rounded-lg`} />
      </CardContent>
    </Card>
  )
}

export function AgentDecisionStatusSkeleton() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-card-foreground">Decision Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="relative flex h-[140px] w-[140px] items-center justify-center">
            <Skeleton className="h-[140px] w-[140px] rounded-full" />
            <div className="absolute flex h-[70px] w-[70px] flex-col items-center justify-center rounded-full bg-card">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="mt-2 h-3 w-8" />
            </div>
          </div>
          <div className="min-w-[116px] flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-px w-full" />
            <div className="pt-1">
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AgentCampaignPerformanceSkeleton({ rows = 10 }: { rows?: number }) {
  const widths = ["w-[92%]", "w-[92%]", "w-[91%]", "w-[90%]", "w-[89%]", "w-[88%]", "w-[87%]", "w-[86%]", "w-[85%]", "w-[85%]"]

  return (
    <Card className="relative overflow-hidden bg-card border-border">
      <CardHeader className="relative pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium text-card-foreground">Campaign Performance</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <p className="text-xs text-muted-foreground">Top 10 by ROAS</p>
        <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-3 items-center">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={`agent-campaign-row-${index}`} className="contents">
              <Skeleton
                className={`h-4 ${index % 3 === 0 ? "w-24" : index % 3 === 1 ? "w-28" : "w-20"} justify-self-end`}
              />
              <div className="relative h-7">
                {index === 0 && <div className="absolute inset-y-0 left-0 w-px bg-border" />}
                <Skeleton className={`h-7 rounded-r-md rounded-l-none ${widths[index] || "w-[84%]"}`} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function AgentSpreadsheetTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[minmax(200px,2.4fr)_1fr_repeat(5,minmax(72px,1fr))] gap-4 border-b border-border bg-muted/30 px-4 py-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-10 justify-self-end" />
        <Skeleton className="h-4 w-14 justify-self-end" />
        <Skeleton className="h-4 w-10 justify-self-end" />
        <Skeleton className="h-4 w-8 justify-self-end" />
        <Skeleton className="h-4 w-12 justify-self-end" />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`agent-table-row-${rowIndex}`}
            className="grid grid-cols-[minmax(200px,2.4fr)_1fr_repeat(5,minmax(72px,1fr))] items-center gap-4"
          >
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-14 justify-self-end" />
            <Skeleton className="h-4 w-16 justify-self-end" />
            <Skeleton className="h-4 w-10 justify-self-end" />
            <Skeleton className="h-4 w-10 justify-self-end" />
            <Skeleton className="h-4 w-12 justify-self-end" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(200px,2.4fr)_1fr_repeat(5,minmax(72px,1fr))] items-center gap-4 border-t border-border bg-muted/25 px-4 py-3">
        <Skeleton className="h-4 w-28" />
        <div />
        <Skeleton className="h-4 w-14 justify-self-end" />
        <Skeleton className="h-4 w-16 justify-self-end" />
        <Skeleton className="h-4 w-10 justify-self-end" />
        <Skeleton className="h-4 w-10 justify-self-end" />
        <Skeleton className="h-4 w-12 justify-self-end" />
      </div>
    </div>
  )
}

export function AgentDecisionDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton
                key={`agent-validation-skeleton-${index}`}
                className={`h-6 rounded-full ${index % 3 === 0 ? "w-28" : index % 3 === 1 ? "w-24" : "w-32"}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-28 w-full" />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-7 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={`agent-signal-row-${index}`} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-28 w-full" />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-7 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={`agent-option-row-${index}`} className="rounded-lg border border-border p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="mt-0.5 h-4 w-4 rounded-full shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="ml-auto h-5 w-5 rounded-md" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-px w-full" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export function AgentTaskBoardSkeleton() {
  const taskCounts = [4, 2, 3, 1]

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-[160px]" />
          <Skeleton className="h-10 w-[140px]" />
          <Skeleton className="h-10 w-[140px]" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden">
        {Array.from({ length: 4 }).map((_, columnIndex) => (
          <div key={`agent-task-column-${columnIndex}`} className="flex min-w-[280px] flex-1 flex-col rounded-lg bg-card/50">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: taskCounts[columnIndex] || 0 }).map((_, cardIndex) => (
                <div key={`agent-task-card-${columnIndex}-${cardIndex}`} className="rounded-lg border border-border bg-card p-3 space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-6 w-6 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AgentSettingsConnectionsSkeleton() {
  return (
    <div className="rounded-lg border border-border divide-y divide-border">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={`agent-settings-connection-${index}`} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-2.5 w-2.5 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

export function AgentWorkflowListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={`agent-workflow-skeleton-${index}`} className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2 min-w-0 flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AgentWorkflowStepsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="pl-4 space-y-1 mt-1">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={`agent-workflow-step-skeleton-${index}`} className="flex items-start gap-2 rounded bg-muted/20 px-3 py-1.5">
          <Skeleton className="mt-0.5 h-3 w-6" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}
