"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { PieChart, Pie, Cell, Label } from "recharts"
import { AgentAPI } from "@/lib/api/agentApi"
import { AgentDecisionStatusSkeleton } from "@/components/agent/skeletons/AgentSkeletons"
import { withMinimumDelay } from "@/lib/agentLoading"

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#52525b" },
  awaiting_approval: { label: "Awaiting Approval", color: "#f59e0b" },
  committed: { label: "Committed", color: "#3b82f6" },
  reviewed: { label: "Reviewed", color: "#22c55e" },
  archived: { label: "Archived", color: "#a855f7" },
}

const chartConfig = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([key, val]) => [key, { label: val.label, color: val.color }])
) satisfies ChartConfig

export function TaskStatusChart() {
  const [data, setData] = useState<{ name: string; value: number; color: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const stats = await withMinimumDelay(AgentAPI.fetchDecisionStats())
        if (cancelled) return
        const chartData = Object.entries(stats)
          .filter(([, count]) => (count as number) > 0)
          .map(([status, count]) => ({
            name: status,
            value: count as number,
            color: STATUS_CONFIG[status]?.color || "#52525b",
          }))
        setData(chartData)
      } catch {
        // keep empty on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (loading) {
    return <AgentDecisionStatusSkeleton />
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-card-foreground">Decision Status</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[140px] flex items-center justify-center text-muted-foreground text-sm">
            No decisions yet
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-[140px] h-[140px]">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {data.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text
                              x={viewBox.cx}
                              y={viewBox.cy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              <tspan
                                x={viewBox.cx}
                                y={viewBox.cy}
                                className="fill-foreground text-2xl font-bold"
                              >
                                {total}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 16}
                                className="fill-muted-foreground text-[10px]"
                              >
                                Total
                              </tspan>
                            </text>
                          )
                        }
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
            </div>
            <div className="space-y-2">
              {data.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {STATUS_CONFIG[item.name]?.label || item.name}
                  </span>
                  <span className="text-xs font-semibold text-foreground ml-auto">{item.value}</span>
                </div>
              ))}
              <div className="pt-1 border-t border-border">
                <span className="text-xs text-muted-foreground">Total: {total}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
