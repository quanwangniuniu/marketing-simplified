"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import { Bot, User, FileSpreadsheet, ArrowRight, CalendarPlus, UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AGENT_MESSAGES } from "@/lib/agentMessages"
import { AnomalyCard } from "./AnomalyCard"
import { ColumnMappingCard } from "./ColumnMappingCard"
import { FollowUpCard } from "./FollowUpCard"
import { MiroGenerateCard } from "./MiroGenerateCard"
import { DistributeMessageCard } from "./DistributeMessageCard"
import { TaskListCard } from "./TaskListCard"
import { RecommendedMiroBoardCard } from "./RecommendedMiroBoardCard"
import type { AnomalyItem, RecommendedTask, WorkflowStepState, ColumnDetectionData } from "@/types/agent"
import { StepProgress, type StepProgressItem } from "./StepProgress"
import type { PendingExternalApproval } from "./ExternalApprovalModal"
import type { TaskGenerationStatus } from "./TaskListCard"

export type ChatMessageType =
  | "text"
  | "analysis"
  | "file_uploaded"
  | "tasks_created"
  | "miro_status"
  | "step_progress"
  | "error"
  | "calendar_invite"
  | "column_mapping"
  | "approval_request"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  type?: ChatMessageType
  isFollowUpPrompt?: boolean
  anomalies?: AnomalyItem[]
  recommendedTasks?: RecommendedTask[]
  columnMappingData?: ColumnDetectionData
  fileName?: string
  navigateTo?: string
  navigateLabel?: string
  navigateDisabled?: boolean
  navigateHref?: string
  eventType?: string
  workflowRunId?: string
  stepProgress?: StepProgressItem[]
  approval?: PendingExternalApproval
}

export interface MessageListProps {
  messages: ChatMessage[]
  onAction?: (action: string) => void
  onNavigate?: (view: string, message?: ChatMessage) => void
  onConfirmColumns?: (mapping: Record<string, string>) => void
  onReupload?: () => void
  sessionId?: string | null
  approvalDisabled?: boolean
  approvalRequired?: boolean
  generatedTaskIndexes?: number[]
  skippedTaskIndexes?: number[]
  createdTaskIdByIndex?: Record<number, number>
  generatingTasks?: boolean
  pendingTaskApproval?: PendingExternalApproval | null
  selectedTaskIndexes?: number[]
  onSelectedTaskIndexesChange?: (next: number[]) => void
  tasksApprovalGenerating?: boolean
  onApproveSelectedTasks?: (selectedIndexes: number[], destination?: Record<string, unknown>) => void
  onRejectTasksApproval?: () => void
  pendingMiroApproval?: PendingExternalApproval | null
  miroApprovalGenerating?: boolean
  onApproveMiroApproval?: (destination?: Record<string, unknown>) => void
  onRejectMiroApproval?: () => void
  latestAnalysisMessageId?: string | null
  showFollowUpToggle?: boolean
  followUpActive?: boolean
  stepState?: WorkflowStepState
  taskGenerationStatus?: TaskGenerationStatus
}

export function MessageList({
  messages,
  onAction,
  onNavigate,
  onConfirmColumns,
  onReupload,
  sessionId,
  approvalDisabled,
  approvalRequired,
  generatedTaskIndexes,
  skippedTaskIndexes,
  createdTaskIdByIndex,
  generatingTasks,
  pendingTaskApproval,
  selectedTaskIndexes,
  onSelectedTaskIndexesChange,
  tasksApprovalGenerating,
  onApproveSelectedTasks,
  onRejectTasksApproval,
  pendingMiroApproval,
  miroApprovalGenerating,
  onApproveMiroApproval,
  onRejectMiroApproval,
  latestAnalysisMessageId,
  showFollowUpToggle,
  followUpActive,
  stepState,
  taskGenerationStatus,
}: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevScrollTopRef = useRef(0)
  const prevScrollHeightRef = useRef(0)
  const wasAtBottomRef = useRef(true)
  const latestAnalysisWithTasks = [...messages]
    .reverse()
    .find((m) => m.type === "analysis" && Array.isArray(m.recommendedTasks) && m.recommendedTasks.length > 0)
  const canSelectRecommendedTasks =
    (taskGenerationStatus === "idle" || taskGenerationStatus === "awaiting_approval") &&
    !tasksApprovalGenerating &&
    !generatingTasks &&
    !stepState?.tasksCreated
  const taskSelectionMode =
    canSelectRecommendedTasks &&
    (Boolean(pendingTaskApproval) ||
      (Boolean(approvalRequired) &&
        Boolean(stepState?.analysisComplete) &&
        !stepState?.tasksCreated))

  // Track whether the user is currently at (or near) the bottom.
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const thresholdPx = 24
    const update = () => {
      const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight)
      wasAtBottomRef.current = distanceFromBottom <= thresholdPx
      prevScrollTopRef.current = el.scrollTop
      prevScrollHeightRef.current = el.scrollHeight
    }

    update()
    el.addEventListener("scroll", update, { passive: true })
    return () => el.removeEventListener("scroll", update)
  }, [])

  // On new messages:
  // - if user is at bottom, keep them at bottom
  // - otherwise, preserve their viewport position (so new messages don't jump the scroll)
  useLayoutEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const prevScrollTop = prevScrollTopRef.current
    const prevScrollHeight = prevScrollHeightRef.current
    const nextScrollHeight = el.scrollHeight

    if (wasAtBottomRef.current) {
      el.scrollTop = nextScrollHeight
    } else {
      const delta = nextScrollHeight - prevScrollHeight
      if (Number.isFinite(delta) && delta !== 0) {
        el.scrollTop = prevScrollTop + delta
      }
    }

    prevScrollTopRef.current = el.scrollTop
    prevScrollHeightRef.current = el.scrollHeight
  }, [messages])

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((message) => (
        message.type === "approval_request" ? null : (
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

            {/* TaskListCard: primary review surface. Prefer rendering on analysis messages. */}
            {message.recommendedTasks &&
              message.recommendedTasks.length > 0 &&
              message.type === "analysis" && (
                <TaskListCard
                  tasks={message.recommendedTasks}
                  approvalRequired={approvalRequired}
                  generatedTaskIndexes={generatedTaskIndexes}
                  skippedTaskIndexes={skippedTaskIndexes}
                  createdTaskIdByIndex={createdTaskIdByIndex}
                  generating={Boolean(tasksApprovalGenerating) || Boolean(generatingTasks)}
                  generationStatus={taskGenerationStatus}
                  approvalMode={Boolean(pendingTaskApproval)}
                  selectionMode={taskSelectionMode}
                  selectedIndexes={selectedTaskIndexes}
                  onSelectedIndexesChange={onSelectedTaskIndexesChange}
                  onCreateSelected={pendingTaskApproval ? onApproveSelectedTasks : undefined}
                  createButtonDisabled={Boolean(approvalDisabled) || Boolean(tasksApprovalGenerating)}
                  onCreateAll={
                    !approvalRequired &&
                    !pendingTaskApproval &&
                    stepState?.analysisComplete &&
                    !stepState?.tasksCreated
                      ? () => onAction?.("create_tasks")
                      : undefined
                  }
                />
              )}

            {showFollowUpToggle && message.id === latestAnalysisMessageId && (!stepState || stepState.tasksCreated) && (
              <FollowUpCard
                active={followUpActive}
                onToggle={() => onAction?.(followUpActive ? "cancel_follow_up" : "start_follow_up")}
              />
            )}
          </div>
        </div>
        )
      ))}

      {/* Action cards shown at the bottom so they're immediately visible after task creation. */}
      {latestAnalysisWithTasks &&
        (Boolean(stepState?.tasksCreated) || Boolean(pendingTaskApproval) || taskGenerationStatus === "awaiting_approval") && (
        <div className="space-y-3">
          <MiroGenerateCard
            onGenerate={() => onAction?.("generate_miro")}
            disabled={!Boolean(stepState?.tasksCreated) && Boolean(approvalRequired)}
            disabledHint={
              !Boolean(stepState?.tasksCreated) && Boolean(approvalRequired)
                ? "Approve task creation to enable Miro generation."
                : undefined
            }
          />
          <DistributeMessageCard onDistribute={() => onAction?.("distribute_message")} />
        </div>
      )}

      {pendingMiroApproval && (
        <RecommendedMiroBoardCard
          pending={pendingMiroApproval}
          disabled={Boolean(approvalDisabled)}
          generating={Boolean(miroApprovalGenerating)}
          onApprove={onApproveMiroApproval}
          onReject={onRejectMiroApproval}
        />
      )}

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
    </div>
  )
}
