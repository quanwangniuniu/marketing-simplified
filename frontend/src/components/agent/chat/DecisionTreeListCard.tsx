"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  GitBranch,
  Loader2,
  AlertCircle,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AgentMessageBoardText } from "./AgentMessageBoardText"
import type { RecommendedDecisionTreeNode } from "@/types/agent"
import { useBuildUrl } from "@/lib/buildUrl"

const riskColors = {
  HIGH: { bg: "bg-red-500/20", text: "text-red-400" },
  MEDIUM: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  LOW: { bg: "bg-green-500/20", text: "text-green-400" },
} as const

export type DecisionGenerationStatus =
  | "idle"
  | "generating"
  | "awaiting_approval"
  | "completed"
  | "error"

interface DecisionTreeListCardProps {
  nodes: RecommendedDecisionTreeNode[]
  messageId?: string
  blockId?: string
  /** Legacy action (pre-approval selection): creates decisions for all recommendations. */
  onCreateAll?: () => void
  approvalRequired?: boolean
  /** Refs of recommended nodes that have been created in the DB. */
  generatedDecisionRefs?: string[]
  /** Refs of recommendations the user explicitly chose NOT to create (approval flow). */
  skippedDecisionRefs?: string[]
  /** Map from node ref -> created Decision ID for deep-link navigation. */
  createdDecisionByRef?: Record<string, number>
  /** When true (approval off), but decisions not yet created, show a generating state. */
  generating?: boolean
  /** When true, render selection + create actions. */
  approvalMode?: boolean
  /** When true, render per-node checkboxes (defaults to approvalMode). */
  selectionMode?: boolean
  selectedRefs?: string[]
  onSelectedRefsChange?: (next: string[]) => void
  onCreateSelected?: (selectedRefs: string[]) => void
  createButtonDisabled?: boolean
  generationStatus?: DecisionGenerationStatus
}

export function DecisionTreeListCard({
  nodes,
  messageId = "decisions",
  blockId,
  onCreateAll,
  approvalRequired,
  generatedDecisionRefs,
  skippedDecisionRefs,
  createdDecisionByRef,
  generating,
  approvalMode,
  selectionMode,
  selectedRefs,
  onSelectedRefsChange,
  onCreateSelected,
  createButtonDisabled,
  generationStatus = "idle",
}: DecisionTreeListCardProps) {
  const buildUrl = useBuildUrl()
  const [expandedRef, setExpandedRef] = useState<string | null>(null)
  const titleTarget = `Recommended Decision Tree (${nodes.length})`

  const sortedNodes = useMemo(
    () =>
      [...nodes].sort((a, b) => {
        if (a.layer !== b.layer) return a.layer - b.layer
        return a.ref.localeCompare(b.ref)
      }),
    [nodes]
  )

  const generatedSet = useMemo(() => {
    return new Set(Array.isArray(generatedDecisionRefs) ? generatedDecisionRefs : [])
  }, [generatedDecisionRefs])

  const skippedSet = useMemo(() => {
    return new Set(Array.isArray(skippedDecisionRefs) ? skippedDecisionRefs : [])
  }, [skippedDecisionRefs])

  const selectedSet = useMemo(() => {
    return new Set(Array.isArray(selectedRefs) ? selectedRefs : [])
  }, [selectedRefs])

  const showSelection = selectionMode ?? Boolean(approvalMode)

  const toggleSelected = (ref: string) => {
    const next = new Set(selectedSet)
    if (next.has(ref)) next.delete(ref)
    else next.add(ref)
    onSelectedRefsChange?.(Array.from(next).sort())
  }

  const canCreateSelected =
    typeof onCreateSelected === "function" &&
    selectedSet.size > 0 &&
    !createButtonDisabled

  const showCreateActions = approvalMode
    ? generationStatus !== "generating" && !generating && !createButtonDisabled
    : generationStatus === "idle" && !generating && !createButtonDisabled

  if (!nodes.length) return null

  const statusChip = (() => {
    if (generationStatus === "generating" || generating) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating…
        </span>
      )
    }
    if (generationStatus === "awaiting_approval") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Awaiting approval
        </span>
      )
    }
    if (generationStatus === "completed") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600">
          <CheckCircle2 className="h-3 w-3" />
          Generated
        </span>
      )
    }
    if (generationStatus === "error") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3" />
          Failed
        </span>
      )
    }
    return null
  })()

  const handleRowClick = (node: RecommendedDecisionTreeNode) => {
    const decisionId = createdDecisionByRef?.[node.ref]
    if (decisionId != null && Number.isFinite(decisionId)) {
      window.location.href = buildUrl(`/decisions/${decisionId}`)
      return
    }
    setExpandedRef((prev) => (prev === node.ref ? null : node.ref))
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 shrink-0">
            <GitBranch className="h-4 w-4 text-violet-600" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold text-card-foreground">
              <AgentMessageBoardText
                target={titleTarget}
                partId={`${messageId}-decision-tree-title`}
                blockId={blockId}
              />
            </CardTitle>
          </div>
          {statusChip ? <div className="shrink-0">{statusChip}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-2">
        {sortedNodes.map((node) => {
          const risk = node.risk_level
            ? riskColors[node.risk_level] ?? riskColors.MEDIUM
            : null
          const isGenerated =
            generatedSet.has(node.ref) || createdDecisionByRef?.[node.ref] != null
          const isSelected = selectedSet.has(node.ref)
          const detailParts = [
            node.context_summary?.trim(),
            node.reasoning?.trim(),
          ].filter(Boolean)
          const detailTarget =
            detailParts.length > 0 ? detailParts.join("\n\n") : "No additional details."

          const statusNode = (() => {
            if (isGenerated) {
              return (
                <span
                  className="inline-flex items-center text-emerald-600"
                  title={`${node.title} is generated`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              )
            }
            if (skippedSet.has(node.ref)) {
              return (
                <span
                  className="inline-flex items-center text-destructive"
                  title={`${node.title} was not selected`}
                >
                  <XCircle className="h-4 w-4" />
                </span>
              )
            }
            if (generating || generationStatus === "generating") {
              return (
                <span
                  className="inline-flex items-center text-muted-foreground"
                  title="Generating decisions..."
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                </span>
              )
            }
            if (approvalRequired) {
              return (
                <span
                  className="inline-flex items-center text-muted-foreground"
                  title="Waiting for approval"
                >
                  <Clock className="h-4 w-4" />
                </span>
              )
            }
            return null
          })()

          return (
            <div
              key={node.ref}
              className={cn(
                "rounded-md hover:bg-muted/40 transition-colors",
                showSelection && isSelected && "bg-muted/40"
              )}
            >
              <button
                type="button"
                className="w-full text-left flex items-start gap-3 py-2 px-2 rounded-md"
                onClick={() => handleRowClick(node)}
              >
                {showSelection && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelected(node.ref)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 shrink-0 rounded border border-input"
                    disabled={createButtonDisabled || isGenerated}
                    aria-label={`Select decision ${node.title}`}
                  />
                )}
                <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5 bg-violet-500/15 text-violet-700">
                  <AgentMessageBoardText
                    target={`L${node.layer}`}
                    partId={`${messageId}-decision-${node.ref}-layer`}
                    blockId={blockId}
                  />
                </span>
                {risk ? (
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5",
                      risk.bg,
                      risk.text
                    )}
                  >
                    <AgentMessageBoardText
                      target={node.risk_level!}
                      partId={`${messageId}-decision-${node.ref}-risk`}
                      blockId={blockId}
                    />
                  </span>
                ) : null}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <AgentMessageBoardText
                      target={node.title}
                      partId={`${messageId}-decision-${node.ref}-title`}
                      blockId={blockId}
                    />
                  </p>
                  {node.topic ? (
                    <p className="text-xs text-muted-foreground">
                      <AgentMessageBoardText
                        target={node.topic}
                        partId={`${messageId}-decision-${node.ref}-topic`}
                        blockId={blockId}
                      />
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  {statusNode}
                  {expandedRef === node.ref ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>
              {expandedRef === node.ref && (
                <div className={cn("px-2 pb-2", showSelection ? "pl-[72px]" : "pl-[52px]")}>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    <AgentMessageBoardText
                      target={detailTarget}
                      partId={`${messageId}-decision-${node.ref}-detail`}
                      blockId={blockId}
                    />
                  </p>
                </div>
              )}
            </div>
          )
        })}

        {(onCreateSelected || onCreateAll) && showCreateActions && (
          <div className="pt-2">
            <Button
              size="sm"
              onClick={() => {
                if (onCreateSelected) {
                  const selected = Array.from(selectedSet)
                  onSelectedRefsChange?.([])
                  onCreateSelected(selected)
                  return
                }
                onCreateAll?.()
              }}
              disabled={onCreateSelected ? !canCreateSelected : Boolean(createButtonDisabled)}
            >
              Create Decisions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
