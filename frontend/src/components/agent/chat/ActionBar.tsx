"use client"

import { UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WorkflowStepState } from "@/types/agent"

interface ActionBarProps {
  stepState: WorkflowStepState
  onReupload?: () => void
  disabled?: boolean
}

export function ActionBar({ stepState, onReupload, disabled }: ActionBarProps) {
  if (!stepState.analysisComplete) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-muted/50">
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5 text-xs ml-auto text-muted-foreground"
        disabled={disabled}
        onClick={() => onReupload?.()}
      >
        <UploadCloud className="h-3.5 w-3.5" />
        Upload New File
      </Button>
    </div>
  )
}
