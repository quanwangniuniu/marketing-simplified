"use client"

import { useRouter } from "next/navigation"
import { Bookmark, Copy, Lock, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import type { AgentWorkflowDefinition } from "@/types/agent"
import StepIconStack from "./StepIconStack"
import { useHoverCard } from "./useHoverCard"
import HoverCardPortal from "./HoverCardPortal"
import { WorkflowHoverContent } from "./WorkflowHoverPreview"
import { CreateTemplateModal } from "@/components/agent/templates/CreateTemplateModal"
import { TriggerBadge, TriggerVisualizer } from "../triggers"
import { useBuildUrl } from "@/lib/buildUrl"

const STATUS_CONFIG: Record<
  AgentWorkflowDefinition["status"],
  { dot: string; text: string; label: string }
> = {
  active:   { dot: "bg-emerald-500", text: "text-emerald-700", label: "Active" },
  draft:    { dot: "bg-amber-400",   text: "text-amber-700",   label: "Draft" },
  archived: { dot: "bg-gray-400",    text: "text-gray-500",    label: "Archived" },
}

interface WorkflowCardProps {
  workflow: AgentWorkflowDefinition
  onDuplicate?: () => void
  onDelete?: () => void
  onStatusChange?: (id: string, newStatus: string) => void
  duplicating?: boolean
  needsProject?: boolean
}

export default function WorkflowCard({
  workflow,
  onDuplicate,
  onDelete,
  onStatusChange,
  duplicating,
  needsProject,
}: WorkflowCardProps) {
  const router = useRouter()
  const buildUrl = useBuildUrl()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [localStatus, setLocalStatus] = useState(workflow.status)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const status = STATUS_CONFIG[localStatus]
  const { cardRef, isVisible, style, onMouseEnter, onMouseLeave, hoverCardHandlers, hide } = useHoverCard()

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen])

  const openEditor = () => router.push(buildUrl(`/workflows/${workflow.slug}`))

  const handleStatusChange = (id: string, newStatus: string) => {
    setLocalStatus(newStatus as AgentWorkflowDefinition["status"])
    onStatusChange?.(id, newStatus)
  }

  return (
    <>
      <HoverCardPortal isVisible={isVisible} style={style} hoverCardHandlers={hoverCardHandlers} onClick={openEditor}>
        <WorkflowHoverContent
          name={workflow.name}
          description={workflow.description}
          stepTypes={workflow.step_types ?? []}
          workflowId={workflow.id}
          workflowSlug={workflow.slug}
          currentStatus={localStatus}
          triggerConfig={workflow.trigger_config}
          onStatusChange={handleStatusChange}
          onSaveAsTemplate={() => { hide(); setShowTemplateModal(true) }}
          onDelete={!workflow.is_system && onDelete ? () => { hide(); onDelete() } : undefined}
        />
      </HoverCardPortal>

      <div
        ref={cardRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-150 hover:border-indigo-200 hover:shadow-md"
      >
        {/* Top row: icons + menu */}
        <div className="flex items-start justify-between gap-3">
          <StepIconStack stepTypes={workflow.step_types ?? []} size={36} />

          <div className="relative ml-auto" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Workflow options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 min-w-[170px] rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); openEditor() }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  disabled={needsProject || duplicating}
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDuplicate?.() }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShowTemplateModal(true) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  Save as Template
                </button>
                {!workflow.is_system && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete?.() }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Name row — clickable */}
        <button
          type="button"
          className="mt-3 flex-1 text-left"
          onClick={openEditor}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-snug text-gray-900">
              {workflow.name}
            </h3>
            {workflow.is_system && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                <Lock className="h-2.5 w-2.5" />
                System
              </span>
            )}
            {workflow.is_default && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                Default
              </span>
            )}
          </div>
        </button>

        {/* Footer: status + trigger */}
        <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${status.dot}`} />
              <span className={`text-xs font-medium ${status.text}`}>{status.label}</span>
            </div>
            {localStatus === 'active' && workflow.trigger_config?.trigger_type && (
              <TriggerBadge triggerType={workflow.trigger_config.trigger_type} size="sm" />
            )}
          </div>
          {localStatus === 'active' && workflow.trigger_config?.trigger_type && (
            <TriggerVisualizer
              workflowId={workflow.id}
              triggerType={workflow.trigger_config.trigger_type}
              triggerState={workflow.trigger_state}
            />
          )}
        </div>
      </div>

      {/* Save as Template modal — rendered outside the hover card portal */}
      <CreateTemplateModal
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSuccess={() => setShowTemplateModal(false)}
        defaultSourceWorkflowId={workflow.id}
        defaultName={workflow.name}
        defaultDescription={workflow.description}
        lockSourceWorkflow
      />
    </>
  )
}
