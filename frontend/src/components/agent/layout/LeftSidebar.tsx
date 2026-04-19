"use client"

import { useEffect, useState, useRef } from "react"
import {
  LayoutDashboard, Table, GitBranch, CheckSquare, GitFork,
  Settings, Clock, Plus, Pencil, Check, X, Settings2, Trash2, Bot,
} from "lucide-react"
import { useAgentLayout, type AgentView } from "../AgentLayoutContext"
import { cn } from "@/lib/utils"
import { AgentAPI } from "@/lib/api/agentApi"
import { useBatchManage } from "@/hooks/useBatchManage"
import ConfirmDialog from "@/components/common/ConfirmDialog"
import { AgentRecentSessionsSkeleton } from "@/components/agent/skeletons/AgentSkeletons"

const navItems: { id: AgentView; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "spreadsheets", label: "Spreadsheets", icon: Table },
  { id: "decisions", label: "Decisions", icon: GitBranch },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "workflows", label: "Workflows", icon: GitFork },
]

interface SessionItem {
  id: string
  title: string
  time: string
}

function formatTimeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return "Just now"
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days === 1) return "Yesterday"
    return `${days}d ago`
  } catch {
    return iso
  }
}

export function LeftSidebar() {
  const { activeView, isViewReady, setActiveView, openFloatingChat, floatingChat, isInSnapZone } = useAgentLayout()
  const [recentSessions, setRecentSessions] = useState<SessionItem[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const editInputRef = useRef<HTMLInputElement>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const loadSessions = async (showLoading = false) => {
    if (showLoading) {
      setSessionsLoading(true)
    }
    try {
      const sessions = await AgentAPI.listSessions()
      setRecentSessions(
        sessions.slice(0, 8).map((s) => ({
          id: String(s.id),
          title: s.title || "Untitled session",
          time: formatTimeAgo(s.created_at),
        }))
      )
    } catch {
      // keep empty
    } finally {
      if (showLoading) {
        setSessionsLoading(false)
      }
    }
  }

  // Batch manage hook
  const batch = useBatchManage({
    items: recentSessions,
    deleteFn: (id) => AgentAPI.deleteSession(id),
    onDeleteComplete: (deletedIds) => {
      setRecentSessions((prev) => prev.filter((s) => !deletedIds.includes(s.id)))
      window.dispatchEvent(new CustomEvent("agent:sessions-changed"))
    },
  })

  useEffect(() => {
    loadSessions(true)
  }, [])

  // Refresh sessions when floating chat opens (replaces old "agent view" refresh)
  useEffect(() => {
    if (floatingChat.mode !== "closed") {
      loadSessions()
    }
  }, [floatingChat.mode])

  // Refresh sessions when a new session is created
  useEffect(() => {
    const handler = () => loadSessions()
    window.addEventListener("agent:sessions-changed", handler)
    return () => window.removeEventListener("agent:sessions-changed", handler)
  }, [])

  // Focus input when editing
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const handleNewChat = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    sessionStorage.removeItem("agent-session-id")
    openFloatingChat(null, rect)
  }

  const handleSelectSession = (sessionId: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    openFloatingChat(sessionId, rect)
  }

  const startRename = (session: SessionItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(session.id)
    setEditTitle(session.title)
  }

  const confirmRename = async () => {
    if (!editingId || !editTitle.trim()) {
      setEditingId(null)
      return
    }
    try {
      await AgentAPI.updateSession(editingId, { title: editTitle.trim() })
      setRecentSessions((prev) =>
        prev.map((s) => s.id === editingId ? { ...s, title: editTitle.trim() } : s)
      )
      window.dispatchEvent(new CustomEvent("agent:sessions-changed"))
    } catch {
      // revert silently
    }
    setEditingId(null)
  }

  const cancelRename = () => {
    setEditingId(null)
  }

  const handleDeleteClick = () => {
    if (batch.selectedCount === 0) return
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false)
    await batch.deleteSelected()
  }

  return (
    <div className="w-60 h-full bg-background border-r border-border flex flex-col">
      {/* Project Header */}
      <div className="px-4 py-4 border-b border-border">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-lg font-bold text-foreground">Marketing Simplified</span>
          <span className="relative flex h-2 w-2" title="Connected">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </a>
        <p className="text-xs text-muted-foreground mt-1">AI Agent Dashboard</p>
      </div>

      {/* Navigation */}
      <nav className="py-2" data-tour="tour-nav">
        <div className="px-3 mb-2">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Workspaces</span>
        </div>
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = isViewReady && activeView === id
          return (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-2",
                isActive
                  ? "border-blue-500 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          )
        })}
      </nav>

      {/* Recent Sessions */}
      <div
        className={cn(
          "flex-1 overflow-y-auto border-t border-border transition-all duration-200",
          isInSnapZone && "ring-2 ring-blue-500/50 bg-blue-500/5 ring-inset"
        )}
      >
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Recent</span>
          <div className="flex items-center gap-1">
            {batch.isManaging ? (
              <>
                <span className="text-[10px] text-muted-foreground mr-1">
                  {batch.selectedCount} selected
                </span>
                <button
                  onClick={handleDeleteClick}
                  disabled={batch.selectedCount === 0 || batch.isDeleting}
                  className="text-red-400 hover:text-red-300 disabled:opacity-30 transition-colors"
                  title="Delete selected"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={batch.exitManageMode}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Exit manage mode"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                {recentSessions.length > 0 && (
                  <button
                    onClick={batch.enterManageMode}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Manage sessions"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={handleNewChat}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="New chat"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="px-3 pb-2">
          <button
            onClick={handleNewChat}
            data-tour="tour-chat"
            className="w-full flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <Bot className="w-4 h-4 text-primary" />
            <span>New Dialogue</span>
          </button>
        </div>
        <div className="px-2 pb-2 space-y-0.5">
          {sessionsLoading ? (
            <AgentRecentSessionsSkeleton />
          ) : recentSessions.length === 0 ? (
            <span className="px-2 text-xs text-muted-foreground/60">No recent sessions</span>
          ) : (
            recentSessions.map((session) => (
              <div
                key={session.id}
                data-session-id={session.id}
                className={cn(
                  "transition-all duration-300",
                  batch.isExiting(session.id) && "opacity-0 scale-95 -translate-x-2"
                )}
              >
                {editingId === session.id ? (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <input
                      ref={editInputRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmRename()
                        if (e.key === "Escape") cancelRename()
                      }}
                      className="flex-1 text-xs bg-muted border border-input rounded px-1.5 py-0.5 text-foreground outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
                    />
                    <button onClick={confirmRename} className="text-emerald-400 hover:text-emerald-300 shrink-0">
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={cancelRename} className="text-muted-foreground hover:text-foreground shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : batch.isManaging ? (
                  <button
                    onClick={() => batch.toggleSelect(session.id)}
                    className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={batch.selectedIds.has(session.id)}
                      readOnly
                      className="w-3 h-3 rounded border-muted-foreground/40 accent-blue-500 shrink-0 pointer-events-none"
                    />
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {session.title}
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={(e) => handleSelectSession(session.id, e)}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50 transition-colors group",
                      floatingChat.sessionId === session.id && floatingChat.mode !== "closed" && "bg-muted/50"
                    )}
                  >
                    <Clock className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                    <span className="text-xs text-muted-foreground group-hover:text-foreground truncate flex-1">
                      {session.title}
                    </span>
                    <button
                      onClick={(e) => startRename(session, e)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-foreground shrink-0 transition-opacity"
                      title="Rename"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">{session.time}</span>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="border-t border-border">
        <div className="px-4 py-3">
          <button
            onClick={() => setActiveView("settings")}
            className={cn(
              "flex items-center gap-2 text-sm transition-colors",
              isViewReady && activeView === "settings"
                ? "text-foreground"
                : "text-muted-foreground hover:text-card-foreground"
            )}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Sessions"
        message={`Are you sure you want to delete ${batch.selectedCount} session${batch.selectedCount !== 1 ? "s" : ""}? This action cannot be undone.`}
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
