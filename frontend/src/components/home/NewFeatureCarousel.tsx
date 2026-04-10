"use client"

import { useRef, useEffect, useState } from "react"
import { motion, useInView } from "framer-motion"
import {
  Bot,
  Table2,
  Video,
  CheckSquare,
  Megaphone,
  Lightbulb,
  Zap,
  Target,
  Brain,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AvatarGroup } from "@/components/avatar/AvatarGroup"

interface FeatureCard {
  id: string
  title: string
  subtitle: string
  description: string
  icon: typeof Bot
  gradient: string
  bgColor: string
  preview: React.ReactNode
}

function AIAgentPreview() {
  return (
    <div className="space-y-3 h-full flex flex-col">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-lg p-3 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-900">Campaign analyzed</span>
          <span className="ml-auto text-xs text-indigo-600">Auto</span>
        </div>
        <p className="text-xs text-gray-500">Identified 3 optimization opportunities</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-lg p-3 shadow-sm border border-gray-100"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-400 flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-900">Budget reallocated</span>
          <span className="ml-auto text-xs text-emerald-600">+12% ROAS</span>
        </div>
        <p className="text-xs text-gray-500">Shifted $2.5k to high-performers</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white rounded-lg p-3 shadow-sm border border-indigo-200"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-900">Decision pending</span>
        </div>
        <p className="text-xs text-gray-500 mb-2">Scale winning ad set by 30%?</p>
        <div className="flex gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white">Approve</span>
          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">Review</span>
        </div>
      </motion.div>
    </div>
  )
}

function SpreadsheetPreview() {
  const rows = [
    { campaign: "Summer Sale", spend: "$12,450", conv: "342", roas: "4.2x" },
    { campaign: "Brand Launch", spend: "$8,200", conv: "189", roas: "3.8x" },
    { campaign: "Retargeting", spend: "$5,100", conv: "412", roas: "6.1x" },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-500 pb-2 border-b border-gray-200">
        <span>Campaign</span>
        <span>Spend</span>
        <span>Conv.</span>
        <span>ROAS</span>
      </div>
      {rows.map((row, i) => (
        <motion.div
          key={row.campaign}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 + i * 0.15 }}
          className="grid grid-cols-4 gap-2 py-2 text-xs border-b border-gray-100"
        >
          <span className="font-medium text-gray-900 truncate">{row.campaign}</span>
          <span className="text-gray-500">{row.spend}</span>
          <span className="text-gray-500">{row.conv}</span>
          <span className="text-emerald-600 font-medium">{row.roas}</span>
        </motion.div>
      ))}
    </div>
  )
}

function CampaignPreview() {
  return (
    <div className="h-full flex flex-col gap-3">
      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-900">Q2 Product Launch</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Active</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>Budget: $50k</span>
          <span>Reach: 2.4M</span>
        </div>
        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
            initial={{ width: 0 }}
            animate={{ width: "68%" }}
            transition={{ duration: 1, delay: 0.5 }}
          />
        </div>
      </div>
      <div className="flex gap-2">
        {["Meta", "Google", "TikTok"].map((platform, i) => (
          <motion.div
            key={platform}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="flex-1 bg-white rounded-lg p-2 text-center shadow-sm border border-gray-100"
          >
            <p className="text-xs font-medium text-gray-900">{platform}</p>
            <p className="text-xs text-gray-500">Active</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function MeetingPreview() {
  return (
    <div className="h-full flex flex-col gap-3">
      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <Video className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-gray-900">Campaign Review</span>
        </div>
        <p className="text-xs text-gray-500 mb-2">Today, 2:00 PM - 3:00 PM</p>
        <AvatarGroup
          spacing="sm"
          max={3}
          avatars={[
            { src: "https://i.pravatar.cc/150?img=10", alt: "Attendee 1", size: "xs" },
            { src: "https://i.pravatar.cc/150?img=20", alt: "Attendee 2", size: "xs" },
            { src: "https://i.pravatar.cc/150?img=30", alt: "Attendee 3", size: "xs" },
            { src: "https://i.pravatar.cc/150?img=40", alt: "Attendee 4", size: "xs" },
            { src: "https://i.pravatar.cc/150?img=50", alt: "Attendee 5", size: "xs" },
          ]}
        />
      </div>
      <div className="bg-white/80 rounded-lg p-3 border border-gray-200">
        <p className="text-xs font-medium text-gray-900 mb-1">AI Meeting Notes</p>
        <p className="text-xs text-gray-500">3 action items captured automatically</p>
      </div>
    </div>
  )
}

function TaskPreview() {
  const tasks = [
    { name: "Review creatives", priority: "High", done: true },
    { name: "Approve budget", priority: "High", done: false },
    { name: "Send report", priority: "Med", done: false },
  ]

  return (
    <div className="space-y-2">
      {tasks.map((task, i) => (
        <motion.div
          key={task.name}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 + i * 0.1 }}
          className={`bg-white rounded-lg p-3 shadow-sm border border-gray-100 flex items-center gap-3 ${task.done ? "opacity-60" : ""}`}
        >
          <div
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${task.done ? "bg-rose-500 border-rose-500" : "border-gray-300"}`}
          >
            {task.done && <CheckSquare className="w-3 h-3 text-white" />}
          </div>
          <span className={`text-sm flex-1 ${task.done ? "line-through text-gray-400" : "text-gray-900"}`}>
            {task.name}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${task.priority === "High" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}
          >
            {task.priority}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

function DecisionPreview() {
  return (
    <div className="h-full flex flex-col gap-3">
      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-gray-900">AI Recommendation</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">Increase TikTok spend by 25% based on performance trends</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-600">+18% projected ROAS</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">High confidence</span>
        </div>
      </div>
      <div className="flex gap-2 mt-auto">
        <Button size="sm" className="flex-1 text-xs h-8 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white">
          Approve
        </Button>
        <Button size="sm" variant="outline" className="flex-1 text-xs h-8 border-gray-300 text-gray-700 hover:bg-gray-50">
          Modify
        </Button>
      </div>
    </div>
  )
}

const features: FeatureCard[] = [
  {
    id: "ai-agent",
    title: "Marketing Simplified",
    subtitle: "AI Agent",
    description: "Your autonomous AI that manages campaigns, optimizes budgets, and makes decisions 24/7",
    icon: Bot,
    gradient: "from-indigo-500 to-violet-500",
    bgColor: "bg-gradient-to-br from-indigo-50 to-violet-50",
    preview: <AIAgentPreview />,
  },
  {
    id: "spreadsheet",
    title: "Marketing Simplified",
    subtitle: "Spreadsheets",
    description: "Powerful data views with real-time collaboration and automated calculations",
    icon: Table2,
    gradient: "from-emerald-500 to-emerald-400",
    bgColor: "bg-gradient-to-br from-emerald-50 to-green-50",
    preview: <SpreadsheetPreview />,
  },
  {
    id: "campaigns",
    title: "Marketing Simplified",
    subtitle: "Campaigns",
    description: "Plan, execute, and track all your media campaigns in one unified dashboard",
    icon: Megaphone,
    gradient: "from-orange-500 to-amber-500",
    bgColor: "bg-gradient-to-br from-orange-50 to-amber-50",
    preview: <CampaignPreview />,
  },
  {
    id: "meetings",
    title: "Marketing Simplified",
    subtitle: "Meetings",
    description: "AI-powered meeting scheduler with automatic notes and action items",
    icon: Video,
    gradient: "from-violet-500 to-purple-500",
    bgColor: "bg-gradient-to-br from-violet-50 to-purple-50",
    preview: <MeetingPreview />,
  },
  {
    id: "tasks",
    title: "Marketing Simplified",
    subtitle: "Tasks",
    description: "Smart task management with AI prioritization and deadline predictions",
    icon: CheckSquare,
    gradient: "from-rose-500 to-pink-500",
    bgColor: "bg-gradient-to-br from-rose-50 to-pink-50",
    preview: <TaskPreview />,
  },
  {
    id: "decisions",
    title: "Marketing Simplified",
    subtitle: "Decisions",
    description: "Data-driven decision framework powered by AI insights and analytics",
    icon: Lightbulb,
    gradient: "from-amber-500 to-yellow-500",
    bgColor: "bg-gradient-to-br from-amber-50 to-yellow-50",
    preview: <DecisionPreview />,
  },
]

function FeatureCardComponent({ feature }: { feature: FeatureCard }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      className={`relative h-[480px] rounded-2xl overflow-hidden glass-card transition-shadow duration-300 ${
        isHovered ? "shadow-xl shadow-indigo-100" : ""
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <div
            className={`w-8 h-8 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center`}
          >
            <feature.icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-gray-900">{feature.title}</span>
            <span className="text-gray-500 font-medium">{feature.subtitle}</span>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-3 leading-snug">{feature.description}</h3>

        <div className={`flex-1 rounded-xl ${feature.bgColor} p-4 overflow-hidden border border-gray-100`}>{feature.preview}</div>
      </div>
    </motion.div>
  )
}

export default function NewFeatureCarousel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { once: true, margin: "-100px" })
  const [isPaused, setIsPaused] = useState(false)
  const [scrollPosition, setScrollPosition] = useState(0)

  useEffect(() => {
    if (!containerRef.current || isPaused) return

    const scrollContainer = containerRef.current
    let animationId: number

    const scroll = () => {
      if (!isPaused) {
        setScrollPosition((prev) => {
          const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth
          const newPos = prev + 0.5
          if (newPos >= maxScroll) return 0
          return newPos
        })
      }
      animationId = requestAnimationFrame(scroll)
    }

    animationId = requestAnimationFrame(scroll)
    return () => cancelAnimationFrame(animationId)
  }, [isPaused])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = scrollPosition
    }
  }, [scrollPosition])

  return (
    <section className="py-20 bg-gray-50/50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              simplify
            </span>{" "}
            media buying
          </h2>
          <p className="text-xl text-gray-600">One platform. Every stage. Powered by AI.</p>
        </motion.div>
      </div>

      <div
        ref={containerRef}
        className="flex gap-6 overflow-x-auto pb-8 px-8 scrollbar-hide cursor-grab"
        style={{ scrollBehavior: "auto" }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {features.map((feature, index) => (
          <motion.div
            key={feature.id}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: index * 0.1 }}
            className="flex-shrink-0 w-[380px]"
          >
            <FeatureCardComponent feature={feature} />
          </motion.div>
        ))}
      </div>
    </section>
  )
}
