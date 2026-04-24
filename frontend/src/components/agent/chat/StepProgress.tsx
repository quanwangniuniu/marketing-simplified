"use client"

import { Check, Loader2, Circle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StepExecutionStatus } from "@/types/agent"

export interface StepProgressItem {
  order: number
  name: string
  status: StepExecutionStatus
}

interface StepProgressProps {
  steps: StepProgressItem[]
  className?: string
}

const statusConfig: Record<StepExecutionStatus, {
  icon: React.ElementType
  color: string
  animate?: boolean
}> = {
  completed: { icon: Check, color: "text-emerald-500" },
  running: { icon: Loader2, color: "text-blue-500", animate: true },
  pending: { icon: Circle, color: "text-muted-foreground/40" },
  failed: { icon: Circle, color: "text-red-500" },
  skipped: { icon: Circle, color: "text-muted-foreground/30" },
  awaiting: { icon: Clock, color: "text-amber-500" },
}

export function StepProgress({ steps, className }: StepProgressProps) {
  if (steps.length === 0) return null

  return (
    <div className={cn("flex items-center gap-1 py-2 px-3 rounded-lg bg-muted/30 border border-border overflow-x-auto scrollbar-none", className)}>
      {steps.map((step, idx) => {
        const config = statusConfig[step.status] || statusConfig.pending
        const Icon = config.icon

        return (
          <div key={step.order} className="flex items-center gap-1">
            <div className="flex items-center gap-1" title={`${step.name} — ${step.status}`}>
              <Icon
                className={cn(
                  "h-3.5 w-3.5",
                  config.color,
                  config.animate && "animate-spin"
                )}
              />
              <span className={cn(
                "text-[11px] hidden sm:inline",
                step.status === "running" ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                {step.name}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={cn(
                "w-4 h-px mx-0.5",
                step.status === "completed" ? "bg-emerald-500/40" : "bg-border"
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
