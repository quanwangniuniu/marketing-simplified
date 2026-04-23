"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, AlertCircle, ChevronDown, ChevronUp, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
// AgentAPI removed — analysis results come from pipeline SSE

interface AnomalyCard {
  id: number
  severity: "critical" | "warning" | "info"
  title: string
  description: string
  selected: boolean
}

const severityConfig = {
  critical: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/5", border: "border-red-500/20" },
  warning: { icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-500/5", border: "border-amber-500/20" },
  info: { icon: AlertCircle, color: "text-blue-400", bg: "bg-blue-500/5", border: "border-blue-500/20" },
}

function mapSeverity(s: string): "critical" | "warning" | "info" {
  if (s === "critical") return "critical"
  if (s === "high") return "warning"
  return "info"
}

interface AnalysisResultsProps {
  filename: string
  loading?: boolean
}

export function AnalysisResults({ filename, loading: loadingOverride = false }: AnalysisResultsProps) {
  const [expanded, setExpanded] = useState(true)
  const [anomalies, setAnomalies] = useState<AnomalyCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Report summary endpoint removed — analysis results come from pipeline SSE in Phase 2
    setLoading(false)
  }, [filename])

  const toggleSelection = (id: number) => {
    setAnomalies((prev) =>
      prev.map((a) => (a.id === id ? { ...a, selected: !a.selected } : a))
    )
  }

  const dismissAnomaly = (id: number) => {
    setAnomalies((prev) => prev.filter((a) => a.id !== id))
  }

  const selectedCount = anomalies.filter((a) => a.selected).length
  const isLoading = loadingOverride || loading

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full"
        >
            <CardTitle className="text-sm font-medium text-card-foreground">
              AI Analysis Results
            </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {isLoading ? " " : `${anomalies.length} findings`}
            </span>
            {isLoading && <Skeleton className="h-3 w-16" />}
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              {Array.from({ length: 2 }, (_, index) => (
                <div
                  key={`analysis-loading-card-${index}`}
                  className="rounded-lg border border-border bg-muted/10 p-3"
                >
                  <div className="flex items-start gap-2">
                    <Skeleton className="mt-0.5 h-4 w-4 rounded-full" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-8/12" />
                    </div>
                  </div>
                </div>
              ))}
              <Skeleton className="h-10 w-full rounded-md" />
            </>
          ) : anomalies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No anomalies detected</p>
          ) : (
            anomalies.map((anomaly) => {
              const config = severityConfig[anomaly.severity]
              const Icon = config.icon
              return (
                <div
                  key={anomaly.id}
                  className={`rounded-lg border ${config.border} ${config.bg} p-3`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{anomaly.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{anomaly.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={anomaly.selected}
                            onChange={() => toggleSelection(anomaly.id)}
                            className="rounded border-input bg-muted text-blue-500 focus:ring-blue-500 focus:ring-offset-0 w-3.5 h-3.5"
                          />
                          <span className="text-xs text-muted-foreground">Include in Decision</span>
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-muted-foreground hover:text-card-foreground px-2"
                          onClick={() => dismissAnomaly(anomaly.id)}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {selectedCount > 0 && (
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm">
              Create Decision from {selectedCount} Selected
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}
