"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { AGENT_MESSAGES } from "@/lib/agentMessages"
import { DecorativeGlow } from "@/components/ui/decorative-glow"
import { AgentChartCardSkeleton } from "@/components/agent/skeletons/AgentSkeletons"

interface TrendPoint {
  date: string
  roas: number
  cost: number
  revenue: number
}

const chartConfig = {
  roas: {
    label: "ROAS",
    color: "#3b82f6",
  },
  cost: {
    label: "Cost",
    color: "#ef4444",
  },
  revenue: {
    label: "Revenue",
    color: "#22c55e",
  },
} satisfies ChartConfig

export function PerformanceChart() {
  const [data, setData] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Data report endpoints removed — chart will populate once new analysis flow is integrated
    setLoading(false)
  }, [])

  if (loading) {
    return <AgentChartCardSkeleton title="Performance Trend" />
  }

  return (
    <Card className="relative overflow-hidden bg-card border-border">
      <DecorativeGlow variant="subtle" />
      <CardHeader className="relative pb-2">
        <CardTitle className="text-sm font-medium text-card-foreground">Performance Trend</CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="h-[280px]">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              {AGENT_MESSAGES.EMPTY_PERFORMANCE_CHART}
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-full w-full">
              <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}x`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="roas"
                  name="ROAS"
                  stroke="var(--color-roas)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cost"
                  name="Cost"
                  stroke="var(--color-cost)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
