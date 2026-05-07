import type { Metadata } from "next"

import PublicPageShell from "@/components/home/PublicPageShell"
import HelpCenterPage from "@/components/help-center/HelpCenterPage"

export const metadata: Metadata = {
  title: "Help Center | Marketing Simplified",
  description:
    "Find answers quickly with Help Center search, onboarding guides, academy learning paths, community resources, and support escalation options.",
}

export default function HelpCenterRoutePage() {
  return (
    <PublicPageShell>
      <HelpCenterPage />
    </PublicPageShell>
  )
}
