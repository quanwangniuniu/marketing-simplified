"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { AvatarGroup } from "@/components/avatar/AvatarGroup"
import {
  Bot,
  Table2,
  Video,
  CheckSquare,
  Calendar,
  Megaphone,
  Scale,
  Mail,
  MessageSquare,
  Image as ImageIcon,
  ChevronRight,
  Zap,
  Clock,
} from "lucide-react"

const modules = [
  {
    id: "ai-agent",
    name: "AI Agent",
    icon: Bot,
    color: "bg-brand-teal",
    lightColor: "bg-brand-teal/10",
    textColor: "text-brand-teal",
    description: "Autonomous AI that manages your campaigns end-to-end",
    isHighlight: true,
    preview: {
      title: "AI Agent Workflow",
      subtitle: "Intelligent automation for media buying",
      items: [
        { label: "Analyze campaign performance", status: "completed" },
        { label: "Optimize budget allocation", status: "completed" },
        { label: "Generate ad variations", status: "in-progress" },
        { label: "Schedule A/B tests", status: "pending" },
      ],
    },
  },
  {
    id: "spreadsheet",
    name: "Spreadsheet",
    icon: Table2,
    color: "bg-emerald-500",
    lightColor: "bg-emerald-50",
    textColor: "text-emerald-600",
    description: "Powerful data management with real-time collaboration",
    preview: {
      title: "Campaign Budget Tracker",
      subtitle: "Q2 2024 Media Spend",
      items: [
        { label: "Facebook Ads", value: "$12,500", change: "+12%" },
        { label: "Google Ads", value: "$8,200", change: "+8%" },
        { label: "TikTok Ads", value: "$5,800", change: "+24%" },
        { label: "LinkedIn Ads", value: "$3,200", change: "-5%" },
      ],
    },
  },
  {
    id: "meetings",
    name: "Meetings",
    icon: Video,
    color: "bg-brand-teal",
    lightColor: "bg-brand-teal/10",
    textColor: "text-brand-teal",
    description: "Schedule and manage team meetings seamlessly",
    preview: {
      title: "Upcoming Meetings",
      subtitle: "This week",
      items: [
        { label: "Campaign Review", time: "Today, 2:00 PM", attendees: 4 },
        { label: "Budget Planning", time: "Tomorrow, 10:00 AM", attendees: 3 },
        { label: "Creative Sync", time: "Wed, 3:00 PM", attendees: 5 },
        { label: "Performance Analysis", time: "Fri, 11:00 AM", attendees: 6 },
      ],
    },
  },
  {
    id: "tasks",
    name: "Tasks",
    icon: CheckSquare,
    color: "bg-orange-500",
    lightColor: "bg-orange-50",
    textColor: "text-orange-600",
    description: "Track and manage all your project tasks",
    preview: {
      title: "Active Tasks",
      subtitle: "Campaign Launch",
      items: [
        { label: "Design banner assets", status: "completed", assignee: "Sarah" },
        { label: "Write ad copy", status: "completed", assignee: "Mike" },
        { label: "Set up targeting", status: "in-progress", assignee: "John" },
        { label: "Launch campaign", status: "pending", assignee: "Emma" },
      ],
    },
  },
  {
    id: "calendar",
    name: "Calendar",
    icon: Calendar,
    color: "bg-rose-500",
    lightColor: "bg-rose-50",
    textColor: "text-rose-600",
    description: "Visualize your campaign timeline and deadlines",
    preview: {
      title: "Campaign Calendar",
      subtitle: "March 2024",
      items: [
        { label: "Spring Sale Launch", date: "Mar 15", type: "launch" },
        { label: "A/B Test Review", date: "Mar 18", type: "review" },
        { label: "Budget Reallocation", date: "Mar 22", type: "budget" },
        { label: "Q1 Report Due", date: "Mar 31", type: "deadline" },
      ],
    },
  },
  {
    id: "campaigns",
    name: "Campaigns",
    icon: Megaphone,
    color: "bg-pink-500",
    lightColor: "bg-pink-50",
    textColor: "text-pink-600",
    description: "Manage all your advertising campaigns in one place",
    preview: {
      title: "Active Campaigns",
      subtitle: "Performance Overview",
      items: [
        { label: "Spring Sale 2024", status: "active", spend: "$4,200", roas: "3.2x" },
        { label: "Brand Awareness", status: "active", spend: "$2,100", roas: "2.8x" },
        { label: "Retargeting", status: "paused", spend: "$800", roas: "4.1x" },
        { label: "New Product Launch", status: "draft", spend: "$0", roas: "-" },
      ],
    },
  },
  {
    id: "decisions",
    name: "Decisions",
    icon: Scale,
    color: "bg-brand-teal",
    lightColor: "bg-brand-teal/10",
    textColor: "text-brand-teal",
    description: "AI-powered recommendations for smarter decisions",
    preview: {
      title: "AI Recommendations",
      subtitle: "Based on your data",
      items: [
        { label: "Increase TikTok budget by 20%", confidence: "92%", impact: "High" },
        { label: "Pause underperforming ad sets", confidence: "88%", impact: "Medium" },
        { label: "Test new audience segment", confidence: "85%", impact: "High" },
        { label: "Adjust bidding strategy", confidence: "79%", impact: "Medium" },
      ],
    },
  },
  {
    id: "email",
    name: "Email Draft",
    icon: Mail,
    color: "bg-cyan-500",
    lightColor: "bg-cyan-50",
    textColor: "text-cyan-600",
    description: "Create and manage email campaign drafts",
    preview: {
      title: "Email Drafts",
      subtitle: "Ready for review",
      items: [
        { label: "Welcome Series - Email 1", status: "draft" },
        { label: "Promo Announcement", status: "scheduled" },
        { label: "Re-engagement Flow", status: "approved" },
        { label: "Newsletter March", status: "sent" },
      ],
    },
  },
  {
    id: "message",
    name: "Messages",
    icon: MessageSquare,
    color: "bg-teal-500",
    lightColor: "bg-teal-50",
    textColor: "text-teal-600",
    description: "Team chat and collaboration hub",
    preview: {
      title: "Team Chat",
      subtitle: "#marketing-team",
      items: [
        { label: "Sarah: The new creatives look great!", time: "2m ago" },
        { label: "Mike: Budget approved for Q2", time: "15m ago" },
        { label: "John: Campaign is live!", time: "1h ago" },
        { label: "Emma: Meeting notes uploaded", time: "2h ago" },
      ],
    },
  },
  {
    id: "ads",
    name: "Ads Draft",
    icon: ImageIcon,
    color: "bg-amber-500",
    lightColor: "bg-amber-50",
    textColor: "text-amber-600",
    description: "Design and preview ad creatives",
    preview: {
      title: "Ad Creatives",
      subtitle: "Spring Campaign",
      items: [
        { label: "Banner 728x90", status: "approved", version: "v3" },
        { label: "Story Ad 1080x1920", status: "review", version: "v2" },
        { label: "Feed Post 1080x1080", status: "draft", version: "v1" },
        { label: "Video Ad 16:9", status: "in-progress", version: "v1" },
      ],
    },
  },
]

type ModuleItem = {
  label: string
  status?: string
  value?: string
  change?: string
  time?: string
  attendees?: number
  assignee?: string
  date?: string
  type?: string
  spend?: string
  roas?: string
  confidence?: string
  impact?: string
  version?: string
}

type Module = (typeof modules)[0]

function AIAgentPreview({ module }: { module: Module }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-lg ${module.lightColor}`}>
          <Bot className={`w-5 h-5 ${module.textColor}`} />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">{module.preview.title}</h4>
          <p className="text-xs text-gray-500">{module.preview.subtitle}</p>
        </div>
      </div>
      <div className="space-y-2">
        {module.preview.items.map((item: ModuleItem, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                item.status === "completed"
                  ? "bg-emerald-100"
                  : item.status === "in-progress"
                    ? "bg-brand-teal/15"
                    : "bg-gray-100"
              }`}
            >
              {item.status === "completed" && <CheckSquare className="w-3 h-3 text-brand-lime" />}
              {item.status === "in-progress" && <Zap className="w-3 h-3 text-brand-teal" />}
              {item.status === "pending" && <Clock className="w-3 h-3 text-gray-400" />}
            </div>
            <span className="text-sm text-gray-700 flex-1">{item.label}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                item.status === "completed"
                  ? "bg-brand-lime/15 text-brand-lime"
                  : item.status === "in-progress"
                    ? "bg-brand-teal/15 text-brand-teal"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              {item.status === "completed" ? "Done" : item.status === "in-progress" ? "Running" : "Queued"}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function SpreadsheetPreview({ module }: { module: Module }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-lg ${module.lightColor}`}>
          <Table2 className={`w-5 h-5 ${module.textColor}`} />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">{module.preview.title}</h4>
          <p className="text-xs text-gray-500">{module.preview.subtitle}</p>
        </div>
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
          <div className="px-3 py-2 text-xs font-medium text-gray-500">Platform</div>
          <div className="px-3 py-2 text-xs font-medium text-gray-500">Spend</div>
          <div className="px-3 py-2 text-xs font-medium text-gray-500">Change</div>
        </div>
        {module.preview.items.map((item: ModuleItem, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="grid grid-cols-3 border-b border-gray-100 last:border-0"
          >
            <div className="px-3 py-2 text-sm text-gray-700">{item.label}</div>
            <div className="px-3 py-2 text-sm font-medium text-gray-900">{item.value}</div>
            <div
              className={`px-3 py-2 text-sm font-medium ${
                item.change?.startsWith("+") ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {item.change}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function GenericPreview({ module }: { module: Module }) {
  const Icon = module.icon
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-lg ${module.lightColor}`}>
          <Icon className={`w-5 h-5 ${module.textColor}`} />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">{module.preview.title}</h4>
          <p className="text-xs text-gray-500">{module.preview.subtitle}</p>
        </div>
      </div>
      <div className="space-y-2">
        {module.preview.items.map((item: ModuleItem, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              {item.time && <p className="text-xs text-gray-500">{item.time}</p>}
              {item.date && <p className="text-xs text-gray-500">{item.date}</p>}
              {item.assignee && <p className="text-xs text-gray-500">Assigned to {item.assignee}</p>}
            </div>
            {item.status && (
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  item.status === "completed" ||
                  item.status === "approved" ||
                  item.status === "active" ||
                  item.status === "sent"
                    ? "bg-brand-lime/15 text-brand-lime"
                    : item.status === "in-progress" || item.status === "review"
                      ? "bg-brand-teal/15 text-brand-teal"
                      : item.status === "paused" || item.status === "scheduled"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-600"
                }`}
              >
                {item.status}
              </span>
            )}
            {item.confidence && (
              <div className="text-right">
                <p className="text-sm font-medium text-brand-teal">{item.confidence}</p>
                <p className="text-xs text-gray-500">{item.impact} impact</p>
              </div>
            )}
            {item.attendees && (
              <AvatarGroup
                spacing="sm"
                max={3}
                avatars={Array(item.attendees)
                  .fill(0)
                  .map((_, j) => ({
                    src: `/avatars/person-${(j % 9) + 1}.jpg`,
                    alt: `Attendee ${j + 1}`,
                    size: "xs" as const,
                  }))}
              />
            )}
            {item.spend && (
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{item.spend}</p>
                <p className="text-xs text-emerald-600">{item.roas} ROAS</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function ModulePreviewContent({ module }: { module: Module }) {
  switch (module.id) {
    case "ai-agent":
      return <AIAgentPreview module={module} />
    case "spreadsheet":
      return <SpreadsheetPreview module={module} />
    default:
      return <GenericPreview module={module} />
  }
}

type HeroSectionProps = {
  onGetStartedClick: () => void
}

export default function HeroSection({ onGetStartedClick }: HeroSectionProps) {
  const [hoveredModule, setHoveredModule] = useState<string | null>(null)
  const [selectedModule, setSelectedModule] = useState<string | null>(null)

  const activeModuleId = hoveredModule || selectedModule || "ai-agent"
  const activeModule = modules.find((m) => m.id === activeModuleId) || modules[0]
  const shouldBlur = !hoveredModule && !selectedModule

  return (
    <section className="py-8 md:py-16 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4 leading-tight">
            The Ultimate Work Operating System
            <br />
            <span className="bg-gradient-to-r from-brand-teal to-brand-lime bg-clip-text text-transparent">
              for Advertising Teams
            </span>
          </h1>
          <p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto mb-6 leading-relaxed">
            Integrating asset management, budget approval, campaign execution, and performance review into a unified
            platform, covering every stage of the advertising lifecycle.
          </p>
          <Button
            size="lg"
            onClick={onGetStartedClick}
            className="bg-brand-gradient hover:saturate-150 transition-all text-white rounded-full px-8 py-3 text-base font-medium glow-brand"
          >
            Get Started <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          <div className="relative lg:col-span-3 order-2 lg:order-1">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-teal/10 to-brand-lime/10 rounded-2xl transform rotate-1 scale-[1.02] opacity-60" />

            <motion.div
              className={`relative glass-card rounded-2xl p-6 transition-all duration-500 min-h-[380px] ${
                shouldBlur ? "blur-[6px]" : ""
              }`}
              layout
            >
              <div className="absolute -top-3 left-6 z-10">
                <motion.div
                  className={`${activeModule.color} text-white px-4 py-1.5 rounded-full text-sm font-medium shadow-lg flex items-center gap-2`}
                  layout
                  key={activeModule.id}
                >
                  <activeModule.icon className="w-4 h-4" />
                  {activeModule.name}
                </motion.div>
              </div>

              <div className="pt-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeModule.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ModulePreviewContent module={activeModule} />
                  </motion.div>
                </AnimatePresence>
              </div>

              <motion.p className="mt-4 text-sm text-gray-500 border-t border-gray-200 pt-4" layout>
                {activeModule.description}
              </motion.p>
            </motion.div>
          </div>

          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                What would you like to{" "}
                <span className="bg-gradient-to-r from-brand-teal to-brand-lime bg-clip-text text-transparent">
                  explore?
                </span>
              </h3>
              <p className="text-xs text-gray-500 mb-4">Click to select, hover to preview</p>

              <div className="grid grid-cols-2 gap-2">
                {modules.map((module) => {
                  const Icon = module.icon
                  const isSelected = selectedModule === module.id
                  const isActive = hoveredModule === module.id || isSelected
                  const isAIAgent = module.id === "ai-agent"

                  return (
                    <motion.button
                      key={module.id}
                      className={`relative p-3 rounded-xl border transition-all duration-200 text-left ${
                        isSelected
                          ? `border-brand-teal ${module.lightColor} ring-2 ring-brand-teal/30`
                          : isActive
                            ? `border-brand-teal/40 ${module.lightColor}`
                            : isAIAgent && !hoveredModule && !selectedModule
                              ? "border-brand-teal/25 bg-brand-teal/5"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                      onClick={() => setSelectedModule(isSelected ? null : module.id)}
                      onMouseEnter={() => setHoveredModule(module.id)}
                      onMouseLeave={() => setHoveredModule(null)}
                      onFocus={() => setHoveredModule(module.id)}
                      onBlur={() => setHoveredModule(null)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isAIAgent && !selectedModule && (
                        <span className="absolute -top-2 -right-2 bg-brand-gradient text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium">
                          KEY
                        </span>
                      )}
                      {isSelected && (
                        <motion.span
                          layoutId="selectedBadge"
                          className="absolute -top-2 -right-2 w-5 h-5 bg-brand-teal rounded-full flex items-center justify-center"
                        >
                          <CheckSquare className="w-3 h-3 text-white" />
                        </motion.span>
                      )}
                      <div
                        className={`w-8 h-8 rounded-lg ${isActive ? module.color : module.lightColor} flex items-center justify-center mb-1.5 transition-colors`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? "text-white" : module.textColor}`} />
                      </div>
                      <p className={`text-xs font-medium ${isActive ? "text-gray-900" : "text-gray-700"}`}>
                        {module.name}
                      </p>
                    </motion.button>
                  )
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <Button
                  onClick={onGetStartedClick}
                  className="w-full bg-brand-gradient hover:saturate-150 transition-all text-white rounded-full text-sm glow-brand"
                >
                  Get Started <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <AvatarGroup
                spacing="sm"
                max={4}
                avatars={[
                  { src: "/avatars/person-5.jpg", alt: "User 1", size: "sm" as const },
                  { src: "/avatars/person-6.jpg", alt: "User 2", size: "sm" as const },
                  { src: "/avatars/person-7.jpg", alt: "User 3", size: "sm" as const },
                  { src: "/avatars/person-8.jpg", alt: "User 4", size: "sm" as const },
                ]}
              />
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-900">2,000+</span> teams trust us
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
