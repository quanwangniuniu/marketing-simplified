"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

export type AgentView = "overview" | "spreadsheets" | "decisions" | "tasks" | "workflows" | "settings"
export type AgentTheme = "light" | "dark" | "system"
export type FloatingChatMode = "closed" | "floating" | "maximized"

interface FloatingChatState {
  mode: FloatingChatMode
  sessionId: string | null       // null = WelcomeScreen
  originRect: DOMRect | null     // sidebar item position for animation origin/destination
}

interface AgentLayoutContextType {
  activeView: AgentView
  isViewReady: boolean
  setActiveView: (view: AgentView) => void
  isRightPanelOpen: boolean
  toggleRightPanel: () => void
  theme: AgentTheme
  setTheme: (theme: AgentTheme) => void
  resolvedTheme: "light" | "dark"
  // Floating chat
  floatingChat: FloatingChatState
  openFloatingChat: (sessionId: string | null, originRect: DOMRect | null) => void
  closeFloatingChat: () => void
  toggleMaximize: () => void
  setFloatingSessionId: (id: string | null) => void
  isInSnapZone: boolean
  setIsInSnapZone: (v: boolean) => void
  // Pending navigation
  pendingDecisionId: number | null
  setPendingDecisionId: (id: number | null) => void
}

const AgentLayoutContext = createContext<AgentLayoutContextType | null>(null)

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function AgentLayoutProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveViewState] = useState<AgentView>("overview")
  const [isViewReady, setIsViewReady] = useState(false)
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true)
  const [theme, setThemeState] = useState<AgentTheme>("light")
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light")
  const [isInSnapZone, setIsInSnapZone] = useState(false)
  const [pendingDecisionId, setPendingDecisionId] = useState<number | null>(null)

  const [floatingChat, setFloatingChat] = useState<FloatingChatState>({
    mode: "closed",
    sessionId: null,
    originRect: null,
  })

  const setActiveView = (view: AgentView) => {
    setActiveViewState(view)
    setIsViewReady(true)
    sessionStorage.setItem("agent-active-view", view)
  }

  // Load persisted view + theme on mount (with "agent" migration guard)
  useEffect(() => {
    const storedView = sessionStorage.getItem("agent-active-view")
    if (storedView === "agent") {
      // Migration: "agent" view no longer exists
      sessionStorage.setItem("agent-active-view", "overview")
      setActiveViewState("overview")
    } else if (storedView && ["overview", "spreadsheets", "decisions", "tasks", "workflows", "settings"].includes(storedView)) {
      setActiveViewState(storedView as AgentView)
    }
    setIsViewReady(true)
    // Theme forced to light — Marketing Simplified does not support dark mode yet
    // const stored = localStorage.getItem("agent-theme") as AgentTheme | null
    // if (stored && ["light", "dark", "system"].includes(stored)) {
    //   setThemeState(stored)
    // }
    // setSystemTheme(getSystemTheme())
  }, [])

  // Listen for OS theme changes — disabled while theme is forced to light
  // useEffect(() => {
  //   const mql = window.matchMedia("(prefers-color-scheme: dark)")
  //   const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? "dark" : "light")
  //   mql.addEventListener("change", handler)
  //   return () => mql.removeEventListener("change", handler)
  // }, [])

  // Currently inactive — resolvedTheme is hardcoded to "light" and localStorage read is disabled.
  // Retained for future dark mode re-enable; remove this comment when restoring theme support.
  const setTheme = (t: AgentTheme) => {
    setThemeState(t)
    localStorage.setItem("agent-theme", t)
  }

  // Force light — when Marketing Simplified supports dark mode, restore: theme === "system" ? systemTheme : theme
  const resolvedTheme: "light" | "dark" = "light"

  // --- Floating chat controls ---

  const openFloatingChat = useCallback((sessionId: string | null, originRect: DOMRect | null) => {
    setFloatingChat((prev) => {
      // If already open with same session, just keep it
      if (prev.mode !== "closed" && prev.sessionId === sessionId) return prev
      // If open with different session, swap sessionId and dispatch event
      if (prev.mode !== "closed") {
        // Dispatch event so AgentChatPage loads the new session
        if (sessionId) {
          window.dispatchEvent(new CustomEvent("agent:load-session", { detail: { sessionId } }))
        } else {
          sessionStorage.removeItem("agent-session-id")
          window.dispatchEvent(new CustomEvent("agent:new-chat"))
        }
        return { ...prev, sessionId, originRect }
      }
      // Opening from closed: set sessionStorage so AgentChatPage reads it on mount
      // (don't dispatch event — component isn't mounted yet to receive it)
      if (sessionId) {
        sessionStorage.setItem("agent-session-id", sessionId)
      } else {
        sessionStorage.removeItem("agent-session-id")
      }
      return { mode: sessionId ? "floating" : "maximized", sessionId, originRect }
    })
  }, [])

  const closeFloatingChat = useCallback(() => {
    setFloatingChat({ mode: "closed", sessionId: null, originRect: null })
    setIsInSnapZone(false)
  }, [])

  const toggleMaximize = useCallback(() => {
    setFloatingChat((prev) => {
      if (prev.mode === "floating") return { ...prev, mode: "maximized" }
      if (prev.mode === "maximized") return { ...prev, mode: "floating" }
      return prev
    })
  }, [])

  const setFloatingSessionId = useCallback((id: string | null) => {
    setFloatingChat((prev) => ({ ...prev, sessionId: id }))
  }, [])

  return (
    <AgentLayoutContext.Provider
      value={{
        activeView,
        isViewReady,
        setActiveView,
        isRightPanelOpen,
        toggleRightPanel: () => setIsRightPanelOpen((prev) => !prev),
        theme,
        setTheme,
        resolvedTheme,
        floatingChat,
        openFloatingChat,
        closeFloatingChat,
        toggleMaximize,
        setFloatingSessionId,
        isInSnapZone,
        setIsInSnapZone,
        pendingDecisionId,
        setPendingDecisionId,
      }}
    >
      {children}
    </AgentLayoutContext.Provider>
  )
}

export function useAgentLayout() {
  const ctx = useContext(AgentLayoutContext)
  if (!ctx) throw new Error("useAgentLayout must be used within AgentLayoutProvider")
  return ctx
}
