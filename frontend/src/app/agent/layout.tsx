"use client"

import { useEffect, useState } from "react"
import { AgentLayoutProvider, useAgentLayout } from "@/components/agent/AgentLayoutContext"
import { LeftSidebar } from "@/components/agent/layout/LeftSidebar"
import { TopBar } from "@/components/agent/layout/TopBar"
import { RightPanel } from "@/components/agent/layout/RightPanel"
import { FloatingChatWindow } from "@/components/agent/chat/FloatingChatWindow"
import { AgentTour } from "@/components/agent/onboarding/AgentTour"

const TOUR_KEY = "agent-tour-completed"

function AgentThemeWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useAgentLayout()
  const [showTour, setShowTour] = useState(false)

  // Check if tour should auto-start on first visit
  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      setShowTour(true)
    }
  }, [])

  // Listen for restart-tour event from Settings
  useEffect(() => {
    const handler = () => setShowTour(true)
    window.addEventListener("agent:restart-tour", handler)
    return () => window.removeEventListener("agent:restart-tour", handler)
  }, [])

  const handleTourComplete = () => {
    setShowTour(false)
    localStorage.setItem(TOUR_KEY, "true")
  }

  // Sync dark class on documentElement for Radix Portal compatibility
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
        {/* Left Sidebar */}
        <LeftSidebar />

        {/* Center: TopBar + Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>

        {/* Right Panel */}
        <RightPanel />

        {/* Floating Chat Window */}
        <FloatingChatWindow />
      </div>

      {/* Onboarding Tour */}
      {showTour && <AgentTour onComplete={handleTourComplete} />}
    </div>
  )
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AgentLayoutProvider>
      <AgentThemeWrapper>{children}</AgentThemeWrapper>
    </AgentLayoutProvider>
  )
}
