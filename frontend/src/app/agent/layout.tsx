import { cookies } from "next/headers"
import { AgentLayoutShell } from "@/components/agent/AgentLayoutShell"
import { AGENT_VIEW_COOKIE_NAME, normalizeAgentView } from "@/lib/agentView"

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const initialView = normalizeAgentView(cookieStore.get(AGENT_VIEW_COOKIE_NAME)?.value)

  return (
    <AgentLayoutShell initialView={initialView}>
      {children}
    </AgentLayoutShell>
  )
}
