"use client"

import { useEffect, useRef } from "react"
import { Bot, User, FileSpreadsheet, ArrowRight, CalendarPlus, UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AGENT_MESSAGES } from "@/lib/agentMessages"
import { AnomalyCard } from "./AnomalyCard"
import { ColumnMappingCard } from "./ColumnMappingCard"
import { DecisionCard } from "./DecisionCard"
import { FollowUpCard } from "./FollowUpCard"
import { MiroGenerateCard } from "./MiroGenerateCard"
import { DistributeMessageCard } from "./DistributeMessageCard"
import { TaskListCard } from "./TaskListCard"
import type { AnomalyItem, SuggestedDecision, RecommendedTask, WorkflowStepState, ColumnDetectionData } from "@/types/agent"
import { StepProgress, type StepProgressItem } from "./StepProgress"

export type ChatMessageType = "text" | "analysis" | "file_uploaded" | "decision_created" | "tasks_created" | "miro_status" | "step_progress" | "error" | "calendar_invite" | "column_mapping"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  type?: ChatMessageType
  isFollowUpPrompt?: boolean
  anomalies?: AnomalyItem[]
  suggestedDecision?: SuggestedDecision
  recommendedTasks?: RecommendedTask[]
  columnMappingData?: ColumnDetectionData
  fileName?: string
  navigateTo?: string
  navigateLabel?: string
  navigateDisabled?: boolean
  navigateHref?: string
  eventType?: string
  workflowRunId?: string
  decisionId?: number
  stepProgress?: StepProgressItem[]
}

interface MessageListProps {
  messages: ChatMessage[]
  onAction?: (action: string) => void
  onNavigate?: (view: string, message?: ChatMessage) => void
  onConfirmColumns?: (mapping: Record<string, string>) => void
  onReupload?: () => void
  latestAnalysisMessageId?: string | null
  showFollowUpToggle?: boolean
  followUpActive?: boolean
  stepState?: WorkflowStepState
}

export function MessageList({
  messages,
  onAction,
  onNavigate,
  onConfirmColumns,
  onReupload,
  latestAnalysisMessageId,
  showFollowUpToggle,
  followUpActive,
  stepState,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "flex gap-3",
            message.role === "user" && "flex-row-reverse"
          )}
        >
          {/* Avatar */}
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5",
              message.role === "assistant" ? "bg-primary/20" : "bg-muted"
            )}
          >
            {message.role === "assistant" ? (
              <Bot className="h-4 w-4 text-primary" />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {/* Content */}
          <div className={cn("max-w-[80%] space-y-2", message.role === "user" && "items-end")}>
            {/* File uploaded indicator */}
            {message.type === "file_uploaded" && message.fileName && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">{message.fileName}</span>
              </div>
            )}

            {/* Text bubble — hidden for calendar_invite which renders its own card */}
            {message.content && message.type !== "calendar_invite" && (
              <div
                className={cn(
                  "rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap",
                  message.role === "assistant"
                    ? "bg-muted text-foreground"
                    : "bg-primary text-primary-foreground",
                  message.role === "assistant" && message.content === AGENT_MESSAGES.CHAT_THINKING && "animate-pulse"
                )}
              >
                {message.content}
              </div>
            )}

            {/* Step progress */}
            {message.stepProgress && message.stepProgress.length > 0 && (
              <StepProgress steps={message.stepProgress} />
            )}

            {/* Navigation button */}
            {message.navigateTo && message.navigateLabel && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={message.navigateDisabled}
                onClick={() => onNavigate?.(message.navigateTo!, message)}
              >
                {message.navigateLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Calendar invite prompt */}
            {message.type === "calendar_invite" && (
              <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                <CalendarPlus className="h-4 w-4 shrink-0 text-violet-600" />
                <span className="text-sm text-violet-800">{message.content}</span>
              </div>
            )}


            {/* Column mapping is handled silently — stored in DB, not shown to user */}

            {/* Analysis result cards — progressive gating */}
            {message.anomalies && message.anomalies.length > 0 && (
              <AnomalyCard anomalies={message.anomalies} />
            )}

            {/* DecisionCard: show when analysis complete and decision not yet created (or no stepState = backward compat) */}
            {message.suggestedDecision && (!stepState || (stepState.analysisComplete && !stepState.decisionCreated)) && (
              <DecisionCard
                decision={message.suggestedDecision}
                onCreateDecision={() => onAction?.("confirm_decision")}
                onDismiss={() => {}}
              />
            )}

            {/* TaskListCard:
                - On analysis messages: show only BEFORE decision is created (decision card is still active)
                - On decision_created messages: show AFTER decision created but before tasks created
                This prevents the card from appearing twice when both message types have recommendedTasks. */}
            {message.recommendedTasks && message.recommendedTasks.length > 0 && (
              (message.type === "decision_created" && (!stepState || (stepState.decisionCreated && !stepState.tasksCreated))) ||
              (message.type !== "decision_created" && (!stepState || (stepState.decisionCreated && !stepState.tasksCreated)) && !stepState?.decisionCreated)
            ) && (
              <TaskListCard
                tasks={message.recommendedTasks}
                onCreateAll={() => onAction?.("create_tasks")}
              />
            )}

            {/* MiroGenerateCard + DistributeMessageCard: only on decision_created message, after tasks created */}
            {message.type === "decision_created" && message.recommendedTasks && message.recommendedTasks.length > 0 && (!stepState || stepState.tasksCreated) && (
              <MiroGenerateCard onGenerate={() => onAction?.("generate_miro")} />
            )}

            {message.type === "decision_created" && message.recommendedTasks && message.recommendedTasks.length > 0 && (!stepState || stepState.tasksCreated) && (
              <DistributeMessageCard onDistribute={() => onAction?.("distribute_message")} />
            )}

            {showFollowUpToggle && message.id === latestAnalysisMessageId && (!stepState || stepState.tasksCreated) && (
              <FollowUpCard
                active={followUpActive}
                onToggle={() => onAction?.(followUpActive ? "cancel_follow_up" : "start_follow_up")}
              />
            )}
          </div>
        </div>
      ))}
      {stepState?.analysisComplete && (
        <div className="flex justify-center pt-2 pb-1">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={() => onReupload?.()}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Upload New File
          </Button>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
