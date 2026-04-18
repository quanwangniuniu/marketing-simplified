"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import {
  Plus,
  X,
  Check,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Target,
  DollarSign,
  FileText,
  Shield,
  ChevronLeft,
  Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import ConfirmDialog from "@/components/common/ConfirmDialog"
import DecisionCommitConfirmationModal from "@/components/decisions/DecisionCommitConfirmationModal"
import { AgentAPI } from "@/lib/api/agentApi"
import { DecisionAPI } from "@/lib/api/decisionApi"
import { useBatchManage } from "@/hooks/useBatchManage"
import { useProjectStore } from "@/lib/projectStore"
import { useAgentLayout } from "@/components/agent/AgentLayoutContext"
import { validateDecisionDraft } from "@/components/decisions/decisionValidation"
import type { DecisionOptionDraft, DecisionRiskLevel } from "@/types/decision"
import toast from "react-hot-toast"
import {
  AgentDecisionDetailSkeleton,
  AgentDecisionListSkeleton,
} from "@/components/agent/skeletons/AgentSkeletons"

// ─── Types ────────────────────────────────────────────

interface Signal {
  id: string
  type: "metric" | "trend" | "alert"
  label: string
  value: string
}

interface Option {
  id: string
  title: string
  description: string
  expectedImpact: string
  riskLevel: "low" | "medium" | "high"
}

interface DecisionListItem {
  id: number
  title: string
  status: string
  risk_level: string
  author: string
  created_at: string
  is_pre_draft?: boolean
}

const signalIcons = {
  metric: BarChart3,
  trend: TrendingUp,
  alert: AlertTriangle,
}

const riskColors: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  high: "bg-red-500/10 text-red-400 border-red-500/20",
}

const statusStyles: Record<string, string> = {
  predraft: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  draft: "bg-muted/50 text-muted-foreground border-input",
  pre_draft: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  committed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  awaiting_approval: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  reviewed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  archived: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

const statusLabels: Record<string, string> = {
  predraft: "Pre-Draft",
  draft: "Draft",
  committed: "Committed",
  awaiting_approval: "Awaiting Approval",
  reviewed: "Reviewed",
  archived: "Archived",
}

const focusOrder = ["title", "context", "signals", "reasoning", "options", "selected", "priority", "confidence"]

// ─── Component ────────────────────────────────────────

export function DecisionEditor() {
  // Decision list mode vs edit mode
  const [viewMode, setViewMode] = useState<"list" | "edit">("list")
  const [decisionList, setDecisionList] = useState<DecisionListItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Editing state
  const [editingDecisionId, setEditingDecisionId] = useState<number | null>(null)
  const [editingStatus, setEditingStatus] = useState<string>("draft")
  const [isPreDraft, setIsPreDraft] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [commitModalOpen, setCommitModalOpen] = useState(false)
  const [commitConfirmations, setCommitConfirmations] = useState<Record<string, boolean>>({
    alternatives: false,
    risk: false,
    review: false,
  })
  const [confirming, setConfirming] = useState(false)
  const activeProject = useProjectStore((s) => s.activeProject)

  // Batch management for pre-draft decisions only
  const predraftItems = decisionList.filter((d) => d.status?.toLowerCase() === "predraft")

  const batchDeleteFn = useCallback(async (id: string | number) => {
    await DecisionAPI.deleteDecision(Number(id), activeProject?.id)
  }, [activeProject?.id])

  const batchDeleteComplete = useCallback((deletedIds: (string | number)[]) => {
    const idSet = new Set(deletedIds.map(Number))
    setDecisionList((prev) => prev.filter((d) => !idSet.has(d.id)))
    toast.success(`Deleted ${deletedIds.length} decision${deletedIds.length > 1 ? "s" : ""}`)
  }, [])

  const batch = useBatchManage({
    items: predraftItems.map((d) => ({ id: d.id })),
    deleteFn: batchDeleteFn,
    onDeleteComplete: batchDeleteComplete,
  })

  // Form state
  const [title, setTitle] = useState("")
  const [context, setContext] = useState("")
  const [reasoning, setReasoning] = useState("")
  const [signals, setSignals] = useState<Signal[]>([])
  const [options, setOptions] = useState<Option[]>([])
  const [selectedOption, setSelectedOption] = useState<string>("")
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium")
  const [confidenceScore, setConfidenceScore] = useState<number>(3)

  // New signal form
  const [newSignalLabel, setNewSignalLabel] = useState("")
  const [newSignalValue, setNewSignalValue] = useState("")
  const [showNewSignal, setShowNewSignal] = useState(false)

  // New option form
  const [showNewOption, setShowNewOption] = useState(false)
  const [newOptionTitle, setNewOptionTitle] = useState("")
  const [newOptionDesc, setNewOptionDesc] = useState("")
  const [newOptionImpact, setNewOptionImpact] = useState("")
  const [newOptionRisk, setNewOptionRisk] = useState<"low" | "medium" | "high">("medium")

  // Load decision list
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await AgentAPI.fetchRecentDecisions()
        if (cancelled) return
        setDecisionList(data)
      } catch {
        // keep empty
      } finally {
        if (!cancelled) setListLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const loadDecision = useCallback(async (d: DecisionListItem) => {
    // Set basic info immediately and switch to edit view
    setDetailLoading(true)
    setTitle(d.title)
    const riskLevel = (d.risk_level || "").toLowerCase()
    setPriority(riskLevel === "low" || riskLevel === "medium" || riskLevel === "high" ? riskLevel : "medium")
    setContext("")
    setReasoning("")
    setSignals([])
    setOptions([])
    setSelectedOption("")
    setEditingDecisionId(d.id)
    setEditingStatus((d.status || "draft").toLowerCase())
    setIsPreDraft(d.is_pre_draft ?? false)
    setViewMode("edit")

    // Fetch full decision detail to populate context, reasoning, signals, options
    try {
      let detail: { title?: string | null; contextSummary?: string | null; reasoning?: string | null; options?: { text: string; isSelected: boolean }[]; signals?: { id: number; type: string; description: string; severity?: string | null }[] } | null = null

      // Try draft endpoint first, then committed
      const projectId = activeProject?.id
      try {
        detail = await DecisionAPI.getDraft(d.id, projectId)
      } catch {
        try {
          detail = await DecisionAPI.getDecision(d.id, projectId)
        } catch {
          // neither worked
        }
      }

      if (detail) {
        if (detail.title) setTitle(detail.title)
        if (detail.contextSummary) setContext(detail.contextSummary)
        if (detail.reasoning) setReasoning(detail.reasoning)
        const raw = detail as unknown as Record<string, unknown>
        if (typeof raw.confidenceScore === "number") setConfidenceScore(raw.confidenceScore as number)
        else if (raw.confidenceScore == null) setConfidenceScore(3)

        // Map API signals to local Signal type
        if (detail.signals && detail.signals.length > 0) {
          setSignals(detail.signals.map((s) => {
            const raw = s as unknown as Record<string, unknown>
            const displayText = (raw.displayText as string) || (raw.description as string) || "Signal"
            const metric = (raw.metric as string) || (raw.type as string) || ""
            const movement = (raw.movement as string) || ""
            return {
              id: String(s.id),
              type: "metric" as Signal["type"],
              label: displayText,
              value: movement || metric,
            }
          }))
        }

        // Map API options to local Option type
        if (detail.options && detail.options.length > 0) {
          const mappedOptions = detail.options.map((o, i) => ({
            id: `o${i}-${Date.now()}`,
            title: o.text,
            description: "",
            expectedImpact: "",
            riskLevel: "medium" as const,
          }))
          setOptions(mappedOptions)
          // Set selected option
          const selectedIdx = detail.options.findIndex((o) => o.isSelected)
          if (selectedIdx >= 0) {
            setSelectedOption(mappedOptions[selectedIdx].id)
          }
        }
      }
    } catch {
      // Keep what we have from the list item
    } finally {
      setDetailLoading(false)
    }
  }, [activeProject?.id])

  const createNew = () => {
    setTitle("")
    setContext("")
    setReasoning("")
    setSignals([])
    setOptions([])
    setSelectedOption("")
    setPriority("medium")
    setEditingDecisionId(null)
    setEditingStatus("draft")
    setViewMode("edit")
    setDetailLoading(false)
  }

  // ─── Validation ─────────────────────────────────────

  const incompleteToastId = "decision-draft-incomplete"

  const draftOptions: DecisionOptionDraft[] = options.map((o, index) => ({
    text: o.title,
    isSelected: selectedOption === o.id,
    order: index,
  }))

  const draftValidationErrors = validateDecisionDraft(
    {
      title,
      contextSummary: context,
      reasoning,
      riskLevel: priority.toUpperCase() as DecisionRiskLevel,
      confidenceScore,
      options: draftOptions,
    },
    signals.length
  )

  const validationItems = [
    { key: "title", label: "Title provided", passed: !draftValidationErrors.title },
    { key: "context", label: "Context summary", passed: !draftValidationErrors.contextSummary },
    { key: "signals", label: "At least 1 signal", passed: !draftValidationErrors.signals },
    { key: "reasoning", label: "Reasoning provided", passed: !draftValidationErrors.reasoning },
    { key: "options", label: "At least 2 options", passed: !draftValidationErrors.options },
    { key: "selected", label: "Recommendation selected", passed: !draftValidationErrors.selectedOption },
    { key: "priority", label: "Priority set", passed: !draftValidationErrors.riskLevel },
    { key: "confidence", label: "Confidence score (1-5)", passed: !draftValidationErrors.confidenceScore },
  ]

  const passedCount = validationItems.filter((v) => v.passed).length
  const allPassed = passedCount === validationItems.length

  const [focusMode, setFocusMode] = useState(false)
  const [focusFailKeys, setFocusFailKeys] = useState<string[]>([])

  const titleSectionRef = useRef<HTMLDivElement | null>(null)
  const contextSectionRef = useRef<HTMLDivElement | null>(null)
  const signalsSectionRef = useRef<HTMLDivElement | null>(null)
  const reasoningSectionRef = useRef<HTMLDivElement | null>(null)
  const optionsSectionRef = useRef<HTMLDivElement | null>(null)
  const selectedSectionRef = useRef<HTMLDivElement | null>(null)
  const prioritySectionRef = useRef<HTMLDivElement | null>(null)

  const isFail = useCallback(
    (key: string) => focusMode && focusFailKeys.includes(key),
    [focusMode, focusFailKeys]
  )

  const scrollToFirstFail = useCallback(
    (keys: string[]) => {
      const firstKey = keys[0]
      if (!firstKey) return
      const el =
        firstKey === "title"
          ? titleSectionRef.current
          : firstKey === "context"
          ? contextSectionRef.current
          : firstKey === "signals"
          ? signalsSectionRef.current
          : firstKey === "reasoning"
          ? reasoningSectionRef.current
          : firstKey === "options"
          ? optionsSectionRef.current
          : firstKey === "selected"
          ? selectedSectionRef.current
          : firstKey === "priority"
          ? prioritySectionRef.current
          : null
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
    },
    [
      titleSectionRef,
      contextSectionRef,
      signalsSectionRef,
      reasoningSectionRef,
      optionsSectionRef,
      selectedSectionRef,
      prioritySectionRef,
    ]
  )

  const triggerFocus = useCallback(
    (keys: string[]) => {
      const uniqueOrdered = focusOrder.filter((k) => keys.includes(k))
      if (uniqueOrdered.length === 0) return
      setFocusFailKeys(uniqueOrdered)
      setFocusMode(true)
      // Scroll after render so refs are ready.
      setTimeout(() => scrollToFirstFail(uniqueOrdered), 50)
    },
    [scrollToFirstFail]
  )

  const focusFromValidation = useCallback(() => {
    const missing: string[] = []
    if (draftValidationErrors.title) missing.push("title")
    if (draftValidationErrors.contextSummary) missing.push("context")
    if (draftValidationErrors.signals) missing.push("signals")
    if (draftValidationErrors.reasoning) missing.push("reasoning")
    if (draftValidationErrors.options) missing.push("options")
    if (draftValidationErrors.selectedOption) missing.push("selected")
    if (draftValidationErrors.riskLevel) missing.push("priority")
    if (draftValidationErrors.confidenceScore) missing.push("confidence")
    triggerFocus(missing)
  }, [draftValidationErrors, triggerFocus])

  useEffect(() => {
    if (focusMode && Object.keys(draftValidationErrors).length === 0) {
      setFocusMode(false)
      setFocusFailKeys([])
    }
  }, [draftValidationErrors, focusMode])

  const backendFieldToFocusKey: Record<string, string> = {
    title: "title",
    contextSummary: "context",
    signals: "signals",
    options: "options",
    selectedOption: "selected",
    reasoning: "reasoning",
    riskLevel: "priority",
    confidenceScore: "priority",
  }

  // ─── Signal CRUD ────────────────────────────────────

  const addSignal = () => {
    if (!newSignalLabel.trim() || !newSignalValue.trim()) return
    const newSignal: Signal = {
      id: `s${Date.now()}`,
      type: "metric",
      label: newSignalLabel.trim(),
      value: newSignalValue.trim(),
    }
    setSignals((prev) => [...prev, newSignal])
    setNewSignalLabel("")
    setNewSignalValue("")
    setShowNewSignal(false)
  }

  const removeSignal = (id: string) => {
    setSignals((prev) => prev.filter((s) => s.id !== id))
  }

  // ─── Option CRUD ────────────────────────────────────

  const addOption = () => {
    if (!newOptionTitle.trim()) return
    const newOpt: Option = {
      id: `o${Date.now()}`,
      title: newOptionTitle.trim(),
      description: newOptionDesc.trim(),
      expectedImpact: newOptionImpact.trim(),
      riskLevel: newOptionRisk,
    }
    setOptions((prev) => [...prev, newOpt])
    setNewOptionTitle("")
    setNewOptionDesc("")
    setNewOptionImpact("")
    setNewOptionRisk("medium")
    setShowNewOption(false)
  }

  const removeOption = (id: string) => {
    setOptions((prev) => prev.filter((o) => o.id !== id))
    if (selectedOption === id) setSelectedOption("")
  }

  // ─── Save / Submit ────────────────────────────────────

  const refreshList = async () => {
    try {
      const data = await AgentAPI.fetchRecentDecisions()
      setDecisionList(data)
    } catch {
      // ignore
    }
  }

  const saveDraft = async (skipLoadingState = false) => {
    if (!skipLoadingState) setIsSaving(true)
    try {
      const payload = {
        title,
        contextSummary: context,
        reasoning,
        riskLevel: priority.toUpperCase(),
        confidenceScore,
        options: options.map((o, index) => ({
          text: o.title,
          isSelected: selectedOption === o.id,
          order: index,
        })),
      }

      let id = editingDecisionId
      if (!id) {
        const projectId = activeProject?.id
        if (!projectId) {
          toast.error("No active project selected")
          if (!skipLoadingState) setIsSaving(false)
          return null
        }
        const draft = await DecisionAPI.createDraft(projectId)
        if (!draft.id) {
          toast.error("Failed to create draft")
          if (!skipLoadingState) setIsSaving(false)
          return null
        }
        id = draft.id
        setEditingDecisionId(id)
      }

      await DecisionAPI.patchDraft(id!, payload, activeProject?.id)
      toast.success(isPreDraft ? "Pre-draft saved" : "Draft saved")
      await refreshList()
      return id
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "Failed to save draft"
      toast.error(detail)
      return null
    } finally {
      if (!skipLoadingState) setIsSaving(false)
    }
  }

  const submitForReview = async () => {
    if (Object.keys(draftValidationErrors).length > 0) {
      focusFromValidation()
      toast.error("Draft is incomplete. Please address the highlighted fields.", { id: incompleteToastId })
      return
    }
    // Save draft first so modal shows latest data, then open confirmation modal
    setIsSaving(true)
    try {
      const id = await saveDraft(true)
      if (!id) return
      setCommitConfirmations({ alternatives: false, risk: false, review: false })
      setCommitModalOpen(true)
    } catch (err: any) {
      toast.error("Failed to save draft before review.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmCommit = async () => {
    setConfirming(true)
    try {
      const id = editingDecisionId
      if (!id) return
      await DecisionAPI.commit(id, activeProject?.id)
      toast.success("Decision submitted for review")
      setCommitModalOpen(false)
      await refreshList()
      setViewMode("list")
    } catch (err: any) {
      const fieldErrors =
        err?.response?.data?.error?.details?.fieldErrors ||
        err?.response?.data?.details?.fieldErrors

      if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
        const mappedKeys = fieldErrors
          .map((fe: any) => backendFieldToFocusKey[String(fe?.field)] || null)
          .filter((k: string | null): k is string => Boolean(k))
        setCommitModalOpen(false)
        if (mappedKeys.length > 0) {
          triggerFocus(mappedKeys)
        } else {
          focusFromValidation()
        }
      }
      const detail = err?.response?.data?.error?.message || err?.message || "Failed to submit"
      toast.error(detail, { id: incompleteToastId })
    } finally {
      setConfirming(false)
    }
  }

  const submitAsDraft = async () => {
    setIsSaving(true)
    try {
      const id = await saveDraft(true)
      if (!id) return
      await AgentAPI.promoteDecision(id)
      toast.success("Pre-draft submitted as draft")
      await refreshList()
      setViewMode("list")
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "Failed to promote"
      toast.error(detail)
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Consume pendingDecisionId from context ───────────────────

  const { pendingDecisionId, setPendingDecisionId } = useAgentLayout()

  useEffect(() => {
    if (!pendingDecisionId || listLoading) return
    const found = decisionList.find((d) => d.id === pendingDecisionId)
    if (found) {
      loadDecision(found)
    } else {
      loadDecision({ id: pendingDecisionId, title: "", status: "draft", risk_level: "", author: "", created_at: "", is_pre_draft: true })
    }
    setPendingDecisionId(null)
  }, [pendingDecisionId, listLoading, decisionList, loadDecision, setPendingDecisionId])

  // ─── List View ────────────────────────────────────────

  if (viewMode === "list") {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Decisions</h1>
              <p className="text-sm text-muted-foreground mt-1">View and manage advertising decisions</p>
            </div>
            <div className="flex items-center gap-2">
              {batch.isManaging ? (
                <>
                  <span className="text-xs text-muted-foreground">
                    {batch.selectedCount} selected
                  </span>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={batch.selectedCount === 0 || batch.isDeleting}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete
                  </Button>
                  <Button size="sm" variant="outline" onClick={batch.exitManageMode}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  {predraftItems.length > 0 && (
                    <Button size="sm" variant="outline" onClick={batch.enterManageMode}>
                      Manage Pre-Drafts
                    </Button>
                  )}
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={createNew}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    New Decision
                  </Button>
                </>
              )}
            </div>
          </div>

          {listLoading ? (
            <AgentDecisionListSkeleton rows={6} />
          ) : decisionList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No decisions yet. Run an AI analysis to generate one.
            </div>
          ) : (
            <div className="space-y-2">
              {decisionList.map((d) => {
                const isPredraft = d.status?.toLowerCase() === "predraft"
                const isExiting = batch.isExiting(d.id)
                return (
                  <div
                    key={d.id}
                    className={cn(
                      "flex items-center gap-2 transition-all duration-300",
                      isExiting && "opacity-0 scale-95"
                    )}
                  >
                    {batch.isManaging && isPredraft && (
                      <Checkbox
                        checked={batch.selectedIds.has(d.id)}
                        onCheckedChange={() => batch.toggleSelect(d.id)}
                      />
                    )}
                    {batch.isManaging && !isPredraft && (
                      <div className="w-4" />
                    )}
                    <Card
                      className="flex-1 bg-card border-border cursor-pointer transition-colors hover:border-input"
                      onClick={() => {
                        if (batch.isManaging && isPredraft) {
                          batch.toggleSelect(d.id)
                        } else if (!batch.isManaging) {
                          loadDecision(d)
                        }
                      }}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground/60 font-mono">#{d.id}</span>
                            <span className="text-sm text-foreground">{d.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn("text-[10px]", statusStyles[d.status] || statusStyles.draft)}>
                              {statusLabels[d.status] || d.status}
                            </Badge>
                            {d.risk_level && (
                              <Badge variant="outline" className={cn("text-[10px]", riskColors[d.risk_level] || "")}>
                                {d.risk_level}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">{d.author}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <ConfirmDialog
          isOpen={showDeleteConfirm}
          title="Delete Pre-Draft Decisions"
          message={`Are you sure you want to delete ${batch.selectedCount} pre-draft decision${batch.selectedCount > 1 ? "s" : ""}? This action cannot be undone.`}
          type="danger"
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => {
            setShowDeleteConfirm(false)
            batch.deleteSelected()
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </div>
    )
  }

  // ─── Edit View ────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between",
            focusMode && "relative z-20"
          )}
        >
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setViewMode("list")} className="text-muted-foreground">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Decision Editor</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Create and validate advertising decisions with full audit trail
              </p>
            </div>
          </div>
          {(editingStatus === "predraft" || editingStatus === "draft") && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-input text-card-foreground"
                onClick={() => saveDraft()}
                disabled={isSaving || detailLoading}
              >
                {isSaving ? "Saving..." : isPreDraft ? "Save as Pre-Draft" : "Save Draft"}
              </Button>
              {isPreDraft ? (
                <Button
                  size="sm"
                  disabled={isSaving || detailLoading}
                  onClick={submitAsDraft}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  Submit as Draft
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={isSaving || detailLoading}
                  onClick={submitForReview}
                  className={cn(
                    allPassed && !isSaving
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-input text-muted-foreground hover:bg-input/80"
                  )}
                >
                  Submit for Review
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          {focusMode && (
            <div
              className="pointer-events-none absolute inset-0 z-10 bg-black/30"
              aria-hidden="true"
            />
          )}
          <div className="relative z-[11] space-y-6">
        {detailLoading ? (
          <AgentDecisionDetailSkeleton />
        ) : (
          <>
        {/* Validation Status Bar */}
        <Card className="bg-card border-border">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Validation ({passedCount}/{validationItems.length})
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  allPassed
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                )}
              >
                {allPassed ? "Ready" : "Incomplete"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {validationItems.map((item) => (
                <button
                  key={item.key}
                  className={cn(
                    "flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition-colors",
                    item.passed
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                  type="button"
                  onClick={() => {
                    if (item.passed) return
                    triggerFocus([item.key])
                  }}
                  aria-disabled={item.passed}
                >
                  {item.passed ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-input inline-block" />
                  )}
                  {item.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Title & Priority */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              ref={titleSectionRef}
              id="decision-focus-title"
              className={cn(
                "space-y-2",
                isFail("title") && "relative z-20 ring-1 ring-red-500/40 rounded-lg"
              )}
            >
              <Label className="text-muted-foreground">Decision Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter decision title..."
                className="bg-muted border-input text-foreground placeholder:text-muted-foreground/60"
              />
            </div>
            <div
              ref={prioritySectionRef}
              id="decision-focus-priority"
              className={cn(
                "space-y-2",
                isFail("priority") && "relative z-20 ring-1 ring-red-500/40 rounded-lg"
              )}
            >
              <Label className="text-muted-foreground">Priority</Label>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map((level) => (
                  <Button
                    key={level}
                    variant="outline"
                    size="sm"
                    onClick={() => setPriority(level)}
                    className={cn(
                      "capitalize border-input",
                      priority === level
                        ? level === "high"
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          : level === "medium"
                          ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "text-muted-foreground"
                    )}
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Context Summary */}
        <div
          ref={contextSectionRef}
          id="decision-focus-context"
          className={cn(isFail("context") && "relative z-20")}
        >
          <Card
            className={cn(
              "bg-card border-border",
              isFail("context") && "border-red-500/50 ring-1 ring-red-500/20"
            )}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-card-foreground flex items-center gap-2">
                <Target className="w-4 h-4" />
                Context Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Describe the situation and background context..."
                rows={4}
                className="bg-muted border-input text-foreground placeholder:text-muted-foreground/60"
              />
            </CardContent>
          </Card>
        </div>

        {/* Input Signals */}
        <div
          ref={signalsSectionRef}
          id="decision-focus-signals"
          className={cn(isFail("signals") && "relative z-20")}
        >
          <Card
            className={cn(
              "bg-card border-border",
              isFail("signals") && "border-red-500/50 ring-1 ring-red-500/20"
            )}
          >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-card-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Input Signals
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewSignal(true)}
                className="h-7 text-xs text-blue-400 hover:text-blue-300"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Signal
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {signals.length === 0 && !showNewSignal && (
              <p className="text-sm text-muted-foreground text-center py-4">No signals added yet</p>
            )}
            {signals.map((signal) => {
              const Icon = signalIcons[signal.type]
              return (
                <div
                  key={signal.id}
                  className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5"
                >
                  <div className="w-8 h-8 rounded-lg bg-input/50 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-card-foreground">{signal.label}</p>
                  </div>
                  <span className="text-sm font-medium text-foreground">{signal.value}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-card-foreground"
                    onClick={() => removeSignal(signal.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )
            })}

            {/* New Signal Form */}
            {showNewSignal && (
              <div className="rounded-lg border border-input bg-muted/30 p-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={newSignalLabel}
                    onChange={(e) => setNewSignalLabel(e.target.value)}
                    placeholder="Signal name"
                    className="flex-1 bg-muted border-input text-foreground placeholder:text-muted-foreground/60 h-8 text-sm"
                  />
                  <Input
                    value={newSignalValue}
                    onChange={(e) => setNewSignalValue(e.target.value)}
                    placeholder="Value"
                    className="w-40 bg-muted border-input text-foreground placeholder:text-muted-foreground/60 h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setShowNewSignal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={addSignal}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          </Card>
        </div>

        {/* Reasoning */}
        <div
          ref={reasoningSectionRef}
          id="decision-focus-reasoning"
          className={cn(isFail("reasoning") && "relative z-20")}
        >
          <Card
            className={cn(
              "bg-card border-border",
              isFail("reasoning") && "border-red-500/50 ring-1 ring-red-500/20"
            )}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-card-foreground flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Reasoning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                placeholder="Explain the reasoning behind this decision..."
                rows={4}
                className="bg-muted border-input text-foreground placeholder:text-muted-foreground/60"
              />
            </CardContent>
          </Card>
        </div>

        {/* Options */}
        <div
          ref={optionsSectionRef}
          id="decision-focus-options"
          className={cn(isFail("options") && "relative z-20")}
        >
          <Card
            className={cn(
              "bg-card border-border",
              isFail("options") && "border-red-500/50 ring-1 ring-red-500/20"
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-card-foreground flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Options & Recommendation
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewOption(true)}
                  className="h-7 text-xs text-blue-400 hover:text-blue-300"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Option
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {options.length === 0 && !showNewOption && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No options added yet
                </p>
              )}
              <div
                ref={selectedSectionRef}
                id="decision-focus-selected"
                className={cn(
                  isFail("selected") && "relative z-20 ring-1 ring-red-500/40 rounded-lg"
                )}
              >
                <RadioGroup value={selectedOption} onValueChange={setSelectedOption}>
                  {options.map((option) => (
                <div
                  key={option.id}
                  className={cn(
                    "rounded-lg border p-4 transition-colors cursor-pointer",
                    selectedOption === option.id
                      ? "border-blue-500/50 bg-blue-500/5"
                      : "border-input bg-muted/30 hover:border-input"
                  )}
                  onClick={() => setSelectedOption(option.id)}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value={option.id} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{option.title}</p>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", riskColors[option.riskLevel])}
                        >
                          {option.riskLevel === "low" ? "Low Risk" : option.riskLevel === "medium" ? "Med Risk" : "High Risk"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 ml-auto text-muted-foreground hover:text-card-foreground"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeOption(option.id)
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                      <Separator className="my-2 bg-input" />
                      <div className="flex items-center gap-1 text-xs">
                        <TrendingUp className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Expected Impact:</span>
                        <span className="text-card-foreground">{option.expectedImpact}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
                </RadioGroup>
              </div>

            {/* New Option Form */}
            {showNewOption && (
              <div className="rounded-lg border border-input bg-muted/30 p-4 space-y-3">
                <div className="space-y-2">
                  <Input
                    value={newOptionTitle}
                    onChange={(e) => setNewOptionTitle(e.target.value)}
                    placeholder="Option title"
                    className="bg-muted border-input text-foreground placeholder:text-muted-foreground/60 h-8 text-sm"
                  />
                  <Textarea
                    value={newOptionDesc}
                    onChange={(e) => setNewOptionDesc(e.target.value)}
                    placeholder="Description..."
                    rows={2}
                    className="bg-muted border-input text-foreground placeholder:text-muted-foreground/60 text-sm"
                  />
                  <Input
                    value={newOptionImpact}
                    onChange={(e) => setNewOptionImpact(e.target.value)}
                    placeholder="Expected impact"
                    className="bg-muted border-input text-foreground placeholder:text-muted-foreground/60 h-8 text-sm"
                  />
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Risk Level</Label>
                    <div className="flex gap-2">
                      {(["low", "medium", "high"] as const).map((level) => (
                        <Button
                          key={level}
                          variant="outline"
                          size="sm"
                          onClick={() => setNewOptionRisk(level)}
                          className={cn(
                            "capitalize text-xs h-7 border-input",
                            newOptionRisk === level
                              ? riskColors[level]
                              : "text-muted-foreground"
                          )}
                        >
                          {level}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setShowNewOption(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={addOption}
                  >
                    Add Option
                  </Button>
                </div>
              </div>
            )}
            </CardContent>
          </Card>
        </div>
          </>
        )}
          </div>
        </div>
      </div>

      <DecisionCommitConfirmationModal
        isOpen={commitModalOpen}
        onClose={() => setCommitModalOpen(false)}
        onConfirm={handleConfirmCommit}
        confirming={confirming}
        contextSummary={context}
        reasoning={reasoning}
        riskLevel={priority}
        confidenceScore={confidenceScore}
        options={options.map((o, i) => ({ text: o.title, isSelected: selectedOption === o.id, order: i }))}
        signals={signals.map((s, i) => ({
          id: i,
          displayText: `${s.label}: ${s.value}`,
        }))}
        confirmations={commitConfirmations}
        onToggleConfirmation={(key) =>
          setCommitConfirmations((prev) => ({ ...prev, [key]: !prev[key] }))
        }
      />
    </div>
  )
}
