"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAgentLayout, type AgentView } from "@/components/agent/AgentLayoutContext"
import { WelcomeScreen } from "./WelcomeScreen"
import { MessageList, type ChatMessage } from "./MessageList"
import { ChatInput } from "./ChatInput"
import { ActionBar } from "./ActionBar"
import { ApprovalToggle } from "./ApprovalToggle"
import type { PendingExternalApproval } from "./ExternalApprovalModal"
import { AgentAPI } from "@/lib/api/agentApi"
import type { SSEEvent, AgentAction, AgentMessage, AnalysisResult, WorkflowStepState, ColumnDetectionData } from "@/types/agent"
import { AGENT_MESSAGES } from "@/lib/agentMessages"
import type { StepProgressItem } from "./StepProgress"
import type { TaskGenerationStatus } from "./TaskListCard"

function getPendingMiroWorkflowRunIds(messages: ChatMessage[]): string[] {
  // Only treat "miro_board_created" as done — a prior failure can be retried for the same
  // workflow_run_id, so "miro_generation_failed" must NOT stop the polling loop.
  const completed = new Set(
    messages
      .filter((message) => message.workflowRunId && message.eventType === "miro_board_created")
      .map((message) => message.workflowRunId as string)
  )

  return messages
    .filter((message) => message.eventType === "miro_generation_started" && message.workflowRunId)
    .map((message) => message.workflowRunId as string)
    .filter((workflowRunId) => !completed.has(workflowRunId))
}

/** Broadcast anomalies from restored messages to RightPanel Alerts. */
function broadcastRestoredAnomalies(messages: AgentMessage[]) {
  // Find the last message with anomalies and broadcast it
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].data?.anomalies) {
      window.dispatchEvent(new CustomEvent("agent:analysis-complete", {
        detail: { anomalies: messages[i].data!.anomalies }
      }))
      break
    }
  }
}

/** Restore a persisted AgentMessage into a ChatMessage with correct type & navigation. */
function restoreMessage(m: AgentMessage): ChatMessage {
  let type: ChatMessage["type"] = "text"
  let navigateTo: string | undefined
  let navigateLabel: string | undefined
  let navigateDisabled = false
  let navigateHref: string | undefined
  let approval: PendingExternalApproval | undefined
  const isFollowUpPrompt = m.message_type === "follow_up_prompt"


  const eventType = m.data?.event_type

  if (m.message_type === "calendar_invite") {
    type = "calendar_invite"
  } else if (eventType === "miro_generation_started") {
    type = "miro_status"
    navigateTo = "miro"
    navigateLabel = "Generating Miro..."
    navigateDisabled = true
  } else if (eventType === "miro_board_created" && m.data?.board_id) {
    type = "miro_status"
    navigateTo = "miro"
    navigateLabel = "Open Miro"
    navigateHref = `/miro/${m.data.board_id}`
  } else if (eventType === "miro_generation_failed") {
    type = "error"
  } else if (m.data?.anomalies) {
    type = "analysis"
  } else if (m.message_type === "task_created" || m.data?.task_ids) {
    // Check task_created BEFORE decision_draft — backend may include decision_id on task events
    type = "tasks_created"
    navigateTo = "tasks"
    navigateLabel = "Go to Tasks"
  } else if (m.message_type === "approval_request" && m.data?.approval_id) {
    type = "approval_request"
    approval = {
      id: String(m.data.approval_id),
      kind: String(m.data.kind ?? ""),
      draft: (m.data.draft as Record<string, unknown>) ?? {},
    }
  }

  return {
    id: String(m.id),
    role: m.role,
    content: m.content,
    type,
    isFollowUpPrompt,
    anomalies: m.data?.anomalies,
    recommendedTasks: m.data?.recommended_tasks,
    navigateTo,
    navigateLabel,
    navigateDisabled,
    navigateHref,
    eventType,
    workflowRunId: m.data?.workflow_run_id,
    approval,
  }
}

/** Matches backend `MIRO_LEGACY_BG_QUEUED_MESSAGE` (queued vs board-ready lines differ). */
const LEGACY_MIRO_QUEUED_FALLBACK =
  "Queued Miro board generation — we'll notify you here when the board is ready."

function dedupeMiroGenerationStartedMessages(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>()
  const out: ChatMessage[] = []
  for (const m of messages) {
    if (m.eventType === "miro_generation_started" && m.workflowRunId) {
      if (seen.has(m.workflowRunId)) continue
      seen.add(m.workflowRunId)
    }
    out.push(m)
  }
  return out
}

function mergeMiroGenerationStartedIntoMessages(
  prev: ChatMessage[],
  aiMsgId: string,
  patch: Pick<
    ChatMessage,
    | "content"
    | "type"
    | "navigateTo"
    | "navigateLabel"
    | "navigateDisabled"
    | "navigateHref"
    | "eventType"
    | "workflowRunId"
  >
): ChatMessage[] {
  const wrid = patch.workflowRunId
  const updated = prev.map((p) => (p.id === aiMsgId ? { ...p, ...patch } : p))
  const stripped =
    wrid != null && wrid !== ""
      ? updated.filter(
          (p) =>
            !(
              p.id !== aiMsgId &&
              p.workflowRunId === wrid &&
              p.eventType === "miro_generation_started"
            )
        )
      : updated
  return dedupeMiroGenerationStartedMessages(stripped)
}

type CalendarPreload = { message: string; context: Record<string, unknown> }

function appendMiroResultMessage(prev: ChatMessage[], event: SSEEvent): ChatMessage[] {
  if (event.type !== "miro_status") return prev
  const eventType = event.data?.event_type
  if (!eventType || (eventType !== "miro_board_created" && eventType !== "miro_generation_failed")) return prev

  const rawWr = event.data?.workflow_run_id
  const workflowRunId =
    typeof rawWr === "string" ? rawWr : rawWr != null ? String(rawWr) : undefined

  // Prevent duplicates when polling/restoring replays the same event
  const alreadyAdded = prev.some(
    (m) => m.eventType === eventType && (workflowRunId ? m.workflowRunId === workflowRunId : true)
  )
  if (alreadyAdded) return prev

  // Broadcast a right-panel dialog update (success/failure).
  // Keep this ephemeral (not persisted) and only emit once per terminal event.
  if (typeof window !== "undefined") {
    if (eventType === "miro_board_created" && event.data?.board_id) {
      window.dispatchEvent(new CustomEvent("agent:miro-status", {
        detail: {
          status: "success",
          boardId: String(event.data.board_id),
          workflowRunId,
        }
      }))
    } else if (eventType === "miro_generation_failed") {
      window.dispatchEvent(new CustomEvent("agent:miro-status", {
        detail: {
          status: "failed",
          workflowRunId,
        }
      }))
    }
  }

  if (eventType === "miro_board_created" && event.data?.board_id) {
    return [
      ...prev,
      {
        id: `miro-created-${workflowRunId ?? Date.now()}`,
        role: "assistant",
        content: event.content || "",
        type: "miro_status",
        navigateTo: "miro",
        navigateLabel: "Open Miro",
        navigateHref: `/miro/${event.data.board_id}`,
        eventType,
        workflowRunId,
      },
    ]
  }

  if (eventType === "miro_generation_failed") {
    return [
      ...prev,
      {
        id: `miro-failed-${workflowRunId ?? Date.now()}`,
        role: "assistant",
        content: event.content || "",
        type: "text",
        eventType,
        workflowRunId,
      },
    ]
  }

  return prev
}

// Module-level flag — persists across React StrictMode's unmount+remount cycles.
// Reset to false each time new calendar context is loaded so the auto-send fires once per navigation.
let _calendarAutoSendFired = false

function buildCalendarPreload(): CalendarPreload | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem("agent-calendar-context")
  if (!raw) return null
  sessionStorage.removeItem("agent-calendar-context")
  _calendarAutoSendFired = false  // new context arrived — allow one send
  try {
    const ctx = JSON.parse(raw)
    let message: string
    if (ctx.type === "event") {
      const start = new Date(ctx.startDatetime)
      const end = new Date(ctx.endDatetime)
      const dateStr = start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
      const startTime = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      const endTime = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      message = `I'm looking at a calendar event: "${ctx.eventTitle}" on ${dateStr} from ${startTime} to ${endTime}.${ctx.description ? ` Description: ${ctx.description}.` : ""} Can you help me understand this event and suggest what I should prepare or do?`
    } else {
      message = `I'm viewing my calendar (${ctx.currentView ?? "week"} view). Can you help me understand my calendar events, check my availability, or assist with scheduling?`
    }
    return { message, context: ctx }
  } catch {
    return null
  }
}

type AgentChatPageProps = {
  /** Hide title + approval row; used when the floating window title bar shows them. */
  embeddedInFloating?: boolean
}

export function AgentChatPage({ embeddedInFloating = false }: AgentChatPageProps) {
  const router = useRouter()
  const { setActiveView, floatingChat, toggleMaximize, setFloatingSessionId } = useAgentLayout()
  const [sessionId, setSessionIdState] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [stepProgress, setStepProgress] = useState<StepProgressItem[]>([])
  const [stepState, setStepState] = useState<WorkflowStepState>({
    analysisComplete: false,
    tasksCreated: false,
  })
  const [followUpAvailable, setFollowUpAvailable] = useState(false)
  const [followUpStarted, setFollowUpStarted] = useState(false)
  const [sessionTitle, setSessionTitle] = useState("Chat")
  const [approvalRequired, setApprovalRequired] = useState(false)
  const [generatedTaskIndexes, setGeneratedTaskIndexes] = useState<number[]>([])
  const [skippedTaskIndexes, setSkippedTaskIndexes] = useState<number[]>([])
  const [createdTaskIdByIndex, setCreatedTaskIdByIndex] = useState<Record<number, number>>({})
  const [pendingTaskApproval, setPendingTaskApproval] = useState<PendingExternalApproval | null>(null)
  const [pendingMiroApproval, setPendingMiroApproval] = useState<PendingExternalApproval | null>(null)
  const [selectedTaskIndexes, setSelectedTaskIndexes] = useState<number[]>([])
  const [tasksApprovalGenerating, setTasksApprovalGenerating] = useState(false)
  const [miroApprovalGenerating, setMiroApprovalGenerating] = useState(false)
  const [taskGenerationStatus, setTaskGenerationStatus] = useState<TaskGenerationStatus>("idle")
  const selectAllRecommendedTasks = useCallback((count: number) => {
    if (count > 0) {
      setSelectedTaskIndexes(Array.from({ length: count }, (_, i) => i))
    }
  }, [])
  const applyPendingTaskApproval = useCallback((pending: PendingExternalApproval) => {
    setPendingTaskApproval(pending)
    setTasksApprovalGenerating(false)
    setTaskGenerationStatus("awaiting_approval")
    setSkippedTaskIndexes([])
    const tasks = (pending.draft as any)?.recommended_tasks
    const tasksLen =
      Array.isArray(tasks) ? tasks.length : (latestRecommendedTasksRef.current?.length ?? 0)
    if (tasksLen > 0) {
      setSelectedTaskIndexes((prev) =>
        prev.length > 0 ? prev : Array.from({ length: tasksLen }, (_, i) => i)
      )
    }
  }, [])
  const abortRef = useRef<AbortController | null>(null)
  const activeStreamTokenRef = useRef(0)
  const sessionLoadRequestRef = useRef(0)
  const [pendingCalendarPreload] = useState<CalendarPreload | null>(buildCalendarPreload)
  // Persist calendar context for the lifetime of this session so follow-up messages
  // also go through the calendar workflow, not the generic fallback.
  const [sessionCalendarContext, setSessionCalendarContext] = useState<Record<string, unknown> | null>(
    pendingCalendarPreload ? pendingCalendarPreload.context : null
  )
  // Persist calendar context so it survives page refreshes / session restores
  useEffect(() => {
    if (sessionCalendarContext) {
      sessionStorage.setItem("agent-session-calendar-context", JSON.stringify(sessionCalendarContext))
    }
  }, [sessionCalendarContext])

  const handleSendMessageRef = useRef<typeof handleSendMessage | null>(null)
  const isAwaitingFollowUp = followUpStarted && !isStreaming
  const inputPlaceholder = isAwaitingFollowUp
    ? "Ask one follow-up question about the analysis, or include an exact username/email for forwarding..."
    : "Ask about your data or upload a file..."
  const inputHelperText = isAwaitingFollowUp
    ? "You can send one follow-up message now. Ask for an explanation, a short report, or forwarding to specific project members."
    : undefined
  const latestAnalysisMessageId = [...messages].reverse().find((message) => message.type === "analysis")?.id ?? null

  const sessionIdRef = useRef<string | null>(null)
  const stepProgressMsgIdRef = useRef<string | null>(null)
  // Stores pending auto-confirm mapping when column_mapping event is received
  const pendingAutoConfirmRef = useRef<Record<string, string> | null>(null)
  // Always points to the latest handleConfirmColumns so it can be called from handleFileUpload
  const handleConfirmColumnsRef = useRef<((m: Record<string, string>) => void) | null>(null)
  // Stores recommended tasks from latest analysis for task cards and approvals
  const latestRecommendedTasksRef = useRef<import("@/types/agent").RecommendedTask[] | null>(null)
  const autoExternalActionsTriggeredRef = useRef(false)
  const autoActionQueueRef = useRef<string[]>([])
  const approvalRequiredRef = useRef(approvalRequired)
  const isStreamingRef = useRef(isStreaming)
  const handleActionRef = useRef<((action: string) => void) | null>(null)
  approvalRequiredRef.current = approvalRequired
  isStreamingRef.current = isStreaming

  const tryRunNextAutoAction = useCallback(() => {
    if (isStreamingRef.current || !sessionIdRef.current) return
    const next = autoActionQueueRef.current.shift()
    if (next) {
      void handleActionRef.current?.(next)
    }
  }, [])

  const queueAutoExternalActionsAfterAnalysis = useCallback((options?: { approvalRequired?: boolean }) => {
    const requiresApproval = options?.approvalRequired ?? approvalRequiredRef.current
    if (autoExternalActionsTriggeredRef.current) return
    autoExternalActionsTriggeredRef.current = true
    autoActionQueueRef.current = requiresApproval ? ["create_tasks"] : ["create_tasks", "generate_miro"]
    setTaskGenerationStatus("generating")
    tryRunNextAutoAction()
  }, [tryRunNextAutoAction])

  const setSessionId = useCallback((id: string | null) => {
    sessionIdRef.current = id
    setSessionIdState(id)
    if (id) {
      sessionStorage.setItem("agent-session-id", id)
    } else {
      sessionStorage.removeItem("agent-session-id")
    }
    // Keep floating title bar state in sync when embedded.
    if (embeddedInFloating) {
      setFloatingSessionId(id)
    }
    // Broadcast session id so container headers (e.g. side panel) can sync.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("agent:session-id", { detail: { sessionId: id } }))
    }
  }, [embeddedInFloating, setFloatingSessionId])

  const getApprovalPref = useCallback(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("agent-approval-required-default") === "true"
  }, [])

  // Ensure approval state is initialized/refreshed whenever the chatbox opens (especially floating/embedded).
  useEffect(() => {
    if (!embeddedInFloating) return
    const id = floatingChat.sessionId ?? sessionStorage.getItem("agent-session-id")
    if (!id) {
      setApprovalRequired(false)
      return
    }
    AgentAPI.getSession(id)
      .then((s) => setApprovalRequired(Boolean(s.approval_required)))
      .catch(() => {
        // keep current value on failure
      })
  }, [embeddedInFloating, floatingChat.sessionId])

  // Keep approvalRequired in sync with the toggle (floating title bar + inline header).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { sessionId?: string; value?: boolean } | undefined
      if (!detail?.sessionId) return
      const current = sessionIdRef.current
      if (!current || String(current) !== String(detail.sessionId)) return
      if (typeof detail.value === "boolean") setApprovalRequired(detail.value)
    }
    window.addEventListener("agent:approval-changed", handler)
    return () => window.removeEventListener("agent:approval-changed", handler)
  }, [])

  const applySessionState = useCallback((session: Awaited<ReturnType<typeof AgentAPI.getSession>>) => {
    setSessionId(String(session.id))

    // Restore messages and back-fill recommendedTasks onto analysis messages when needed.
    const restored = session.messages.map(restoreMessage)
    setHasStarted(restored.length > 0)
    for (let i = 0; i < restored.length; i++) {
      if (restored[i].type === "analysis") {
        latestRecommendedTasksRef.current = restored[i].recommendedTasks || null
      }
    }
    setMessages(dedupeMiroGenerationStartedMessages(restored))
    setFollowUpAvailable(Boolean(session.follow_up_available))
    setFollowUpStarted(Boolean(session.follow_up_started))
    setSessionTitle((session.title && session.title.trim()) || "Chat")
    setApprovalRequired(Boolean(session.approval_required))
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("agent:session-state", {
        detail: {
          sessionId: String(session.id),
          title: (session.title && session.title.trim()) || "Chat",
          approvalRequired: Boolean(session.approval_required),
        }
      }))
    }
    const lastTaskCreated = [...session.messages].reverse().find(
      (m) => m.message_type === "task_created" || (m.data?.task_ids && m.data.task_ids.length > 0)
    )
    const created = (lastTaskCreated as any)?.data?.created_tasks
    if (Array.isArray(created)) {
      const idxs = created
        .map((c: any) => Number(c?.index))
        .filter((n: unknown) => typeof n === "number" && Number.isFinite(n))
      setGeneratedTaskIndexes(Array.from(new Set(idxs)))
      // If any previously-skipped tasks later get created (e.g. user runs create_tasks again),
      // clear them from the skipped list so the UI stays consistent.
      setSkippedTaskIndexes((prev) => prev.filter((i) => !idxs.includes(i)))
      const pairs = created
        .map((c: any) => [Number(c?.index), Number(c?.task_id)] as const)
        .filter(([idx, tid]) => Number.isFinite(idx) && Number.isFinite(tid))
      setCreatedTaskIdByIndex(Object.fromEntries(pairs))
    } else {
      setGeneratedTaskIndexes([])
      setCreatedTaskIdByIndex({})
    }
    broadcastRestoredAnomalies(session.messages)
    // Derive step state from restored messages.
    // Each new analysis event starts a fresh cycle — reset downstream flags so that
    // task/decision data from a *previous* upload cycle does not carry over.
    const restoredStepState: WorkflowStepState = {
      analysisComplete: false,
      tasksCreated: false,
    }
    for (const m of session.messages) {
      if (m.data?.anomalies) {
        restoredStepState.analysisComplete = true
        restoredStepState.tasksCreated = false
      }
      if (m.message_type === "task_created" || m.data?.task_ids) restoredStepState.tasksCreated = true
    }
    setStepState(restoredStepState)
    const pendingTaskApprovalFromMessages = !restoredStepState.tasksCreated
      ? [...restored].reverse().find((message) => message.approval?.kind === "task")?.approval ?? null
      : null
    if (pendingTaskApprovalFromMessages) {
      setPendingTaskApproval(pendingTaskApprovalFromMessages)
      setTaskGenerationStatus("awaiting_approval")
      const tasks =
        (pendingTaskApprovalFromMessages.draft as any)?.recommended_tasks ??
        latestRecommendedTasksRef.current ??
        []
      if (Array.isArray(tasks) && tasks.length > 0) {
        setSelectedTaskIndexes(Array.from({ length: tasks.length }, (_, i) => i))
      }
    } else {
      setPendingTaskApproval(null)
      const recommendedTaskCount = latestRecommendedTasksRef.current?.length ?? 0
      if (
        Boolean(session.approval_required) &&
        restoredStepState.analysisComplete &&
        !restoredStepState.tasksCreated &&
        recommendedTaskCount > 0
      ) {
        setSelectedTaskIndexes(Array.from({ length: recommendedTaskCount }, (_, i) => i))
      }
      setTaskGenerationStatus(restoredStepState.tasksCreated ? "completed" : "idle")
    }
    const recommendedTaskCount = latestRecommendedTasksRef.current?.length ?? 0
    if (
      restoredStepState.analysisComplete &&
      !restoredStepState.tasksCreated &&
      recommendedTaskCount > 0 &&
      !pendingTaskApprovalFromMessages
    ) {
      queueAutoExternalActionsAfterAnalysis({ approvalRequired: Boolean(session.approval_required) })
    }
    if (embeddedInFloating) {
      void AgentAPI.updateSession(String(session.id), { last_read_at: new Date().toISOString() })
        .then(() => {
          window.dispatchEvent(new CustomEvent("agent:sessions-changed"))
        })
        .catch(() => {
          /* ignore */
        })
    }
  }, [setSessionId, embeddedInFloating, queueAutoExternalActionsAfterAnalysis])

  const refreshFollowUpState = useCallback(async (id: string) => {
    try {
      const session = await AgentAPI.getSession(id)
      setFollowUpAvailable(Boolean(session.follow_up_available))
      setFollowUpStarted(Boolean(session.follow_up_started))
      setApprovalRequired(Boolean(session.approval_required))
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("agent:session-state", {
          detail: {
            sessionId: String(session.id),
            title: (session.title && session.title.trim()) || "Chat",
            approvalRequired: Boolean(session.approval_required),
          }
        }))
      }
    } catch {
      // ignore refresh failures; next restore/poll can retry
    }
  }, [])

  const invalidateActiveStreams = useCallback(() => {
    activeStreamTokenRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  const resetTransientChatUiState = useCallback(() => {
    setStepProgress([])
    setPendingTaskApproval(null)
    setPendingMiroApproval(null)
    setTasksApprovalGenerating(false)
    setMiroApprovalGenerating(false)
    stepProgressMsgIdRef.current = null
    pendingAutoConfirmRef.current = null
    autoExternalActionsTriggeredRef.current = false
    autoActionQueueRef.current = []
  }, [])

  const refreshSession = useCallback(async (id: string) => {
    try {
      const session = await AgentAPI.getSession(id)
      if (String(sessionIdRef.current) !== String(id)) return
      // Re-apply the same backfill logic as applySessionState so that
      const restored = session.messages.map(restoreMessage)
      for (let i = 0; i < restored.length; i++) {
        if (restored[i].type === "analysis") {
          latestRecommendedTasksRef.current = restored[i].recommendedTasks || null
        }
      }
      setMessages(dedupeMiroGenerationStartedMessages(restored))
      setApprovalRequired(Boolean(session.approval_required))
      setFollowUpAvailable(Boolean(session.follow_up_available))
      setFollowUpStarted(Boolean(session.follow_up_started))
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("agent:session-state", {
          detail: {
            sessionId: String(session.id),
            title: (session.title && session.title.trim()) || "Chat",
            approvalRequired: Boolean(session.approval_required),
          }
        }))
      }
      const lastTaskCreated = [...session.messages].reverse().find(
        (m) => m.message_type === "task_created" || (m.data?.task_ids && m.data.task_ids.length > 0)
      )
      const created = (lastTaskCreated as any)?.data?.created_tasks
      if (Array.isArray(created)) {
        const idxs = created
          .map((c: any) => Number(c?.index))
          .filter((n: unknown) => typeof n === "number" && Number.isFinite(n))
        setGeneratedTaskIndexes(Array.from(new Set(idxs)))
        setSkippedTaskIndexes((prev) => prev.filter((i) => !idxs.includes(i)))
        const pairs = created
          .map((c: any) => [Number(c?.index), Number(c?.task_id)] as const)
          .filter(([idx, tid]) => Number.isFinite(idx) && Number.isFinite(tid))
        setCreatedTaskIdByIndex(Object.fromEntries(pairs))
      }
      if (lastTaskCreated) {
        setStepState((prev) => ({ ...prev, tasksCreated: true }))
        setTaskGenerationStatus("completed")
      }
    } catch {
      // ignore refresh failures; next restore/poll can retry
    }
  }, [])

  const loadSessionById = useCallback(async (id: string) => {
    const requestId = ++sessionLoadRequestRef.current
    invalidateActiveStreams()
    resetTransientChatUiState()
    try {
      const session = await AgentAPI.getSession(id)
      if (requestId !== sessionLoadRequestRef.current) return
      applySessionState(session)
    } catch {
      if (requestId !== sessionLoadRequestRef.current) return
      if (String(sessionIdRef.current) === String(id)) {
        sessionStorage.removeItem("agent-session-id")
        setSessionId(null)
      }
    }
  }, [applySessionState, invalidateActiveStreams, resetTransientChatUiState, setSessionId])

  // Abort SSE on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  useEffect(() => {
    if (!sessionId) return
    const pendingWorkflowRunIds = getPendingMiroWorkflowRunIds(messages)
    if (pendingWorkflowRunIds.length === 0) return

    const intervalId = window.setInterval(async () => {
      try {
        const session = await AgentAPI.getSession(sessionId)
        // Re-apply the same backfill logic as applySessionState so that
        const restored = session.messages.map(restoreMessage)
        setMessages(dedupeMiroGenerationStartedMessages(restored))
        setFollowUpAvailable(Boolean(session.follow_up_available))
        setFollowUpStarted(Boolean(session.follow_up_started))
        setApprovalRequired(Boolean(session.approval_required))
        const lastTaskCreated = [...session.messages].reverse().find(
          (m) => m.message_type === "task_created" || (m.data?.task_ids && m.data.task_ids.length > 0)
        )
        const created = (lastTaskCreated as any)?.data?.created_tasks
        if (Array.isArray(created)) {
          const idxs = created
            .map((c: any) => Number(c?.index))
            .filter((n: unknown) => typeof n === "number" && Number.isFinite(n))
          setGeneratedTaskIndexes(Array.from(new Set(idxs)))
          const pairs = created
            .map((c: any) => [Number(c?.index), Number(c?.task_id)] as const)
            .filter(([idx, tid]) => Number.isFinite(idx) && Number.isFinite(tid))
          setCreatedTaskIdByIndex(Object.fromEntries(pairs))
        }
        if (lastTaskCreated) {
          setStepState((prev) => ({ ...prev, tasksCreated: true }))
          setTaskGenerationStatus("completed")
        }
      } catch {
        // ignore polling failures; next cycle can retry
      }
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [sessionId, messages])

  // Restore session on mount
  useEffect(() => {
    const storedId = sessionStorage.getItem("agent-session-id")
    if (storedId) {
      void loadSessionById(storedId)
    } else {
      // If there is no active session, initialize the toggle from the persisted preference.
      setApprovalRequired(getApprovalPref())
    }
  }, [getApprovalPref, loadSessionById])

  // Listen for sidebar events
  useEffect(() => {
    const handleNewChat = () => {
      sessionLoadRequestRef.current += 1
      invalidateActiveStreams()
      resetTransientChatUiState()
      setSessionId(null)
      sessionStorage.removeItem("agent-session-calendar-context")
      setMessages([])
      setSessionCalendarContext(null)
      setHasStarted(false)
      setFollowUpAvailable(false)
      setFollowUpStarted(false)
      setSessionTitle("Chat")
      setApprovalRequired(false)
      setStepState({ analysisComplete: false, tasksCreated: false })
    }

    const handleLoadSession = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail?.sessionId) return
      void loadSessionById(String(detail.sessionId))
    }

    window.addEventListener("agent:new-chat", handleNewChat)
    window.addEventListener("agent:load-session", handleLoadSession)
    return () => {
      window.removeEventListener("agent:new-chat", handleNewChat)
      window.removeEventListener("agent:load-session", handleLoadSession)
    }
  }, [invalidateActiveStreams, loadSessionById, resetTransientChatUiState, setSessionId])

  /** Append a new message and return its id */
  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg])
    return msg.id
  }, [])

  /** Update an existing message by id */
  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    )
  }, [])

  /** Handle file upload — calls upload-analyze SSE endpoint */
  const handleFileUpload = useCallback(async (file: File) => {
    setHasStarted(true)
    // Reset workflow state so a new upload always starts from analysis
    setStepState({ analysisComplete: false, tasksCreated: false })
    setGeneratedTaskIndexes([])
    setSkippedTaskIndexes([])
    setCreatedTaskIdByIndex({})
    autoExternalActionsTriggeredRef.current = false
    autoActionQueueRef.current = []

    // Show user message
    const userMsgId = `user-${Date.now()}`
    addMessage({
      id: userMsgId,
      role: "user",
      content: `Uploaded ${file.name}`,
      type: "file_uploaded",
      fileName: file.name,
    })

    // Show thinking placeholder
    const aiMsgId = `ai-${Date.now()}`
    addMessage({
      id: aiMsgId,
      role: "assistant",
      content: AGENT_MESSAGES.CHAT_THINKING,
      type: "text",
    })

    setIsStreaming(true)

    let contentParts: string[] = []
    let analysisData: AnalysisResult | null = null
    let columnMappingReceived = false

    let sid = sessionId
    if (!sid) {
      try {
        const session = await AgentAPI.createSession({ approval_required: getApprovalPref() })
        sid = String(session.id)
        setSessionId(sid)
        setSessionTitle("New Chat")
        setApprovalRequired(Boolean(session.approval_required))
        window.dispatchEvent(new CustomEvent("agent:sessions-changed"))
      } catch {
        updateMessage(aiMsgId, { content: AGENT_MESSAGES.SESSION_CREATE_FAILED, type: "error" })
        setIsStreaming(false)
        return
      }
    }

    const streamToken = activeStreamTokenRef.current
    const requestSessionId = String(sid)

    abortRef.current = AgentAPI.uploadAndAnalyze(
      file,
      sid,
      (event: SSEEvent) => {
        if (activeStreamTokenRef.current !== streamToken) return
        if (String(sessionIdRef.current) !== requestSessionId) return

        if (event.type === "file_uploaded") {
          // File confirmed uploaded — update thinking message
          updateMessage(aiMsgId, {
            content: event.content || "File uploaded. Analyzing...",
          })
        } else if (event.type === "step_progress" && event.data) {
          const { step_order, step_name, total_steps } = event.data
          if (step_order != null && step_name && total_steps) {
            setStepProgress((prev) => {
              const updated = [...prev]
              for (const s of updated) {
                if (s.order < step_order && s.status === "running") {
                  s.status = "completed"
                }
              }
              const existing = updated.find((s) => s.order === step_order)
              if (existing) {
                existing.status = "running"
                existing.name = step_name
              } else {
                while (updated.length < total_steps) {
                  const order = updated.length + 1
                  updated.push({
                    order,
                    name: order === step_order ? step_name : `Step ${order}`,
                    status: order < step_order ? "completed" : order === step_order ? "running" : "pending",
                  })
                }
              }
              return updated
            })
          }
        } else if (event.type === "column_mapping" && event.data) {
          columnMappingReceived = true
          const detectionData = event.data as unknown as ColumnDetectionData
          // Auto-confirm silently — store mapping to trigger after stream ends
          pendingAutoConfirmRef.current = detectionData.mappings
          updateMessage(aiMsgId, {
            content: event.content || "Column detection complete. Generating success criteria...",
            type: "text",
          })
        } else if (event.type === "text") {
          if (!columnMappingReceived) {
            contentParts.push(event.content || "")
            updateMessage(aiMsgId, { content: contentParts.join("\n") })
          }
        } else if (event.type === "analysis") {
          contentParts.push(event.content || "")
          analysisData = (event.data as unknown as AnalysisResult) || null
          latestRecommendedTasksRef.current = analysisData?.recommended_tasks || null
          setFollowUpAvailable(true)
          setFollowUpStarted(false)
          setStepState((prev) => ({ ...prev, analysisComplete: true }))
          setGeneratedTaskIndexes([])
          setSkippedTaskIndexes([])
          setCreatedTaskIdByIndex({})
          updateMessage(aiMsgId, {
            content: contentParts.join("\n"),
            type: "analysis",
            anomalies: analysisData?.anomalies,
            recommendedTasks: analysisData?.recommended_tasks,
          })
          selectAllRecommendedTasks(analysisData?.recommended_tasks?.length ?? 0)
          queueAutoExternalActionsAfterAnalysis()
          // Individual anomalies are added to the right panel via the
          // AnomalyCard "+ Add" button — no auto-broadcast on new analysis.
        } else if (event.type === "confirmation_request") {
          // If column mapping already shown, don't overwrite the card — just
          // silently wait for user confirmation via ColumnMappingCard buttons.
          if (!columnMappingReceived) {
            contentParts.push(event.content || "")
            updateMessage(aiMsgId, { content: contentParts.join("\n") })
          }
        } else if (event.type === "approval_request" && event.data) {
          const d = event.data as Record<string, unknown>
          const approvalId = d.approval_id
          const kind = String(d.kind ?? "")
          if (typeof approvalId !== "string") return

          const pending: PendingExternalApproval = {
            id: approvalId,
            kind,
            draft: (d.draft as Record<string, unknown>) ?? {},
          }

          if (kind === "task") {
            applyPendingTaskApproval(pending)
          } else if (kind === "miro_board") {
            setPendingMiroApproval(pending)
            setMiroApprovalGenerating(false)
          }
        } else if (event.type === "follow_up_prompt") {
          contentParts.push(event.content || "")
          setFollowUpAvailable(false)
          setFollowUpStarted(true)
          updateMessage(aiMsgId, {
            content: contentParts.join("\n"),
            isFollowUpPrompt: true,
          })
        } else if (event.type === "error") {
          updateMessage(aiMsgId, { content: event.content || "An error occurred.", type: "error" })
        } else if (event.type === "done") {
          // Capture session_id from done event
          const sid = event.data?.session_id
          if (sid) {
            setSessionId(sid)
            window.dispatchEvent(new CustomEvent("agent:sessions-changed"))
            void refreshFollowUpState(sid)
          }
          // Attach final step progress to the message
          setStepProgress((prev) => {
            if (prev.length > 0) {
              const final = prev.map((s) => ({
                ...s,
                status: s.status === "running" ? "completed" as const : s.status,
              }))
              updateMessage(aiMsgId, { stepProgress: final })
              return final
            }
            return prev
          })
          // Auto-confirm column mapping if pending (workflow paused at await_confirmation)
          const pendingMapping = pendingAutoConfirmRef.current
          if (pendingMapping) {
            pendingAutoConfirmRef.current = null
            setIsStreaming(false)
            setTimeout(() => {
              handleConfirmColumnsRef.current?.(pendingMapping)
            }, 100)
          }
        }
      },
      (error) => {
        if (activeStreamTokenRef.current !== streamToken) return
        if (String(sessionIdRef.current) !== requestSessionId) return
        updateMessage(aiMsgId, { content: `Error: ${error.message}`, type: "error" })
        setIsStreaming(false)
      },
      () => {
        if (activeStreamTokenRef.current !== streamToken) return
        if (String(sessionIdRef.current) !== requestSessionId) return
        void refreshSession(requestSessionId)
        void refreshFollowUpState(requestSessionId)
        setIsStreaming(false)
        if (embeddedInFloating) {
          window.dispatchEvent(new CustomEvent("agent:sessions-changed"))
          void AgentAPI.updateSession(requestSessionId, { last_read_at: new Date().toISOString() }).catch(() => {
            /* ignore */
          })
        }
      }
    )
  }, [sessionId, addMessage, updateMessage, setSessionId, refreshFollowUpState, refreshSession, getApprovalPref, embeddedInFloating, queueAutoExternalActionsAfterAnalysis])

  /** Confirm detected column mapping and resume paused workflow */
  const handleConfirmColumns = useCallback(async (mapping: Record<string, string>) => {
    const sid = sessionIdRef.current
    if (!sid) return

    const aiMsgId = `ai-${Date.now()}`
    addMessage({ id: aiMsgId, role: "assistant", content: AGENT_MESSAGES.CHAT_THINKING, type: "text" })
    setIsStreaming(true)
    setGeneratedTaskIndexes([])
    setSkippedTaskIndexes([])
    setCreatedTaskIdByIndex({})
    // Preserve step names from the upload phase; reset steps 3+ to pending
    setStepProgress((prev) =>
      prev.map((s) => ({
        ...s,
        status: s.order <= 2 ? ("completed" as const) : ("pending" as const),
      }))
    )
    let contentParts: string[] = []
    const streamToken = activeStreamTokenRef.current
    const requestSessionId = String(sid)

    abortRef.current = AgentAPI.sendMessage(
      sid,
      { message: "confirm_columns", action: "confirm_columns", column_mapping: mapping },
      (event: SSEEvent) => {
        if (activeStreamTokenRef.current !== streamToken) return
        if (String(sessionIdRef.current) !== requestSessionId) return
        if (event.type === "done") return

        if (event.type === "step_progress" && event.data) {
          const { step_order, step_name, total_steps } = event.data
          if (step_order != null && step_name && total_steps) {
            setStepProgress((prev) => {
              const updated = [...prev]
              for (const s of updated) {
                if (s.order < step_order && s.status === "running") {
                  s.status = "completed"
                }
              }
              const existing = updated.find((s) => s.order === step_order)
              if (existing) {
                existing.status = "running"
                existing.name = step_name
              } else {
                while (updated.length < total_steps) {
                  const order = updated.length + 1
                  updated.push({
                    order,
                    name: order === step_order ? step_name : `Step ${order}`,
                    status: order < step_order ? "completed" : order === step_order ? "running" : "pending",
                  })
                }
              }
              return updated
            })
          }
          return
        }

        if (event.content && event.type !== "miro_status" && event.type !== "follow_up_prompt") {
          contentParts.push(event.content)
          updateMessage(aiMsgId, { content: contentParts.join("\n") })
        }

        if (event.type === "analysis" && event.data) {
          const data = event.data as unknown as AnalysisResult
          latestRecommendedTasksRef.current = data.recommended_tasks || null
          setFollowUpAvailable(true)
          setFollowUpStarted(false)
          setStepState((prev) => ({ ...prev, analysisComplete: true }))
          setGeneratedTaskIndexes([])
          setSkippedTaskIndexes([])
          setCreatedTaskIdByIndex({})
          updateMessage(aiMsgId, {
            type: "analysis",
            anomalies: data.anomalies,
            recommendedTasks: data.recommended_tasks,
          })
          selectAllRecommendedTasks(data.recommended_tasks?.length ?? 0)
          queueAutoExternalActionsAfterAnalysis()
        }
        if (event.type === "approval_request" && event.data) {
          const d = event.data as Record<string, unknown>
          const approvalId = d.approval_id
          const kind = String(d.kind ?? "")
          if (typeof approvalId !== "string") return

          const pending: PendingExternalApproval = {
            id: approvalId,
            kind,
            draft: (d.draft as Record<string, unknown>) ?? {},
          }

          if (kind === "task") {
            applyPendingTaskApproval(pending)
          } else if (kind === "miro_board") {
            setPendingMiroApproval(pending)
            setMiroApprovalGenerating(false)
          }
        }
        if (event.type === "task_created" && event.data) {
          setStepState((prev) => ({ ...prev, tasksCreated: true }))
          setPendingTaskApproval(null)
          setTasksApprovalGenerating(false)
          setTaskGenerationStatus("completed")
          const created = (event.data as any)?.created_tasks
          if (Array.isArray(created)) {
            const idxs = created
              .map((c: any) => Number(c?.index))
              .filter((n: unknown) => typeof n === "number" && Number.isFinite(n))
            setGeneratedTaskIndexes(Array.from(new Set(idxs)))
            setSkippedTaskIndexes((prev) => prev.filter((i) => !idxs.includes(i)))
            const pairs = created
              .map((c: any) => [Number(c?.index), Number(c?.task_id)] as const)
              .filter(([idx, tid]) => Number.isFinite(idx) && Number.isFinite(tid))
            setCreatedTaskIdByIndex(Object.fromEntries(pairs))
          } else {
            const tasksLen = latestRecommendedTasksRef.current?.length ?? 0
            if (tasksLen > 0) setGeneratedTaskIndexes(Array.from({ length: tasksLen }, (_, i) => i))
          }
          updateMessage(aiMsgId, {
            content: contentParts.join("\n"),
            type: "tasks_created",
            navigateTo: "tasks",
            navigateLabel: "Go to Tasks",
          })
        }
      },
      (error) => {
        if (activeStreamTokenRef.current !== streamToken) return
        if (String(sessionIdRef.current) !== requestSessionId) return
        updateMessage(aiMsgId, { content: `Error: ${error.message}`, type: "error" })
        setIsStreaming(false)
      },
      () => {
        if (activeStreamTokenRef.current !== streamToken) return
        if (String(sessionIdRef.current) !== requestSessionId) return
        void refreshSession(requestSessionId)
        void refreshFollowUpState(requestSessionId)
        setStepProgress((prev) => {
          if (prev.length > 0) {
            const final = prev.map((s) => ({
              ...s,
              status: s.status === "running" ? "completed" as const : s.status,
            }))
            updateMessage(aiMsgId, { stepProgress: final })
            stepProgressMsgIdRef.current = aiMsgId
            return final
          }
          return prev
        })
        setIsStreaming(false)
        if (embeddedInFloating) {
          window.dispatchEvent(new CustomEvent("agent:sessions-changed"))
          void AgentAPI.updateSession(requestSessionId, { last_read_at: new Date().toISOString() }).catch(() => {
            /* ignore */
          })
        }
      }
    )
  }, [addMessage, updateMessage, refreshFollowUpState, refreshSession, embeddedInFloating, queueAutoExternalActionsAfterAnalysis])

  // Keep ref in sync so handleFileUpload's done handler can call the latest version
  handleConfirmColumnsRef.current = handleConfirmColumns

  /** Re-upload: reset to welcome screen so the user can upload a different file */
  const handleReupload = useCallback(() => {
    sessionIdRef.current = null
    stepProgressMsgIdRef.current = null
    setSessionId(null)
    setMessages([])
    setHasStarted(false)
    setIsStreaming(false)
    setFollowUpAvailable(false)
    setFollowUpStarted(false)
    setStepProgress([])
    setStepState({ analysisComplete: false, tasksCreated: false })
    setGeneratedTaskIndexes([])
    setSkippedTaskIndexes([])
    latestRecommendedTasksRef.current = null
    autoExternalActionsTriggeredRef.current = false
    autoActionQueueRef.current = []
    abortRef.current?.abort()
  }, [setSessionId])

  /** Handle text message send */
  const handleSendMessage = useCallback(async (text: string, calendarContext?: Record<string, unknown>) => {
    setHasStarted(true)
    // Use provided context or fall back to the session-level calendar context
    const effectiveCalendarContext = calendarContext ?? sessionCalendarContext ?? undefined
    if (calendarContext && !sessionCalendarContext) {
      setSessionCalendarContext(calendarContext)
    }

    const userMsgId = `user-${Date.now()}`
    addMessage({ id: userMsgId, role: "user", content: text, type: "text" })

    // Create session if needed
    let sid = sessionId
    if (!sid) {
      try {
        const session = await AgentAPI.createSession({ approval_required: getApprovalPref() })
        sid = String(session.id)
        setSessionId(sid)
        setSessionTitle("New Chat")
        setApprovalRequired(Boolean(session.approval_required))
        window.dispatchEvent(new CustomEvent("agent:sessions-changed"))
      } catch {
        addMessage({
          id: `err-${Date.now()}`,
          role: "assistant",
          content: AGENT_MESSAGES.SESSION_CREATE_FAILED,
          type: "error",
        })
        return
      }
    }

    const aiMsgId = `ai-${Date.now()}`
    addMessage({ id: aiMsgId, role: "assistant", content: AGENT_MESSAGES.CHAT_THINKING, type: "text" })

    setIsStreaming(true)
    setStepProgress([])
    let contentParts: string[] = []
    const streamToken = activeStreamTokenRef.current
    const requestSessionId = String(sid)

    abortRef.current = AgentAPI.sendMessage(
      sid!,
      {
        message: text,
        ...(effectiveCalendarContext ? { calendar_context: effectiveCalendarContext as any } : {}),
      },
      (event: SSEEvent) => {
        if (activeStreamTokenRef.current !== streamToken) return
        if (String(sessionIdRef.current) !== requestSessionId) return
        if (event.type === "done") return

        // Notify the calendar page to refresh when events are created.
        // Dispatch a custom event for same-window (floating chat) communication,
        // and also write to localStorage for cross-tab communication.
        if (event.type === "calendar_updated") {
          window.dispatchEvent(new CustomEvent("agent:calendar-updated"))
          localStorage.setItem("calendar-events-updated", String(Date.now()))
          return
        }

        // Add a separate invite message so the calendar answer is preserved.
        // Switch to calendar mode so the user's reply goes through the calendar workflow.
        if (event.type === "calendar_invite") {
          addMessage({
            id: `ai-invite-${Date.now()}`,
            role: "assistant",
            content: event.content || "",
            type: "calendar_invite",
          })
          setSessionCalendarContext({
            type: "calendar",
            userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            currentView: "week",
            currentDate: new Date().toISOString().split("T")[0],
          })
          return
        }

        if (event.type === "approval_request" && event.data) {
          const d = event.data as Record<string, unknown>
          const approvalId = d.approval_id
          const kind = String(d.kind ?? "")
          if (typeof approvalId !== "string") return

          const pending: PendingExternalApproval = {
            id: approvalId,
            kind,
            draft: (d.draft as Record<string, unknown>) ?? {},
          }

          if (kind === "task") {
            applyPendingTaskApproval(pending)
          } else if (kind === "miro_board") {
            setPendingMiroApproval(pending)
            setMiroApprovalGenerating(false)
          }

          addMessage({
            id: `approval-${approvalId}`,
            role: "assistant",
            content: event.content || "Approval required.",
            type: "approval_request",
            approval: pending,
          })
          return
        }

        if (event.type === "step_progress" && event.data) {
          const { step_order, step_name, total_steps } = event.data
          if (step_order != null && step_name && total_steps) {
            setStepProgress((prev) => {
              const updated = [...prev]
              // Mark previous steps as completed
              for (const s of updated) {
                if (s.order < step_order && s.status === "running") {
                  s.status = "completed"
                }
              }
              // Add or update current step
              const existing = updated.find((s) => s.order === step_order)
              if (existing) {
                existing.status = "running"
                existing.name = step_name
              } else {
                // Fill pending steps up to total_steps
                while (updated.length < total_steps) {
                  const order = updated.length + 1
                  updated.push({
                    order,
                    name: order === step_order ? step_name : `Step ${order}`,
                    status: order < step_order ? "completed" : order === step_order ? "running" : "pending",
                  })
                }
              }
              return updated
            })
            updateMessage(aiMsgId, {
              content: event.content || contentParts.join("\n") || `Running: ${step_name}...`,
              stepProgress: undefined, // will be set on done
            })
          }
          return
        }

        if (event.content && event.type !== "miro_status" && event.type !== "follow_up_prompt") {
          contentParts.push(event.content)
          updateMessage(aiMsgId, { content: contentParts.join("\n") })
        }

        if (event.type === "analysis" && event.data) {
          const data = event.data as unknown as AnalysisResult
          latestRecommendedTasksRef.current = data.recommended_tasks || null
          setFollowUpAvailable(true)
          setFollowUpStarted(false)
          setStepState((prev) => ({ ...prev, analysisComplete: true }))
          setGeneratedTaskIndexes([])
          setSkippedTaskIndexes([])
          setCreatedTaskIdByIndex({})
          updateMessage(aiMsgId, {
            type: "analysis",
            anomalies: data.anomalies,
            recommendedTasks: data.recommended_tasks,
          })
          selectAllRecommendedTasks(data.recommended_tasks?.length ?? 0)
          // Individual anomalies are added to the right panel via the
          // AnomalyCard "+ Add" button — no auto-broadcast on new analysis.
          queueAutoExternalActionsAfterAnalysis()
        }
        if (event.type === "task_created" && event.data) {
          setStepState((prev) => ({ ...prev, tasksCreated: true }))
          setTaskGenerationStatus("completed")
          const created = (event.data as any)?.created_tasks
          if (Array.isArray(created)) {
            const idxs = created
              .map((c: any) => Number(c?.index))
              .filter((n: unknown) => typeof n === "number" && Number.isFinite(n))
            setGeneratedTaskIndexes(Array.from(new Set(idxs)))
            const pairs = created
              .map((c: any) => [Number(c?.index), Number(c?.task_id)] as const)
              .filter(([idx, tid]) => Number.isFinite(idx) && Number.isFinite(tid))
            setCreatedTaskIdByIndex(Object.fromEntries(pairs))
          } else {
            const tasksLen = latestRecommendedTasksRef.current?.length ?? 0
            if (tasksLen > 0) setGeneratedTaskIndexes(Array.from({ length: tasksLen }, (_, i) => i))
          }
          updateMessage(aiMsgId, {
            content: contentParts.join("\n"),
            type: "tasks_created",
            navigateTo: "tasks",
            navigateLabel: "Go to Tasks",
          })
        }
        if (event.type === "miro_status") {
          setPendingMiroApproval(null)
          setMiroApprovalGenerating(false)
          const rawWr = event.data?.workflow_run_id
          const workflowRunId =
            typeof rawWr === "string" ? rawWr : rawWr != null ? String(rawWr) : undefined

          setMessages((prev) => {
            const next = mergeMiroGenerationStartedIntoMessages(prev, aiMsgId, {
              content: event.content || LEGACY_MIRO_QUEUED_FALLBACK,
              type: "miro_status",
              navigateTo: "miro",
              navigateLabel: "Generating Miro...",
              navigateDisabled: true,
              navigateHref: undefined,
              eventType: "miro_generation_started",
              workflowRunId,
            })
            return appendMiroResultMessage(next, event)
          })
        }
        if (event.type === "follow_up_prompt") {
          contentParts.push(event.content || "")
          setFollowUpAvailable(false)
          setFollowUpStarted(true)
          updateMessage(aiMsgId, {
            content: contentParts.join("\n"),
            isFollowUpPrompt: true,
          })
        }
      },
      (error) => {
        if (activeStreamTokenRef.current !== streamToken) return
        if (String(sessionIdRef.current) !== requestSessionId) return
        updateMessage(aiMsgId, { content: `Error: ${error.message}`, type: "error" })
        setIsStreaming(false)
      },
      () => {
        if (activeStreamTokenRef.current !== streamToken) return
        if (String(sessionIdRef.current) !== requestSessionId) return
        void refreshSession(requestSessionId)
        void refreshFollowUpState(requestSessionId)
        // Attach final step progress to the message
        setStepProgress((prev) => {
          if (prev.length > 0) {
            const final = prev.map((s) => ({
              ...s,
              status: s.status === "running" ? "completed" as const : s.status,
            }))
            updateMessage(aiMsgId, { stepProgress: final })
            return final
          }
          return prev
        })
        setIsStreaming(false)
        if (embeddedInFloating) {
          window.dispatchEvent(new CustomEvent("agent:sessions-changed"))
          void AgentAPI.updateSession(requestSessionId, { last_read_at: new Date().toISOString() }).catch(() => {
            /* ignore */
          })
        }
      }
    )
  }, [sessionId, sessionCalendarContext, addMessage, updateMessage, setMessages, setSessionId, refreshFollowUpState, refreshSession, getApprovalPref, embeddedInFloating, queueAutoExternalActionsAfterAnalysis])

  // Keep ref always pointing to the latest handleSendMessage
  handleSendMessageRef.current = handleSendMessage

  /** Handle pipeline actions (Create Tasks, Miro, follow-up, etc.) */
  const handleAction = useCallback(async (action: string) => {
    const sid = sessionIdRef.current
    if (!sid) return

    const actionMap: Record<string, AgentAction> = {
      create_tasks: "create_tasks",
      generate_miro: "generate_miro",
      distribute_message: "distribute_message",
      start_follow_up: "start_follow_up",
      cancel_follow_up: "cancel_follow_up",
    }
    const agentAction = actionMap[action]
    if (!agentAction) return

    if (action === "create_tasks") {
      setTaskGenerationStatus("generating")
    }

    const aiMsgId = `ai-${Date.now()}`
    addMessage({ id: aiMsgId, role: "assistant", content: AGENT_MESSAGES.CHAT_THINKING, type: "text" })

    setIsStreaming(true)
    if (action === "create_tasks") setGeneratedTaskIndexes([])
    let contentParts: string[] = []
    const streamToken = activeStreamTokenRef.current
    const requestSessionId = String(sid)

    abortRef.current = AgentAPI.sendMessage(
      sid,
      { message: action, action: agentAction },
      (event: SSEEvent) => {
        if (activeStreamTokenRef.current !== streamToken) return
        if (String(sessionIdRef.current) !== requestSessionId) return
        if (event.type === "done") return

        if (event.type === "step_progress" && event.data) {
          const { step_order, step_name, total_steps } = event.data
          if (step_order != null && step_name && total_steps) {
            setStepProgress((prev) => {
              const updated = [...prev]
              for (const s of updated) {
                if (s.order < step_order && s.status === "running") s.status = "completed"
              }
              const existing = updated.find((s) => s.order === step_order)
              if (existing) {
                existing.status = "running"
                existing.name = step_name
              } else {
                while (updated.length < total_steps) {
                  const order = updated.length + 1
                  updated.push({
                    order,
                    name: order === step_order ? step_name : `Step ${order}`,
                    status: order < step_order ? "completed" : order === step_order ? "running" : "pending",
                  })
                }
              }
              // Update the existing step progress message live
              const spMsgId = stepProgressMsgIdRef.current
              if (spMsgId) updateMessage(spMsgId, { stepProgress: [...updated] })
              return updated
            })
          }
          return
        }

        if (event.content && event.type !== "miro_status" && event.type !== "follow_up_prompt") {
          contentParts.push(event.content)
          updateMessage(aiMsgId, { content: contentParts.join("\n") })
        }

        if (event.type === "task_created") {
          setStepState((prev) => ({ ...prev, tasksCreated: true }))
          setPendingTaskApproval(null)
          setTasksApprovalGenerating(false)
          setTaskGenerationStatus("completed")
          const created = (event.data as any)?.created_tasks
          if (Array.isArray(created)) {
            const idxs = created
              .map((c: any) => Number(c?.index))
              .filter((n: unknown) => typeof n === "number" && Number.isFinite(n))
            setGeneratedTaskIndexes(Array.from(new Set(idxs)))
            setSkippedTaskIndexes((prev) => prev.filter((i) => !idxs.includes(i)))
            const pairs = created
              .map((c: any) => [Number(c?.index), Number(c?.task_id)] as const)
              .filter(([idx, tid]) => Number.isFinite(idx) && Number.isFinite(tid))
            setCreatedTaskIdByIndex(Object.fromEntries(pairs))
          } else {
            const tasksLen = latestRecommendedTasksRef.current?.length ?? 0
            if (tasksLen > 0) setGeneratedTaskIndexes(Array.from({ length: tasksLen }, (_, i) => i))
          }
          updateMessage(aiMsgId, {
            content: contentParts.join("\n"),
            type: "tasks_created",
            navigateTo: "tasks",
            navigateLabel: "Go to Tasks",
          })
        }
        if (event.type === "miro_status") {
          setPendingMiroApproval(null)
          setMiroApprovalGenerating(false)
          const rawWr = event.data?.workflow_run_id
          const workflowRunId =
            typeof rawWr === "string" ? rawWr : rawWr != null ? String(rawWr) : undefined

          setMessages((prev) => {
            const next = mergeMiroGenerationStartedIntoMessages(prev, aiMsgId, {
              content: event.content || LEGACY_MIRO_QUEUED_FALLBACK,
              type: "miro_status",
              navigateTo: "miro",
              navigateLabel: "Generating Miro...",
              navigateDisabled: true,
              navigateHref: undefined,
              eventType: "miro_generation_started",
              workflowRunId,
            })
            return appendMiroResultMessage(next, event)
          })
        }
        if (event.type === "follow_up_prompt") {
          contentParts.push(event.content || "")
          setFollowUpAvailable(false)
          setFollowUpStarted(true)
          updateMessage(aiMsgId, {
            content: contentParts.join("\n"),
            isFollowUpPrompt: true,
          })
        }
        if (event.type === "approval_request" && event.data) {
          const d = event.data as Record<string, unknown>
          const approvalId = d.approval_id
          const kind = String(d.kind ?? "")
          if (typeof approvalId !== "string") return

          const pending: PendingExternalApproval = {
            id: approvalId,
            kind,
            draft: (d.draft as Record<string, unknown>) ?? {},
          }

          if (kind === "task") {
            applyPendingTaskApproval(pending)
          } else if (kind === "miro_board") {
            setPendingMiroApproval(pending)
            setMiroApprovalGenerating(false)
          }
        }
        if (event.type === "error" && action === "create_tasks") {
          setTaskGenerationStatus("error")
        }
      },
      (error) => {
        if (activeStreamTokenRef.current !== streamToken) return
        if (String(sessionIdRef.current) !== requestSessionId) return
        if (action === "create_tasks") {
          setTaskGenerationStatus("error")
        }
        updateMessage(aiMsgId, { content: `Error: ${error.message}`, type: "error" })
        setIsStreaming(false)
      },
      () => {
        if (activeStreamTokenRef.current !== streamToken) return
        if (String(sessionIdRef.current) !== requestSessionId) return
        if (action === "create_tasks") {
          setTaskGenerationStatus((status) => (status === "generating" ? "error" : status))
        }
        void refreshSession(requestSessionId)
        void refreshFollowUpState(requestSessionId)
        setStepProgress((prev) => {
          if (prev.length > 0) {
            const final = prev.map((s) => ({
              ...s,
              status: s.status === "running" ? "completed" as const : s.status,
            }))
            const spMsgId = stepProgressMsgIdRef.current
            if (spMsgId) updateMessage(spMsgId, { stepProgress: final })
            return final
          }
          return prev
        })
        setIsStreaming(false)
        if (embeddedInFloating) {
          window.dispatchEvent(new CustomEvent("agent:sessions-changed"))
          void AgentAPI.updateSession(requestSessionId, { last_read_at: new Date().toISOString() }).catch(() => {
            /* ignore */
          })
        }
      }
    )
  }, [addMessage, updateMessage, setMessages, refreshFollowUpState, refreshSession, embeddedInFloating, applyPendingTaskApproval])

  useEffect(() => {
    handleActionRef.current = handleAction
  }, [handleAction])

  useEffect(() => {
    if (isStreamingRef.current || !sessionIdRef.current) return
    if (approvalRequiredRef.current) return
    if (!stepState.analysisComplete || stepState.tasksCreated) return
    if (pendingTaskApproval) return
    if ((latestRecommendedTasksRef.current?.length ?? 0) === 0) return
    if (autoExternalActionsTriggeredRef.current) return
    queueAutoExternalActionsAfterAnalysis()
  }, [
    sessionId,
    isStreaming,
    approvalRequired,
    stepState.analysisComplete,
    stepState.tasksCreated,
    pendingTaskApproval,
    queueAutoExternalActionsAfterAnalysis,
  ])

  const resolveExternalApproval = useCallback(
    (
      pending: PendingExternalApproval,
      decision: "approve" | "reject",
      draft?: Record<string, unknown>
    ) => {
      if (!sessionId) return
      const streamToken = activeStreamTokenRef.current
      const requestSessionId = String(sessionId)
      AgentAPI.sendMessage(
        sessionId,
        {
          message: ".",
          action: "resolve_external_approval",
          approval_id: pending.id,
          approval_decision: decision,
          approval_draft: decision === "approve" ? draft : undefined,
        },
        (_ev: SSEEvent) => {
          if (activeStreamTokenRef.current !== streamToken) return
          if (String(sessionIdRef.current) !== requestSessionId) return
          /* streamed chunks ignored; subsequent events update UI */
        },
        () => {
          if (activeStreamTokenRef.current !== streamToken) return
          if (String(sessionIdRef.current) !== requestSessionId) return
          if (pending.kind === "task") setTasksApprovalGenerating(false)
          if (pending.kind === "miro_board") setMiroApprovalGenerating(false)
        },
        () => {
          if (activeStreamTokenRef.current !== streamToken) return
          if (String(sessionIdRef.current) !== requestSessionId) return
          void refreshSession(requestSessionId)
          if (embeddedInFloating) {
            window.dispatchEvent(new CustomEvent("agent:sessions-changed"))
            void AgentAPI.updateSession(requestSessionId, { last_read_at: new Date().toISOString() }).catch(() => {
              /* ignore */
            })
          }
        }
      )
    },
    [sessionId, refreshSession, embeddedInFloating]
  )

  const handleApproveSelectedTasks = useCallback(
    (selected: number[]) => {
      if (!pendingTaskApproval) return
      const tasks =
        (pendingTaskApproval.draft as any)?.recommended_tasks ??
        (latestRecommendedTasksRef.current ?? [])
      if (!Array.isArray(tasks) || tasks.length === 0) return

      // Mark unselected recommendations as explicitly skipped so the UI shows a red X
      // instead of falling back to "awaiting approval".
      const selectedSet = new Set(selected)
      const skipped = Array.from({ length: tasks.length }, (_, i) => i).filter((i) => !selectedSet.has(i))
      setSkippedTaskIndexes(skipped)

      const filtered = tasks
        .map((t: any, idx: number) => ({ ...t, index: idx }))
        .filter((_t: any, idx: number) => selectedSet.has(idx))

      setTasksApprovalGenerating(true)
      // Optimistic UI: immediately exit checkbox/approval mode so the right panel
      // doesn't appear "stuck" after clicking Create Tasks.
      setPendingTaskApproval(null)
      setSelectedTaskIndexes([])
      setTaskGenerationStatus("generating")
      resolveExternalApproval(pendingTaskApproval, "approve", { recommended_tasks: filtered })
    },
    [pendingTaskApproval, resolveExternalApproval]
  )

  const handleRejectTasksApproval = useCallback(() => {
    if (!pendingTaskApproval) return
    setTasksApprovalGenerating(false)
    resolveExternalApproval(pendingTaskApproval, "reject")
    setPendingTaskApproval(null)
  }, [pendingTaskApproval, resolveExternalApproval])

  const handleApproveMiroApproval = useCallback(
    () => {
      if (!pendingMiroApproval) return
      setMiroApprovalGenerating(true)
      resolveExternalApproval(pendingMiroApproval, "approve", {})
      setPendingMiroApproval(null)
    },
    [pendingMiroApproval, resolveExternalApproval]
  )

  const handleRejectMiroApproval = useCallback(() => {
    if (!pendingMiroApproval) return
    setMiroApprovalGenerating(false)
    resolveExternalApproval(pendingMiroApproval, "reject")
    setPendingMiroApproval(null)
  }, [pendingMiroApproval, resolveExternalApproval])

  // Auto-run queued external actions when streaming is idle.
  useEffect(() => {
    if (isStreaming) return
    tryRunNextAutoAction()
  }, [isStreaming, tryRunNextAutoAction])

  // Auto-send calendar context message when arriving from calendar/event page (once only).
  // Uses a module-level flag + ref to handleSendMessage so this effect only fires on mount
  // and when hasStarted changes — NOT when sessionId changes and recreates handleSendMessage.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pendingCalendarPreload || hasStarted) return
    if (_calendarAutoSendFired) return
    _calendarAutoSendFired = true
    handleSendMessageRef.current?.(pendingCalendarPreload.message, pendingCalendarPreload.context)
  }, [pendingCalendarPreload, hasStarted])

  return (
    <div className="flex h-full flex-col">
      {!embeddedInFloating && (
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 shrink-0 bg-background">
          <h2 className="text-sm font-semibold truncate text-foreground">{sessionTitle}</h2>
          {sessionId ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-muted-foreground font-medium">
                Approval
              </span>
              <ApprovalToggle
                sessionId={sessionId}
                value={approvalRequired}
                onChange={(next) => {
                  setApprovalRequired(next)
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("agent:approval-changed", { detail: { sessionId, value: next } }))
                    window.dispatchEvent(
                      new CustomEvent("agent:session-state", {
                        detail: { sessionId, title: sessionTitle, approvalRequired: next },
                      })
                    )
                  }
                }}
                disabled={isStreaming}
              />
            </div>
          ) : null}
        </div>
      )}
      {!hasStarted ? (
        <WelcomeScreen
          onSend={handleSendMessage}
          onFileUpload={handleFileUpload}
          disabled={isStreaming}
          showComposer={false}
        />
      ) : (
      <MessageList
        {...({
          messages,
          sessionId,
          approvalDisabled: isStreaming,
          approvalRequired,
          generatedTaskIndexes,
          skippedTaskIndexes,
          createdTaskIdByIndex,
          generatingTasks: !approvalRequired && stepState.analysisComplete && !stepState.tasksCreated,
          taskGenerationStatus,
          pendingTaskApproval,
          selectedTaskIndexes,
          onSelectedTaskIndexesChange: setSelectedTaskIndexes,
          tasksApprovalGenerating,
          onApproveSelectedTasks: handleApproveSelectedTasks,
          onRejectTasksApproval: handleRejectTasksApproval,
          pendingMiroApproval,
          miroApprovalGenerating,
          onApproveMiroApproval: handleApproveMiroApproval,
          onRejectMiroApproval: handleRejectMiroApproval,
          onAction: handleAction,
          onConfirmColumns: handleConfirmColumns,
          onReupload: handleReupload,
          latestAnalysisMessageId,
          showFollowUpToggle: followUpAvailable || followUpStarted,
          followUpActive: followUpStarted,
          stepState,
          onNavigate: (view: string, msg?: ChatMessage) => {
        if (msg?.navigateHref && typeof window !== "undefined") {
          window.location.href = msg.navigateHref
          return
        }
        if (view === "tasks") {
          router.push("/tasks")
          return
        }
        setActiveView(view as AgentView)
        if (floatingChat.mode === "maximized") toggleMaximize()
          },
        } as any)}
      />
      )}
      <ActionBar stepState={stepState} onReupload={handleReupload} disabled={isStreaming} />
      <ChatInput
        onSend={handleSendMessage}
        onFileUpload={handleFileUpload}
        disabled={isStreaming}
        placeholder={inputPlaceholder}
        helperText={inputHelperText}
      />
    </div>
  )
}
