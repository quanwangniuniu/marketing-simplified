"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, AlertCircle, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DecorativeGlow } from "@/components/ui/decorative-glow"
import { AGENT_MESSAGES } from "@/lib/agentMessages"
import { AgentAlertListSkeleton } from "@/components/agent/skeletons/AgentSkeletons"

interface Alert {
  id: number
  severity: "critical" | "warning" | "info"
  metric: string
  campaign: string
  delta: string
}

interface AnomalyAlertsProps {
  anomalies: {
    type: string
    severity: string
    campaign: string
    description: string
    cost: number
    roas?: number
  }[]
  loading: boolean
  compact?: boolean
}

const severityStyles = {
  critical: {
    icon: AlertTriangle,
    iconColor: "text-red-400",
    deltaColor: "text-red-400",
  },
  warning: {
    icon: AlertCircle,
    iconColor: "text-amber-400",
    deltaColor: "text-amber-400",
  },
  info: {
    icon: AlertCircle,
    iconColor: "text-blue-400",
    deltaColor: "text-blue-400",
  },
}

function mapSeverity(s: string): "critical" | "warning" | "info" {
  if (s === "critical") return "critical"
  if (s === "high") return "warning"
  return "info"
}

const DISMISSED_KEY = "agent-dismissed-alerts"

function getDismissedKeys(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]")
  } catch {
    return []
  }
}

function addDismissedKey(key: string) {
  const keys = getDismissedKeys()
  if (!keys.includes(key)) {
    keys.push(key)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(keys))
  }
}

// Build a stable key from anomaly data so dismissals survive refresh
function alertKey(a: { campaign: string; description: string }): string {
  return `${a.campaign}::${a.description}`
}

export function AnomalyAlerts({ anomalies, loading, compact = false }: AnomalyAlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    if (anomalies.length > 0) {
      const dismissed = getDismissedKeys()
      setAlerts(
        anomalies
          .filter((a) => !dismissed.includes(alertKey(a)))
          .map((a, i) => ({
            id: i + 1,
            severity: mapSeverity(a.severity),
            metric: a.description,
            campaign: a.campaign,
            delta: a.roas !== undefined ? `ROAS: ${a.roas}` : a.cost != null ? `$${a.cost.toLocaleString()}` : "",
          }))
      )
    }
  }, [anomalies])

  const dismissAlert = (id: number) => {
    const target = alerts.find((a) => a.id === id)
    if (target) {
      addDismissedKey(alertKey({ campaign: target.campaign, description: target.metric }))
    }
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  const content = (
    <div className="space-y-1.5">
      {loading ? (
        <AgentAlertListSkeleton compact={compact} rows={compact ? 4 : 5} />
      ) : alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">{AGENT_MESSAGES.EMPTY_ANOMALY_ALERTS}</p>
      ) : (
        alerts.map((alert) => {
          const style = severityStyles[alert.severity]
          const Icon = style.icon
          return (
            <div
              key={alert.id}
              className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2"
            >
              <Icon className={cn("w-4 h-4 shrink-0", style.iconColor)} />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-foreground">{alert.metric}</span>
                <span className="text-xs text-muted-foreground ml-2">{alert.campaign}</span>
              </div>
              <span className={cn("text-xs font-medium shrink-0", style.deltaColor)}>
                {alert.delta}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-card-foreground shrink-0"
                onClick={() => dismissAlert(alert.id)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          )
        })
      )}
    </div>
  )

  if (compact) return content

  return (
    <Card className="relative overflow-hidden bg-card border-border">
      <DecorativeGlow variant="subtle" />
      <CardHeader className="relative pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-card-foreground">Anomaly Alerts</CardTitle>
          <span className="text-xs text-muted-foreground">{alerts.length} active</span>
        </div>
      </CardHeader>
      <CardContent className="relative">{content}</CardContent>
    </Card>
  )
}
