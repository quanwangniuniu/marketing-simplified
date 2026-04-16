"use client"

import { FileCheck, ListTodo, LayoutTemplate, Send, UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WorkflowStepState } from "@/types/agent"

interface ActionBarProps {
  stepState: WorkflowStepState
  onAction: (action: string) => void
  onReupload?: () => void
  disabled?: boolean
}

export function ActionBar({ stepState, onAction, onReupload, disabled }: ActionBarProps) {
  if (!stepState.analysisComplete) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-muted/50">
      {!stepState.decisionCreated && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          disabled={disabled}
          onClick={() => onAction("confirm_decision")}
        >
          <FileCheck className="h-3.5 w-3.5" />
          Create Decision
        </Button>
      )}

      {stepState.decisionCreated && !stepState.tasksCreated && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          disabled={disabled}
          onClick={() => onAction("create_tasks")}
        >
          <ListTodo className="h-3.5 w-3.5" />
          Create Tasks
        </Button>
      )}

      {stepState.tasksCreated && (
        <>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            disabled={disabled}
            onClick={() => onAction("generate_miro")}
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            Generate Miro
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            disabled={disabled}
            onClick={() => onAction("distribute_message")}
          >
            <Send className="h-3.5 w-3.5" />
            Distribute Message
          </Button>
        </>
      )}

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
