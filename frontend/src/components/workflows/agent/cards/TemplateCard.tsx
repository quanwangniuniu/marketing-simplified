"use client"

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { AgentWorkflowTemplate, TemplateCategory } from "@/types/agent"
import { Building2, FolderKanban, Lock } from "lucide-react"
import StepIconStack from "./StepIconStack"
import { useHoverCard } from "./useHoverCard"
import HoverCardPortal from "./HoverCardPortal"
import { TemplateHoverContent } from "./WorkflowHoverPreview"
import { useBuildUrl } from "@/lib/buildUrl"

const CATEGORY_CONFIG: Record<
  TemplateCategory,
  { label: string; bg: string; text: string }
> = {
  review:       { label: "Review",       bg: "bg-blue-50",   text: "text-blue-700" },
  optimization: { label: "Optimization", bg: "bg-green-50",  text: "text-green-700" },
  analysis:     { label: "Analysis",     bg: "bg-violet-50", text: "text-violet-700" },
  reporting:    { label: "Reporting",    bg: "bg-orange-50", text: "text-orange-700" },
  other:        { label: "Other",        bg: "bg-gray-100",  text: "text-gray-600" },
}

function ScopeBadges({ template }: { template: AgentWorkflowTemplate }) {
  const badges: React.ReactNode[] = []
  if (template.organization) {
    badges.push(
      <span key="org" className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">
        <Building2 className="h-2.5 w-2.5" />
        {template.organization_name ?? "Org"}
      </span>
    )
  }
  const projects = template.project_list ?? []
  if (projects.length === 1) {
    badges.push(
      <span key="proj" className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
        <FolderKanban className="h-2.5 w-2.5" />
        {projects[0].name}
      </span>
    )
  } else if (projects.length > 1) {
    badges.push(
      <span key="proj" className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
        <FolderKanban className="h-2.5 w-2.5" />
        {projects.length} Projects
      </span>
    )
  }
  if (badges.length === 0) {
    badges.push(
      <span key="private" className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
        <Lock className="h-2.5 w-2.5" />
        Private
      </span>
    )
  }
  return <>{badges}</>
}

interface TemplateCardProps {
  template: AgentWorkflowTemplate
  onApply?: () => void
  onEdit?: () => void
  onDelete?: () => void
  isOwner?: boolean
}

export default function TemplateCard({
  template,
  onApply,
  onEdit,
  onDelete,
  isOwner,
}: TemplateCardProps) {
  const router = useRouter()
  const buildUrl = useBuildUrl()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const category = CATEGORY_CONFIG[template.category] ?? CATEGORY_CONFIG.other
  const { cardRef, isVisible, style, onMouseEnter, onMouseLeave, hoverCardHandlers, hide } = useHoverCard()

  const handleCardClick = () => {
    // Navigate to template preview page
    router.push(buildUrl(`/workflows/templates/${template.slug}/preview`))
  }

  const handleEdit = () => {
    hide()
    onEdit?.()
  }

  const handleDelete = () => {
    hide()
    onDelete?.()
  }

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

  return (
    <>
      <HoverCardPortal isVisible={isVisible} style={style} hoverCardHandlers={hoverCardHandlers}>
        <TemplateHoverContent
          name={template.name}
          description={template.description}
          stepTypes={template.workflow_step_types ?? []}
          category={template.category}
          organization={template.organization}
          organizationName={template.organization_name}
          projectList={template.project_list}
          onPreview={handleCardClick}
          onApply={onApply}
          onEdit={onEdit ? handleEdit : undefined}
          onDelete={onDelete ? handleDelete : undefined}
        />
      </HoverCardPortal>

      <div
        ref={cardRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={handleCardClick}
        className="group flex cursor-pointer flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-150 hover:border-violet-200 hover:shadow-md"
      >
        {/* Top row: icons + menu */}
        <div className="flex items-start justify-between gap-3">
          <StepIconStack stepTypes={template.workflow_step_types ?? []} size={36} />

          <div className="relative ml-auto" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-opacity hover:bg-gray-100 hover:text-gray-700 ${
                onEdit ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
              aria-label="Template options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 min-w-[160px] rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                {isOwner && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit?.() }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                )}
                {isOwner && (
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

        {/* Name */}
        <h3 className="mt-3 flex-1 text-base font-semibold leading-snug text-gray-900">
          {template.name}
        </h3>

        {/* Footer: category + scope badges */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${category.bg} ${category.text}`}>
            {category.label}
          </span>
          <ScopeBadges template={template} />
        </div>
      </div>
    </>
  )
}
