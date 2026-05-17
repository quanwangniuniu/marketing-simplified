"use client"

import { PanelRightClose, PanelRightOpen, ChevronRight } from "lucide-react"
import { useAgentLayout, type AgentView } from "../AgentLayoutContext"
import { Button } from "@/components/ui/button"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ThemeToggle } from "./ThemeToggle"

const viewLabels: Record<AgentView, string> = {
  overview: "Overview Dashboard",
  spreadsheets: "Spreadsheet Analysis",
  tasks: "Task Board",
  workflows: "Workflow Manager",
  settings: "Settings",
}

export function TopBar() {
  const { activeView, isRightPanelOpen, toggleRightPanel } = useAgentLayout()

  return (
    <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Agent</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
        <span className="text-foreground font-medium">{viewLabels[activeView]}</span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1">
        {/* <ThemeToggle /> — disabled until Marketing Simplified supports dark mode */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleRightPanel}
          className={`text-muted-foreground hover:text-foreground gap-2 ${isRightPanelOpen ? "bg-muted" : ""}`}
          title={isRightPanelOpen ? "Close panel" : "Open panel"}
        >
          {isRightPanelOpen ? (
            <>
              <PanelRightClose className="w-4 h-4" />
              <span className="text-xs">Hide Panel</span>
            </>
          ) : (
            <>
              <PanelRightOpen className="w-4 h-4" />
              <span className="text-xs">Show Panel</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
