"use client"

import { useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AgentAPI } from "@/lib/api/agentApi"
import { AgentSpreadsheetTableSkeleton } from "@/components/agent/skeletons/AgentSkeletons"
import { withMinimumDelay } from "@/lib/agentLoading"

interface AdRow {
  name: string
  status: string
  cost: number
  revenue: number
  roas: number
  roi: number
  clicks: number
}

function getRoasColor(roas: number): string {
  if (roas >= 2.0) return "text-emerald-400"
  if (roas >= 1.0) return "text-amber-400"
  return "text-red-400"
}

function getRoiColor(roi: number): string {
  if (roi >= 100) return "text-emerald-400"
  if (roi >= 0) return "text-amber-400"
  return "text-red-400"
}

interface DataTableProps {
  fileId: string
  loading?: boolean
}

export function DataTable({ fileId, loading = false }: DataTableProps) {
  const [data, setData] = useState<AdRow[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (loading) {
      return
    }
    if (!fileId) {
      setDataLoading(false)
      setData([])
      return
    }
    let cancelled = false
    setDataLoading(true)
    async function load() {
      try {
        const report = await withMinimumDelay(AgentAPI.fetchReportData(fileId))
        if (cancelled) return
        const rows: AdRow[] = report.rows.map((r: Record<string, unknown>) => ({
          name: (r['Name'] as string) || 'Unknown',
          status: (r['Status'] as string) || '-',
          cost: typeof r['Cost'] === 'number' ? r['Cost'] : 0,
          revenue: typeof r['Total Revenue'] === 'number' ? r['Total Revenue'] : (typeof r['Revenue'] === 'number' ? r['Revenue'] as number : 0),
          roas: typeof r['ROAS'] === 'number' ? r['ROAS'] : 0,
          roi: typeof r['ROI'] === 'number' ? r['ROI'] : 0,
          clicks: typeof r['Clicks'] === 'number' ? r['Clicks'] : 0,
        }))
        setData(rows)
      } catch {
        setData([])
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [fileId, loading])

  const isLoading = loading || dataLoading

  const totals = data.reduce(
    (acc, row) => ({
      cost: acc.cost + row.cost,
      revenue: acc.revenue + row.revenue,
      clicks: acc.clicks + row.clicks,
    }),
    { cost: 0, revenue: 0, clicks: 0 }
  )
  const avgRoas = totals.cost > 0 ? totals.revenue / totals.cost : 0
  const avgRoi = totals.cost > 0 ? ((totals.revenue - totals.cost) / totals.cost) * 100 : 0

  if (isLoading) {
    return <AgentSpreadsheetTableSkeleton />
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border p-8 text-center text-muted-foreground text-sm">
        No data available. Select a CSV file or import one.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground font-medium min-w-[200px]">Campaign Name</TableHead>
            <TableHead className="text-muted-foreground font-medium">Status</TableHead>
            <TableHead className="text-muted-foreground font-medium text-right">Cost</TableHead>
            <TableHead className="text-muted-foreground font-medium text-right">Revenue</TableHead>
            <TableHead className="text-muted-foreground font-medium text-right">ROAS</TableHead>
            <TableHead className="text-muted-foreground font-medium text-right">ROI</TableHead>
            <TableHead className="text-muted-foreground font-medium text-right">Clicks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={`${row.name}-${i}`} className="border-border hover:bg-muted/50">
              <TableCell className="font-medium text-foreground">{row.name}</TableCell>
              <TableCell>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    row.status === "ACTIVE" || row.status === "Active"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {row.status}
                </span>
              </TableCell>
              <TableCell className="text-right text-card-foreground">
                ${row.cost.toLocaleString()}
              </TableCell>
              <TableCell className="text-right text-card-foreground">
                ${row.revenue.toLocaleString()}
              </TableCell>
              <TableCell className={`text-right font-medium ${getRoasColor(row.roas)}`}>
                {row.roas.toFixed(2)}x
              </TableCell>
              <TableCell className={`text-right font-medium ${getRoiColor(row.roi)}`}>
                {row.roi >= 0 ? "+" : ""}{row.roi.toFixed(0)}%
              </TableCell>
              <TableCell className="text-right text-card-foreground">
                {row.clicks.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter className="bg-muted/50 border-input">
          <TableRow className="hover:bg-muted/70">
            <TableCell className="font-semibold text-foreground">Total / Average</TableCell>
            <TableCell />
            <TableCell className="text-right font-semibold text-foreground">
              ${totals.cost.toLocaleString()}
            </TableCell>
            <TableCell className="text-right font-semibold text-foreground">
              ${totals.revenue.toLocaleString()}
            </TableCell>
            <TableCell className={`text-right font-semibold ${getRoasColor(avgRoas)}`}>
              {avgRoas.toFixed(2)}x
            </TableCell>
            <TableCell className={`text-right font-semibold ${getRoiColor(avgRoi)}`}>
              {avgRoi >= 0 ? "+" : ""}{avgRoi.toFixed(0)}%
            </TableCell>
            <TableCell className="text-right font-semibold text-foreground">
              {totals.clicks.toLocaleString()}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
