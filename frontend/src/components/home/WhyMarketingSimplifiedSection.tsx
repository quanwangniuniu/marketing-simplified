"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import {
  Palette,
  TrendingUp,
  Target,
  BarChart3,
  ArrowRight,
  CheckCircle,
  Sparkles,
} from "lucide-react"

const personas = [
  {
    id: "designer",
    role: "Designer",
    avatar: "/avatars/person-1.jpg",
    bgColor: "bg-purple-100",
    accentColor: "text-purple-600",
    icon: Palette,
    pain: "My creative files get lost in endless email threads, and approvals take forever.",
    solution: "Centralized asset management with real-time approval workflows",
    benefits: [
      "Upload and organize all creative assets in one place",
      "Get instant feedback with inline comments",
      "Track approval status in real-time",
      "Version control for all your designs",
    ],
  },
  {
    id: "senior-buyer",
    role: "Senior Media Buyer",
    avatar: "/avatars/person-2.jpg",
    bgColor: "bg-brand-teal/15",
    accentColor: "text-brand-teal",
    icon: TrendingUp,
    pain: "Budgets are tracked in spreadsheets, and I never know if the latest version is approved.",
    solution: "Automated budget tracking with approval workflows",
    benefits: [
      "Real-time budget visibility across all campaigns",
      "Automated approval routing based on thresholds",
      "Historical tracking of all budget changes",
      "Instant alerts for budget overruns",
    ],
  },
  {
    id: "specialist",
    role: "Specialist Media Buyer",
    avatar: "/avatars/person-3.jpg",
    bgColor: "bg-emerald-100",
    accentColor: "text-emerald-600",
    icon: Target,
    pain: "Managing Google Ads, TikTok, and Facebook separately wastes time and causes errors.",
    solution: "Unified campaign management across all platforms",
    benefits: [
      "Manage all ad platforms from one dashboard",
      "Sync campaigns across channels automatically",
      "Reduce manual data entry errors by 90%",
      "Cross-platform performance comparison",
    ],
  },
  {
    id: "analyst",
    role: "Data Analyst",
    avatar: "/avatars/person-4.jpg",
    bgColor: "bg-orange-100",
    accentColor: "text-orange-600",
    icon: BarChart3,
    pain: "I spend days collecting data from different tools just to prepare a report.",
    solution: "Automated reporting with AI-powered insights",
    benefits: [
      "Auto-generate reports from all data sources",
      "AI highlights key trends and anomalies",
      "Customizable dashboards for stakeholders",
      "Export to any format in one click",
    ],
  },
]

export default function WhyMarketingSimplifiedSection() {
  const [activePersona, setActivePersona] = useState(personas[0])
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
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Why{" "}
            <span className="bg-gradient-to-r from-brand-teal to-brand-lime bg-clip-text text-transparent">
              Marketing Simplified
            </span>
            ?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            We turn common advertising challenges into streamlined, end-to-end solutions.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            {personas.map((persona, index) => {
              const IconComponent = persona.icon
              const isActive = activePersona.id === persona.id

              return (
                <motion.button
                  key={persona.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.1 * index }}
                  onClick={() => setActivePersona(persona)}
                  className={`relative p-5 rounded-2xl text-left transition-all duration-300 ${
                    isActive
                      ? "glass-card ring-2 ring-brand-teal shadow-lg shadow-brand-teal/10"
                      : "glass-card hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={`w-12 h-12 rounded-full overflow-hidden flex-shrink-0 ring-2 ${
                        isActive ? "ring-brand-teal" : "ring-gray-200"
                      }`}
                    >
                      <img src={persona.avatar} alt={persona.role} className="w-full h-full object-cover" />
                    </div>
                    <div className={`w-8 h-8 rounded-lg ${persona.bgColor} flex items-center justify-center`}>
                      <IconComponent className={`w-4 h-4 ${persona.accentColor}`} />
                    </div>
                  </div>
                  <h3 className={`font-bold text-sm mb-2 ${isActive ? "text-brand-teal" : "text-gray-900"}`}>
                    {persona.role}
                  </h3>
                  <p className="text-xs text-gray-500 italic line-clamp-2">
                    &quot;{persona.pain}&quot;
                  </p>
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute top-3 right-3 w-2 h-2 rounded-full bg-brand-teal"
                    />
                  )}
                </motion.button>
              )
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activePersona.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-brand-teal/5 rounded-3xl p-8 relative overflow-hidden border border-brand-teal/15"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-teal/15 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-lime/15 rounded-full translate-y-1/2 -translate-x-1/2 opacity-50" />

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white shadow-lg">
                      <img src={activePersona.avatar} alt={activePersona.role} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{activePersona.role}</h3>
                      <div className="flex items-center gap-1 text-sm text-brand-teal">
                        <Sparkles className="w-3 h-3" />
                        <span>Solution</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
                    <h4 className="font-bold text-lg text-gray-900 mb-2">{activePersona.solution}</h4>
                    <p className="text-gray-500 text-sm italic mb-4">
                      Instead of: &quot;{activePersona.pain}&quot;
                    </p>
                  </div>

                  <div className="space-y-3">
                    {activePersona.benefits.map((benefit, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className="flex items-start gap-3"
                      >
                        <CheckCircle className="w-5 h-5 text-brand-lime flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-sm">{benefit}</span>
                      </motion.div>
                    ))}
                  </div>

                  <button className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-brand-gradient text-white rounded-full hover:saturate-150 transition-all font-medium text-sm glow-brand">
                    Learn More
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
