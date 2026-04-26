"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import {
  FileSpreadsheet,
  MessagesSquare,
  CalendarDays,
  Bot,
  SearchCheck,
  Share2,
  PanelsTopLeft,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react"

type Workflow = {
  id: string
  name: string
  icon?: LucideIcon
  iconSrc?: string
  iconGradient: string
  outcomeIcon: LucideIcon
  outcomeLabel: string
  action: string
  trigger: string
}

const workflows: Workflow[] = [
  {
    id: "spreadsheet-analysis",
    name: "Spreadsheet Analysis",
    icon: FileSpreadsheet,
    iconGradient: "from-brand-teal to-brand-lime",
    outcomeIcon: SearchCheck,
    outcomeLabel: "Analyze & recommend",
    action:
      "Upload campaign data and spot unusual spend, performance drops, and the next best move in minutes.",
    trigger: "When a campaign spreadsheet is uploaded",
  },
  {
    id: "follow-up-chat",
    name: "Follow-up Chat",
    icon: MessagesSquare,
    iconGradient: "from-brand-teal to-brand-lime",
    outcomeIcon: Share2,
    outcomeLabel: "Explain & share",
    action:
      "Ask a follow-up and get a clear answer your team can share, discuss, and act on right away.",
    trigger: "When a teammate asks about the results",
  },
  {
    id: "miro-snapshot",
    name: "Miro Snapshot Generator",
    iconSrc: "/icons/flowchart-16-regular.svg",
    iconGradient: "from-amber-500 to-orange-500",
    outcomeIcon: PanelsTopLeft,
    outcomeLabel: "Visualize & organize",
    action:
      "Turn findings into a visual planning board so campaign owners can review priorities together.",
    trigger: "When a workflow includes a board snapshot",
  },
  {
    id: "calendar-qa",
    name: "Calendar Q&A",
    icon: CalendarDays,
    iconGradient: "from-emerald-500 to-teal-500",
    outcomeIcon: CalendarCheck,
    outcomeLabel: "Plan & schedule",
    action:
      "Check timelines, answer scheduling questions, and prepare campaign events without leaving chat.",
    trigger: "When someone asks about the calendar",
  },
]

function WorkflowIcon({
  icon: Icon,
  iconSrc,
  className,
}: {
  icon?: LucideIcon
  iconSrc?: string
  className: string
}) {
  if (iconSrc) {
    return (
      <span
        aria-hidden="true"
        className={`${className} block bg-current`}
        style={{
          WebkitMask: `url("${iconSrc}") center / contain no-repeat`,
          mask: `url("${iconSrc}") center / contain no-repeat`,
        }}
      />
    )
  }

  if (!Icon) return null
  return <Icon className={className} />
}

export default function AiWorkflowsSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section ref={ref} className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-teal/10 rounded-full text-brand-teal text-sm font-medium mb-4 border border-brand-teal/20">
            <Bot className="w-4 h-4" />
            AI Agent Workflows
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Intelligent automation,{" "}
            <span className="bg-gradient-to-r from-brand-teal to-brand-lime bg-clip-text text-transparent">
              built-in
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Our AI agent handles repetitive workflows so your team can focus on strategy.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {workflows.map((wf, index) => {
            const OutcomeIcon = wf.outcomeIcon

            return (
              <motion.div
                key={wf.id}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 * index }}
                className="glass-card rounded-2xl p-6 group hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${wf.iconGradient} flex items-center justify-center shadow-lg`}
                  >
                    <WorkflowIcon icon={wf.icon} iconSrc={wf.iconSrc} className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{wf.name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-brand-teal font-medium">
                      <OutcomeIcon className="w-3.5 h-3.5" />
                      {wf.outcomeLabel}
                    </div>
                  </div>
                </div>

                <p className="text-gray-600 text-sm leading-relaxed mb-5">
                  {wf.action}
                </p>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400">Trigger:</span>
                  <span className="inline-flex items-center px-3 py-1 bg-brand-teal/10 text-brand-teal text-xs font-medium rounded-full border border-brand-teal/25">
                    {wf.trigger}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
