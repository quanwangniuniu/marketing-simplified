"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAgentLayout, type AgentView } from "@/components/agent/AgentLayoutContext"
import { WelcomeScreen } from "./WelcomeScreen"
import { MessageList, type ChatMessage } from "./MessageList"
import { ChatInput } from "./ChatInput"
import { ActionBar } from "./ActionBar"
import { AgentAPI } from "@/lib/api/agentApi"
import type { SSEEvent, AgentAction, AgentMessage, AnalysisResult, WorkflowStepState, ColumnDetectionData } from "@/types/agent"
import { AGENT_MESSAGES } from "@/lib/agentMessages"
import type { StepProgressItem } from "./StepProgress"

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
  } else if (m.message_type === "decision_draft" || m.data?.decision_id) {
    type = "decision_created"
    navigateTo = "decisions"
    navigateLabel = "Review Pre-Draft"
  }

  return {
    id: String(m.id),
    role: m.role,
    content: m.content,
    type,
    isFollowUpPrompt,
    anomalies: m.data?.anomalies,
    suggestedDecision: m.data?.suggested_decision,
    recommendedTasks: m.data?.recommended_tasks,
    navigateTo,
    navigateLabel,
    navigateDisabled,
    navigateHref,
    eventType,
    workflowRunId: m.data?.workflow_run_id,
    decisionId: m.data?.decision_id ? Number(m.data.decision_id) : undefined,
  }
}

type CalendarPreload = { message: string; context: Record<string, unknown> }

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

export function AgentChatPage() {
  const router = useRouter()
  const { setActiveView, floatingChat, toggleMaximize, setPendingDecisionId } = useAgentLayout()
  const [sessionId, setSessionIdState] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [stepProgress, setStepProgress] = useState<StepProgressItem[]>([])
  const [stepState, setStepState] = useState<WorkflowStepState>({
    analysisComplete: false,
    decisionCreated: false,
    tasksCreated: false,
  })
  const [followUpAvailable, setFollowUpAvailable] = useState(false)
  const [followUpStarted, setFollowUpStarted] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
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
  // Stores recommended tasks from latest analysis so decision_created messages can show TaskListCard
  const latestRecommendedTasksRef = useRef<import("@/types/agent").RecommendedTask[] | null>(null)

  const setSessionId = useCallback((id: string | null) => {
    sessionIdRef.current = id
    setSessionIdState(id)
    if (id) {
      sessionStorage.setItem("agent-session-id", id)
    } else {
      sessionStorage.removeItem("agent-session-id")
    }
  }, [])

  const applySessionState = useCallback((session: Awaited<ReturnType<typeof AgentAPI.getSession>>) => {
    setSessionId(String(session.id))
    setHasStarted(true)

    // Restore messages and back-fill recommendedTasks onto decision_created messages
    // (the backend does not persist recommended_tasks on decision events, only on analysis events)
    const restored = session.messages.map(restoreMessage)
    let lastTasks: import("@/types/agent").RecommendedTask[] | undefined
    for (let i = 0; i < restored.length; i++) {
      if (restored[i].type === "analysis") {
        lastTasks = restored[i].recommendedTasks
        latestRecommendedTasksRef.current = lastTasks || null
      } else if (restored[i].type === "decision_created" && lastTasks && !restored[i].recommendedTasks) {
        restored[i] = { ...restored[i], recommendedTasks: lastTasks }
      }
    }
    setMessages(restored)
    setFollowUpAvailable(Boolean(session.follow_up_available))
    setFollowUpStarted(Boolean(session.follow_up_started))
    broadcastRestoredAnomalies(session.messages)
    // Derive step state from restored messages.
    // Each new analysis event starts a fresh cycle — reset downstream flags so that
    // task/decision data from a *previous* upload cycle does not carry over.
    const restoredStepState: WorkflowStepState = {
      analysisComplete: false,
      decisionCreated: false,
      tasksCreated: false,
    }
    for (const m of session.messages) {
      if (m.data?.anomalies) {
        restoredStepState.analysisComplete = true
        restoredStepState.decisionCreated = false
        restoredStepState.tasksCreated = false
      }
      if (m.message_type === "decision_draft" || m.data?.decision_id) restoredStepState.decisionCreated = true
      if (m.message_type === "task_created" || m.data?.task_ids) restoredStepState.tasksCreated = true
    }
    setStepState(restoredStepState)
  }, [setSessionId])

  const refreshFollowUpState = useCallback(async (id: string) => {
    try {
      const session = await AgentAPI.getSession(id)
      setFollowUpAvailable(Boolean(session.follow_up_available))
      setFollowUpStarted(Boolean(session.follow_up_started))
    } catch {
      // ignore refresh failures; next restore/poll can retry
    }
  }, [])

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
        // decision_created messages don't lose their recommendedTasks during polling.
        const restored = session.messages.map(restoreMessage)
        let lastTasks: import("@/types/agent").RecommendedTask[] | undefined
        for (let i = 0; i < restored.length; i++) {
          if (restored[i].type === "analysis") {
            lastTasks = restored[i].recommendedTasks
          } else if (restored[i].type === "decision_created" && lastTasks && !restored[i].recommendedTasks) {
            restored[i] = { ...restored[i], recommendedTasks: lastTasks }
          }
        }
        setMessages(restored)
        setFollowUpAvailable(Boolean(session.follow_up_available))
        setFollowUpStarted(Boolean(session.follow_up_started))
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
      AgentAPI.getSession(storedId)
        .then((session) => applySessionState(session))
        .catch(() => {
          sessionStorage.removeItem("agent-session-id")
        })
    }
  }, [applySessionState])

  // Listen for sidebar events
  useEffect(() => {
    const handleNewChat = () => {
      setSessionIdState(null)
      sessionStorage.removeItem("agent-session-id")
      sessionStorage.removeItem("agent-session-calendar-context")
      setMessages([])
      setSessionCalendarContext(null)
      setHasStarted(false)
      setIsStreaming(false)
      setFollowUpAvailable(false)
      setFollowUpStarted(false)
      setStepState({ analysisComplete: false, decisionCreated: false, tasksCreated: false })
      abortRef.current?.abort()
    }

    const handleLoadSession = async (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail?.sessionId) return

      try {
        const session = await AgentAPI.getSession(detail.sessionId)
        applySessionState(session)
      } catch {
        // Session not found — stay on welcome
      }
    }

    window.addEventListener("agent:new-chat", handleNewChat)
    window.addEventListener("agent:load-session", handleLoadSession)
    return () => {
      window.removeEventListener("agent:new-chat", handleNewChat)
      window.removeEventListener("agent:load-session", handleLoadSession)
    }
  }, [applySessionState])

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
    // Reset workflow state so a new file always starts from "Create Decision"
    setStepState({ analysisComplete: false, decisionCreated: false, tasksCreated: false })

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

    abortRef.current = AgentAPI.uploadAndAnalyze(
      file,
      sessionId,
      (event: SSEEvent) => {
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
          updateMessage(aiMsgId, {
            content: contentParts.join("\n"),
            type: "analysis",
            anomalies: analysisData?.anomalies,
            suggestedDecision: analysisData?.suggested_decision,
            recommendedTasks: analysisData?.recommended_tasks,
          })
          // Individual anomalies are added to the right panel via the
          // AnomalyCard "+ Add" button — no auto-broadcast on new analysis.
        } else if (event.type === "confirmation_request") {
          // If column mapping already shown, don't overwrite the card — just
          // silently wait for user confirmation via ColumnMappingCard buttons.
          if (!columnMappingReceived) {
            contentParts.push(event.content || "")
            updateMessage(aiMsgId, { content: contentParts.join("\n") })
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
        updateMessage(aiMsgId, { content: `Error: ${error.message}`, type: "error" })
        setIsStreaming(false)
      },
      () => {
        if (sessionId) {
          void refreshFollowUpState(sessionId)
        }
        setIsStreaming(false)
      }
    )
  }, [sessionId, addMessage, updateMessage, setSessionId, refreshFollowUpState])

  /** Confirm detected column mapping and resume paused workflow */
  const handleConfirmColumns = useCallback(async (mapping: Record<string, string>) => {
    const sid = sessionIdRef.current
    if (!sid) return

    const aiMsgId = `ai-${Date.now()}`
    addMessage({ id: aiMsgId, role: "assistant", content: AGENT_MESSAGES.CHAT_THINKING, type: "text" })
    setIsStreaming(true)
    // Preserve step names from the upload phase; reset steps 3+ to pending
    setStepProgress((prev) =>
      prev.map((s) => ({
        ...s,
        status: s.order <= 2 ? ("completed" as const) : ("pending" as const),
      }))
    )
    let contentParts: string[] = []

    abortRef.current = AgentAPI.sendMessage(
      sid,
      { message: "confirm_columns", action: "confirm_columns", column_mapping: mapping },
      (event: SSEEvent) => {
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
          updateMessage(aiMsgId, {
            type: "analysis",
            anomalies: data.anomalies,
            suggestedDecision: data.suggested_decision,
            recommendedTasks: data.recommended_tasks,
          })
        }
        if (event.type === "decision_draft" && event.data) {
          const decisionId = event.data?.decision_id
          setStepState((prev) => ({ ...prev, decisionCreated: true }))
          updateMessage(aiMsgId, {
            content: contentParts.join("\n"),
            type: "decision_created",
            navigateTo: "decisions",
            navigateLabel: "Review Pre-Draft",
            decisionId: decisionId ? Number(decisionId) : undefined,
            recommendedTasks: latestRecommendedTasksRef.current || undefined,
          })
        }
        if (event.type === "task_created" && event.data) {
          setStepState((prev) => ({ ...prev, tasksCreated: true }))
          updateMessage(aiMsgId, {
            content: contentParts.join("\n"),
            type: "tasks_created",
            navigateTo: "tasks",
            navigateLabel: "Go to Tasks",
          })
        }
      },
      (error) => {
        updateMessage(aiMsgId, { content: `Error: ${error.message}`, type: "error" })
        setIsStreaming(false)
      },
      () => {
        void refreshFollowUpState(sid)
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
      }
    )
  }, [addMessage, updateMessage, refreshFollowUpState])

  // Keep ref in sync so handleFileUpload's done handler can call the latest version
  handleConfirmColumnsRef.current = handleConfirmColumns

  /** Re-upload: reset to welcome screen so the user can upload a different file */
  const handleReupload = useCallback(() => {
    sessionIdRef.current = null
    stepProgressMsgIdRef.current = null
    setSessionIdState(null)
    sessionStorage.removeItem("agent-session-id")
    setMessages([])
    setHasStarted(false)
    setIsStreaming(false)
    setFollowUpAvailable(false)
    setFollowUpStarted(false)
    setStepProgress([])
    setStepState({ analysisComplete: false, decisionCreated: false, tasksCreated: false })
    latestRecommendedTasksRef.current = null
    abortRef.current?.abort()
  }, [])

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
        const session = await AgentAPI.createSession({})
        sid = String(session.id)
        setSessionId(sid)
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

    abortRef.current = AgentAPI.sendMessage(
      sid!,
      {
        message: text,
        ...(effectiveCalendarContext ? { calendar_context: effectiveCalendarContext as any } : {}),
      },
      (event: SSEEvent) => {
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
          updateMessage(aiMsgId, {
            type: "analysis",
            anomalies: data.anomalies,
            suggestedDecision: data.suggested_decision,
            recommendedTasks: data.recommended_tasks,
          })
          // Individual anomalies are added to the right panel via the
          // AnomalyCard "+ Add" button — no auto-broadcast on new analysis.
        }
        if (event.type === "decision_draft" && event.data) {
          const decisionId = event.data?.decision_id
          setStepState((prev) => ({ ...prev, decisionCreated: true }))
          updateMessage(aiMsgId, {
            content: contentParts.join("\n"),
            type: "decision_created",
            navigateTo: "decisions",
            navigateLabel: "Review Pre-Draft",
            decisionId: decisionId ? Number(decisionId) : undefined,
            recommendedTasks: latestRecommendedTasksRef.current || undefined,
          })
        }
        if (event.type === "task_created" && event.data) {
          setStepState((prev) => ({ ...prev, tasksCreated: true }))
          updateMessage(aiMsgId, {
            content: contentParts.join("\n"),
            type: "tasks_created",
            navigateTo: "tasks",
            navigateLabel: "Go to Tasks",
          })
        }
        if (event.type === "miro_status") {
          updateMessage(aiMsgId, {
            content: event.content || "Miro board generation started in background.",
            type: "miro_status",
            navigateTo: "miro",
            navigateLabel: "Generating Miro...",
            navigateDisabled: true,
            eventType: "miro_generation_started",
            workflowRunId: event.data?.workflow_run_id,
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
        updateMessage(aiMsgId, { content: `Error: ${error.message}`, type: "error" })
        setIsStreaming(false)
      },
      () => {
        if (sid) {
          void refreshFollowUpState(String(sid))
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
        setIsStreaming(false)
      }
    )
  }, [sessionId, sessionCalendarContext, addMessage, updateMessage, setSessionId, refreshFollowUpState])

  // Keep ref always pointing to the latest handleSendMessage
  handleSendMessageRef.current = handleSendMessage

  /** Handle action buttons (Create Decision, Create Tasks) */
  const handleAction = useCallback(async (action: string) => {
    if (!sessionId) return

    const actionMap: Record<string, AgentAction> = {
      confirm_decision: "confirm_decision",
      create_tasks: "create_tasks",
      generate_miro: "generate_miro",
      distribute_message: "distribute_message",
      start_follow_up: "start_follow_up",
      cancel_follow_up: "cancel_follow_up",
    }
    const agentAction = actionMap[action]
    if (!agentAction) return

    const aiMsgId = `ai-${Date.now()}`
    addMessage({ id: aiMsgId, role: "assistant", content: AGENT_MESSAGES.CHAT_THINKING, type: "text" })

    setIsStreaming(true)
    let contentParts: string[] = []

    abortRef.current = AgentAPI.sendMessage(
      sessionId,
      { message: action, action: agentAction },
      (event: SSEEvent) => {
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

        if (event.type === "decision_draft") {
          const decisionId = event.data?.decision_id
          setStepState((prev) => ({ ...prev, decisionCreated: true }))
          updateMessage(aiMsgId, {
            content: contentParts.join("\n"),
            type: "decision_created",
            navigateTo: "decisions",
            navigateLabel: "Review Pre-Draft",
            decisionId: decisionId ? Number(decisionId) : undefined,
            recommendedTasks: latestRecommendedTasksRef.current || undefined,
          })
        }
        if (event.type === "task_created") {
          setStepState((prev) => ({ ...prev, tasksCreated: true }))
          updateMessage(aiMsgId, {
            content: contentParts.join("\n"),
            type: "tasks_created",
            navigateTo: "tasks",
            navigateLabel: "Go to Tasks",
          })
        }
        if (event.type === "miro_status") {
          updateMessage(aiMsgId, {
            content: event.content || "Miro board generation started in background.",
            type: "miro_status",
            navigateTo: "miro",
            navigateLabel: "Generating Miro...",
            navigateDisabled: true,
            eventType: "miro_generation_started",
            workflowRunId: event.data?.workflow_run_id,
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
        updateMessage(aiMsgId, { content: `Error: ${error.message}`, type: "error" })
        setIsStreaming(false)
      },
      () => {
        void refreshFollowUpState(sessionId)
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
      }
    )
  }, [sessionId, addMessage, updateMessage, refreshFollowUpState])

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

  if (!hasStarted) {
    return (
      <WelcomeScreen
        onSend={handleSendMessage}
        onFileUpload={handleFileUpload}
        disabled={isStreaming}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} onAction={handleAction} onConfirmColumns={handleConfirmColumns} onReupload={handleReupload} latestAnalysisMessageId={latestAnalysisMessageId} showFollowUpToggle={followUpAvailable || followUpStarted} followUpActive={followUpStarted} stepState={stepState} onNavigate={(view, msg) => {
        if (msg?.navigateHref && typeof window !== "undefined") {
          window.location.href = msg.navigateHref
          return
        }
        if (view === "decisions" && msg?.decisionId) {
          router.push(`/decisions/${msg.decisionId}`)
          return
        }
        if (view === "tasks") {
          router.push("/tasks")
          return
        }
        setActiveView(view as AgentView)
        if (floatingChat.mode === "maximized") toggleMaximize()
      }} />
      <ActionBar stepState={stepState} onAction={handleAction} onReupload={handleReupload} disabled={isStreaming} />
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
