"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function AgentListSkeleton({
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
          key={`agent-list-skeleton-${index}`}
          className={`rounded-lg bg-muted/50 ${compact ? "px-3 py-2.5" : "px-4 py-3"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-4 w-40 max-w-full" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AgentRecentSessionsSkeleton() {
  return (
    <div className="px-2 pb-2 space-y-1.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={`agent-session-skeleton-${index}`} className="rounded-lg bg-muted/40 px-3 py-2.5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 max-w-full" />
            <Skeleton className="h-3 w-16" />
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

export function AgentSpreadsheetHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 pb-4 border-b border-border">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-[280px]" />
        <Skeleton className="h-9 w-9" />
      </div>
      <Skeleton className="h-8 w-32" />
    </div>
  )
}

export function AgentSpreadsheetTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-7 gap-4 border-b border-border bg-muted/30 px-4 py-3">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={`agent-table-head-${index}`} className="h-4 w-full" />
        ))}
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`agent-table-row-${rowIndex}`} className="grid grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, colIndex) => (
              <Skeleton key={`agent-table-row-${rowIndex}-${colIndex}`} className="h-5 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function AgentAnalysisCardSkeleton() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`agent-analysis-skeleton-${index}`} className="rounded-lg border border-border p-3 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function AgentDecisionDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={`agent-validation-skeleton-${index}`} className="h-6 w-24 rounded-full" />
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
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>

      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={`agent-editor-section-${index}`} className="bg-card border-border">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function AgentTaskBoardSkeleton() {
  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-[160px]" />
          <Skeleton className="h-10 w-[140px]" />
          <Skeleton className="h-10 w-[140px]" />
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
              {Array.from({ length: 4 }).map((_, cardIndex) => (
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
