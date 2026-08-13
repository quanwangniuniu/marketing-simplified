"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { Plus } from "lucide-react"
import { useAgentWorkflows } from "./hooks/useAgentWorkflows"
import { useBuildUrl } from "@/lib/buildUrl"
import WorkflowsTab from "./tabs/WorkflowsTab"
import TemplatesTab from "./tabs/TemplatesTab"
import toast from "react-hot-toast"
import { brandBtnHeader, brandTabActive, brandTabInactive } from "./workflowBrandClasses"
import { cn } from "@/lib/utils"

type Tab = "workflows" | "templates"

const TABS: { id: Tab; label: string }[] = [
  { id: "workflows", label: "Workflows" },
  { id: "templates", label: "Templates" },
]

export default function WorkflowsPageLayout() {
  const router = useRouter()
  const buildUrl = useBuildUrl()
  const searchParams = useSearchParams()
  const rawTab = searchParams.get("tab")
  const activeTab: Tab =
    rawTab === "templates" ? "templates" : "workflows"

  const { activeProject, hasHydrated, createWorkflow } = useAgentWorkflows()

  const [isCreating, setIsCreating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const needsProject = hasHydrated && !activeProject?.id

  const switchTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === "workflows") {
      params.delete("tab")
    } else {
      params.set("tab", tab)
    }
    router.push(buildUrl(`/workflows${params.size > 0 ? `?${params.toString()}` : ""}`))
  }

  const handleCreate = async () => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const created = await createWorkflow({ name: "New workflow", status: "draft" })
      setRefreshKey((k) => k + 1)
      router.push(buildUrl(`/workflows/${created.slug}?new=1`))
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message || "Failed to create workflow"
      toast.error(msg)
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-full bg-[#F7F8FA]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Workflows
          </h1>
          <button
            type="button"
            disabled={needsProject || isCreating}
            onClick={handleCreate}
            className={brandBtnHeader}
          >
            <Plus className="h-4 w-4" />
            {isCreating ? "Creating…" : "Create workflow"}
          </button>
        </div>

        {/* ── Tab navigation ── */}
        <nav className="mt-6 flex gap-2">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className={cn(
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7]/40 focus-visible:ring-offset-2",
                  isActive ? brandTabActive : brandTabInactive
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* ── Tab content ── */}
        <div className="mt-8">
          {activeTab === "workflows" ? (
            <WorkflowsTab
              onCreateClick={handleCreate}
              refreshKey={refreshKey}
            />
          ) : (
            <TemplatesTab refreshKey={refreshKey} />
          )}
        </div>
      </div>
    </div>
  )
}
