"use client"

import { useRef, type ReactNode } from "react"
import { motion, useInView } from "framer-motion"
import { Avatar } from "@/components/avatar/Avatar"
import {
  SearchCheck,
  ShieldCheck,
  TextSearch,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  Send,
  type LucideIcon,
} from "lucide-react"

type Feature = {
  id: string
  icon?: LucideIcon
  iconSrc?: string
  gradient: string
  headline: string
  body: string
  visual: ReactNode
}

const features: Feature[] = [
  {
    id: "spreadsheet",
    icon: SearchCheck,
    gradient: "from-brand-teal to-brand-lime",
    headline: "AI-Driven Anomaly Detection",
    body: "Drop in campaign spreadsheets and quickly see which ads are wasting spend, which trends need attention, and where to act next.",
    visual: <SpreadsheetMockup />,
  },
  {
    id: "decision",
    icon: ShieldCheck,
    gradient: "from-brand-teal to-brand-lime",
    headline: "Data-Backed Go/No-Go",
    body: "Move budget decisions out of guesswork with clear recommendations, confidence signals, and the expected impact on performance.",
    visual: <DecisionMockup />,
  },
  {
    id: "task",
    iconSrc: "/icons/task-list-20-filled.svg",
    gradient: "from-brand-teal to-brand-lime",
    headline: "Automated Task Orchestration",
    body: "Keep briefs, creative reviews, approvals, and launch tasks moving in one flow, so every owner knows what needs attention.",
    visual: <TaskMockup />,
  },
  {
    id: "chat",
    icon: TextSearch,
    gradient: "from-brand-teal to-brand-lime",
    headline: "Natural Language Project Querying",
    body: "Ask about spend, timelines, planning boards, or upcoming meetings and get answers that help the team make the next call.",
    visual: <ChatMockup />,
  },
]

function FeatureIcon({
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

function SpreadsheetMockup() {
  const rows = [
    { campaign: "Summer Promo", spend: "$14,200", change: "+18%", flag: true },
    { campaign: "Brand Awareness", spend: "$9,400", change: "+5%", flag: false },
    { campaign: "Retargeting Q2", spend: "$6,100", change: "-22%", flag: true },
    { campaign: "Launch Event", spend: "$3,800", change: "+9%", flag: false },
  ]

  return (
    <div className="bg-white rounded-xl p-4 h-full shadow-sm border border-gray-100">
      <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-500 pb-2 border-b border-gray-200 mb-1">
        <span>Campaign</span>
        <span>Spend</span>
        <span>Change</span>
        <span className="text-center">Flag</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.campaign}
          className={`grid grid-cols-4 gap-2 py-2 text-xs border-b border-gray-100 ${
            row.flag ? "bg-rose-50" : ""
          }`}
        >
          <span className="text-gray-900 font-medium truncate">{row.campaign}</span>
          <span className="text-gray-500">{row.spend}</span>
          <span className={row.change.startsWith("+") ? "text-emerald-600" : "text-rose-600"}>
            {row.change}
          </span>
          <span className="flex justify-center">
            {row.flag && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
          </span>
        </div>
      ))}
    </div>
  )
}

function DecisionMockup() {
  return (
    <div className="bg-white rounded-xl p-5 h-full flex flex-col gap-4 shadow-sm border border-gray-100">
      <div>
        <div className="text-xs text-gray-400 mb-1">AI Recommendation</div>
        <p className="text-sm text-gray-900 font-medium">
          Increase TikTok budget by 20% and pause underperforming LinkedIn set
        </p>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-gray-500">Confidence:</span>
          <span className="text-emerald-600 font-semibold">92%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-brand-teal" />
          <span className="text-gray-500">Impact:</span>
          <span className="text-brand-teal font-semibold">High</span>
        </div>
      </div>
      <div className="flex gap-3 mt-auto">
        <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg border border-emerald-200 hover:bg-emerald-100 transition">
          <ThumbsUp className="w-3.5 h-3.5" />
          Approve
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 text-xs font-medium rounded-lg border border-rose-200 hover:bg-rose-100 transition">
          <ThumbsDown className="w-3.5 h-3.5" />
          Reject
        </button>
      </div>
    </div>
  )
}

function TaskMockup() {
  const pipeline = [
    { name: "Create brief", status: "done" },
    { name: "Design assets", status: "done" },
    { name: "Copy review", status: "active" },
    { name: "Launch campaign", status: "pending" },
  ]

  return (
    <div className="bg-white rounded-xl p-4 h-full shadow-sm border border-gray-100">
      <div className="text-xs text-gray-400 mb-3">Task Pipeline</div>
      <div className="space-y-2">
        {pipeline.map((task) => (
          <div key={task.name} className="flex items-center gap-3">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                task.status === "done"
                  ? "bg-emerald-100 text-emerald-600"
                  : task.status === "active"
                    ? "bg-brand-teal/15 text-brand-teal ring-2 ring-brand-teal/25"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {task.status === "done" ? "\u2713" : task.status === "active" ? "\u25B6" : "\u2022"}
            </div>
            <span
              className={`text-sm ${
                task.status === "done"
                  ? "text-gray-400 line-through"
                  : task.status === "active"
                    ? "text-gray-900 font-medium"
                    : "text-gray-500"
              }`}
            >
              {task.name}
            </span>
            {task.status === "active" && (
              <span className="ml-auto text-[10px] px-2 py-0.5 bg-brand-teal/10 text-brand-teal rounded-full border border-brand-teal/25">
                In Progress
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full w-[60%] bg-brand-gradient rounded-full" />
      </div>
    </div>
  )
}

function ChatMockup() {
  return (
    <div className="bg-white rounded-xl p-4 h-full flex flex-col shadow-sm border border-gray-100">
      <div className="space-y-3 flex-1">
        <div className="flex gap-2">
          <Avatar
            src="https://unsplash.com/photos/man-wearing-eyeglasses-and-blue-shirt-inside-coffee-shop-QJEVpydulGs"
            alt="User"
            size="xs"
            fallback="U"
            className="flex-shrink-0"
          />
          <div className="bg-gray-100 rounded-lg rounded-tl-sm px-3 py-2 text-xs text-gray-700 max-w-[80%]">
            What&apos;s my ad spend for Q2 across all channels?
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <div className="bg-brand-teal/10 rounded-lg rounded-tr-sm px-3 py-2 text-xs text-slate-800 max-w-[80%] border border-brand-teal/20">
            Your total Q2 spend is <span className="font-semibold text-gray-900">$42,600</span> across 4 channels. Facebook leads at $15.2k (+12% MoM).
          </div>
          <div className="w-6 h-6 rounded-full bg-brand-gradient flex-shrink-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">AI</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2">
        <span className="text-xs text-gray-400 flex-1">Ask about your project...</span>
        <Send className="w-3.5 h-3.5 text-brand-teal" />
      </div>
    </div>
  )
}

function FeatureRow({
  feature,
  index,
  isInView,
}: {
  feature: Feature
  index: number
  isInView: boolean
}) {
  const isEven = index % 2 === 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: 0.15 * index }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center"
    >
      <div className={`space-y-5 ${isEven ? "lg:order-2" : ""}`}>
        <div
          className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg`}
        >
          <FeatureIcon icon={feature.icon} iconSrc={feature.iconSrc} className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-2xl lg:text-3xl font-bold text-gray-900">{feature.headline}</h3>
        <p className="text-gray-600 text-lg leading-relaxed">{feature.body}</p>
        <button className="inline-flex items-center gap-2 text-brand-teal hover:text-brand-teal/80 font-medium text-sm transition">
          Learn more <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className={`${isEven ? "lg:order-1" : ""}`}>
        {feature.visual}
      </div>
    </motion.div>
  )
}

export default function FeatureShowcaseSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section ref={ref} className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Run smarter{" "}
            <span className="bg-gradient-to-r from-brand-teal to-brand-lime bg-clip-text text-transparent">
              media campaigns
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See what needs attention, decide where budget should move, and keep every campaign owner aligned from brief to launch.
          </p>
        </motion.div>

        <div className="space-y-24">
          {features.map((feature, index) => (
            <FeatureRow
              key={feature.id}
              feature={feature}
              index={index}
              isInView={isInView}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
