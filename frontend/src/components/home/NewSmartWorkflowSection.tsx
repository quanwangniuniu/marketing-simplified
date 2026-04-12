"use client"

import { useState, useRef } from "react"
import { motion, useInView } from "framer-motion"
import { Avatar } from "@/components/avatar/Avatar"
import {
  Search,
  Bell,
  User,
  Filter,
  Plus,
  RefreshCw,
  MoreVertical,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  ArrowRight,
  ChevronRight,
} from "lucide-react"

const workflowColumns = [
  {
    id: "asset-review",
    title: "Asset Review",
    tasks: [
      { id: 1, title: "Draft Video Ad", status: "draft", color: "yellow" },
      { id: 2, title: "Banner Ad - Pending", status: "pending", color: "orange" },
      { id: 3, title: "Display Ad", status: "approved", color: "green" },
    ],
  },
  {
    id: "budget-approval",
    title: "Budget Approval",
    tasks: [
      { id: 4, title: "$10K Budget Allocation", status: "draft", color: "yellow" },
      { id: 5, title: "$25K Budget Adjustment", status: "approved", color: "green" },
      { id: 6, title: "Revised Budget Proposal", status: "rejected", color: "red" },
    ],
  },
  {
    id: "campaign-execution",
    title: "Campaign Execution",
    tasks: [
      { id: 7, title: "Facebook Ads Launch", status: "scheduled", color: "blue" },
      { id: 8, title: "Mid-Year Performance", status: "in-progress", color: "blue" },
      { id: 9, title: "Q3 Campaign Review", status: "ready", color: "gray" },
    ],
  },
]

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; bg: string; text: string }> = {
  draft: { label: "Draft", icon: Clock, bg: "bg-yellow-100", text: "text-yellow-700" },
  pending: { label: "Pending Review", icon: Clock, bg: "bg-orange-100", text: "text-orange-700" },
  approved: { label: "Approved", icon: CheckCircle, bg: "bg-emerald-100", text: "text-emerald-700" },
  rejected: { label: "Rejected", icon: XCircle, bg: "bg-rose-100", text: "text-rose-700" },
  scheduled: { label: "Scheduled", icon: Calendar, bg: "bg-brand-teal/15", text: "text-brand-teal" },
  "in-progress": { label: "In Progress", icon: RefreshCw, bg: "bg-brand-teal/15", text: "text-brand-teal" },
  ready: { label: "Report Ready", icon: CheckCircle, bg: "bg-gray-100", text: "text-gray-700" },
}

const colorMap: Record<string, string> = {
  yellow: "bg-yellow-400",
  orange: "bg-orange-400",
  green: "bg-emerald-400",
  red: "bg-rose-400",
  blue: "bg-brand-teal",
  gray: "bg-gray-400",
}

export default function NewSmartWorkflowSection() {
  const [activeTask, setActiveTask] = useState<number | null>(null)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section ref={ref} className="py-20 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="w-full lg:w-3/5"
          >
            <div className="glass-card rounded-2xl overflow-hidden shadow-xl">
              <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="relative w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <div className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400">
                      Search tasks...
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">Filters</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-brand-gradient text-white rounded-lg text-sm">
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Create task</span>
                  </div>
                  <div className="p-2 text-gray-500">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="p-2 text-gray-500">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="flex">
                <div className="w-44 bg-gray-50 border-r border-gray-200 p-3 hidden md:block">
                  <nav className="space-y-1 mb-4">
                    <div className="flex items-center gap-2 px-3 py-2 bg-brand-teal/10 text-brand-teal rounded-lg font-medium text-sm">
                      <span className="w-1 h-4 bg-brand-teal rounded-full" />
                      Dashboard
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 text-gray-600 rounded-lg text-sm">
                      Tasks
                      <span className="px-2 py-0.5 bg-brand-teal/15 text-brand-teal text-xs font-semibold rounded-full">
                        16
                      </span>
                    </div>
                  </nav>
                  <div className="space-y-1 mb-4">
                    <div className="text-xs font-semibold text-gray-400 uppercase px-3 mb-2">Main</div>
                    <div className="px-3 py-2 text-gray-600 rounded-lg text-sm">Reports</div>
                    <div className="px-3 py-2 text-gray-600 rounded-lg text-sm">Teams</div>
                    <div className="px-3 py-2 text-gray-600 rounded-lg text-sm">Settings</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-gray-400 uppercase px-3 mb-2">Recommend</div>
                    <div className="flex items-center justify-between px-3 py-2 text-gray-600 rounded-lg text-sm">
                      Team
                      <ChevronRight className="w-4 h-4" />
                    </div>
                    <div className="px-3 py-2 text-gray-600 rounded-lg text-sm">Clients</div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <Avatar
                        src="/avatars/person-9.jpg"
                        alt="Brooklyn S."
                        size="sm"
                        fallback="BS"
                      />
                      <div>
                        <div className="text-xs font-medium text-gray-900">Brooklyn S.</div>
                        <div className="text-xs text-gray-500">Admin</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-4 bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      Smart Workflow
                      <RefreshCw className="w-4 h-4 text-gray-400" />
                    </h3>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {workflowColumns.map((column, colIndex) => (
                      <motion.div
                        key={column.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.4, delay: 0.3 + colIndex * 0.1 }}
                        className="space-y-2"
                      >
                        <h4 className="text-xs font-semibold text-gray-500 mb-2">{column.title}</h4>
                        {column.tasks.map((task, taskIndex) => {
                          const status = statusConfig[task.status]
                          const StatusIcon = status.icon
                          return (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={isInView ? { opacity: 1, scale: 1 } : {}}
                              transition={{ duration: 0.3, delay: 0.4 + taskIndex * 0.05 }}
                              onMouseEnter={() => setActiveTask(task.id)}
                              onMouseLeave={() => setActiveTask(null)}
                              className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer ${
                                activeTask === task.id ? "ring-2 ring-brand-teal border-brand-teal/40" : "border-gray-200"
                              }`}
                            >
                              <div className={`h-1 ${colorMap[task.color]} rounded-t-lg`} />
                              <div className="p-2.5">
                                <div className="flex items-start justify-between mb-2">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 ${status.bg} ${status.text} text-xs font-medium rounded`}
                                  >
                                    <StatusIcon className="w-3 h-3" />
                                    {status.label}
                                  </span>
                                  <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <h5 className="text-xs font-semibold text-gray-900 mb-2">{task.title}</h5>
                                <div className="flex items-center gap-2">
                                  <Avatar
                                    src={`/avatars/person-${(task.id % 9) + 1}.jpg`}
                                    alt="Assignee"
                                    size="xs"
                                    className="ring-1 ring-gray-200"
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="w-full lg:w-2/5"
          >
            <div className="bg-brand-teal/5 rounded-3xl p-8 relative overflow-hidden border border-brand-teal/15">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-gray-200 mb-6">
                <RefreshCw className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Smart Workflow</span>
              </div>

              <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                Connect every stage in one seamless workflow.
              </h3>
              <p className="text-lg text-gray-600 mb-8">
                From creative reviews to budget approvals and campaign execution, Marketing Simplified automates task
                transitions so your team stays perfectly aligned.
              </p>

              <button className="inline-flex items-center gap-2 px-6 py-3 bg-brand-gradient text-white rounded-full hover:saturate-150 transition-all font-medium glow-brand">
                Learn More
                <ArrowRight className="w-5 h-5" />
              </button>

              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-brand-teal/15 rounded-full opacity-50" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
