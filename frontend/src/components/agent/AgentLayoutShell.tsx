"use client"

import { useEffect, useState } from "react"
import { AgentLayoutProvider, useAgentLayout } from "@/components/agent/AgentLayoutContext"
import type { AgentView } from "@/lib/agentView"
import { LeftSidebar } from "@/components/agent/layout/LeftSidebar"
import { TopBar } from "@/components/agent/layout/TopBar"
import { RightPanel } from "@/components/agent/layout/RightPanel"
import { FloatingChatWindow } from "@/components/agent/chat/FloatingChatWindow"
import { AgentTour } from "@/components/agent/onboarding/AgentTour"

const TOUR_KEY = "agent-tour-completed"

function AgentThemeWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useAgentLayout()
  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      setShowTour(true)
    }
  }, [])

  useEffect(() => {
    const handler = () => setShowTour(true)
    window.addEventListener("agent:restart-tour", handler)
    return () => window.removeEventListener("agent:restart-tour", handler)
  }, [])

  const handleTourComplete = () => {
    setShowTour(false)
    localStorage.setItem(TOUR_KEY, "true")
  }

  useEffect(() => {
    if (resolvedTheme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    return () => {
      document.documentElement.classList.remove("dark")
    }
  }, [resolvedTheme])

  return (
    <div className={resolvedTheme === "dark" ? "dark" : ""}>
      <div className="h-screen flex bg-background text-foreground">
        <LeftSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>

        <RightPanel />
        <FloatingChatWindow />
      </div>

      {showTour && <AgentTour onComplete={handleTourComplete} />}
    </div>
  )
}

export function AgentLayoutShell({
  children,
  initialView,
}: {
  children: React.ReactNode
  initialView: AgentView
}) {
  return (
    <AgentLayoutProvider initialView={initialView}>
      <AgentThemeWrapper>{children}</AgentThemeWrapper>
    </AgentLayoutProvider>
  )
}
