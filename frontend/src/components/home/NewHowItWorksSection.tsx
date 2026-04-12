"use client"

import { useState, useRef } from "react"
import { motion, useInView } from "framer-motion"
import {
  Users,
  Rocket,
  Zap,
  BarChart3,
  ArrowRight,
  CheckCircle,
  Play,
} from "lucide-react"

const steps = [
  {
    id: 1,
    title: "Plan & Assign",
    description: "Define roles, permissions, and tasks in one place.",
    details: [
      "Set up team roles and access levels",
      "Create and assign tasks to team members",
      "Define approval workflows",
      "Set project timelines and milestones",
    ],
    icon: Users,
    gradient: "from-brand-teal to-brand-lime",
  },
  {
    id: 2,
    title: "Execute & Collab",
    description: "Manage assets, budgets, and channels seamlessly.",
    details: [
      "Upload and manage creative assets",
      "Track budget allocation in real-time",
      "Coordinate across multiple channels",
      "Collaborate with inline comments",
    ],
    icon: Rocket,
    gradient: "from-amber-500 to-orange-500",
  },
  {
    id: 3,
    title: "Automate & Notify",
    description: "Trigger smart workflows and stay informed in real time.",
    details: [
      "AI-powered task automation",
      "Smart notifications for key events",
      "Automated approval routing",
      "Real-time status updates",
    ],
    icon: Zap,
    gradient: "from-rose-500 to-pink-500",
  },
  {
    id: 4,
    title: "Analyze & Optimize",
    description: "Turn data into insights for your next campaign.",
    details: [
      "Comprehensive performance dashboards",
      "AI-generated insights and recommendations",
      "Cross-channel analytics",
      "Exportable reports for stakeholders",
    ],
    icon: BarChart3,
    gradient: "from-emerald-500 to-teal-500",
  },
]

type NewHowItWorksSectionProps = {
  onGetStartedClick: () => void
}

export default function NewHowItWorksSection({ onGetStartedClick }: NewHowItWorksSectionProps) {
  const [activeStep, setActiveStep] = useState(1)
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
            How it{" "}
            <span className="bg-gradient-to-r from-brand-teal to-brand-lime bg-clip-text text-transparent">
              works
            </span>
            ?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            From setup to optimization, Marketing Simplified keeps your campaigns moving effortlessly.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4"
          >
            {steps.map((step, index) => {
              const IconComponent = step.icon
              const isActive = activeStep === step.id

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.1 * index }}
                  onClick={() => setActiveStep(step.id)}
                  className={`relative flex items-start gap-4 p-5 rounded-2xl cursor-pointer transition-all duration-300 ${
                    isActive
                      ? "glass-card ring-1 ring-brand-teal/25 shadow-lg shadow-brand-teal/10"
                      : "bg-gray-50 hover:bg-gray-100 border border-transparent"
                  }`}
                >
                  <div
                    className={`relative flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-lg`}
                  >
                    <IconComponent className="w-6 h-6 text-white" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-900 shadow border border-gray-200">
                      {step.id}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h3 className={`font-bold text-lg mb-1 ${isActive ? "text-brand-teal" : "text-gray-900"}`}>
                      {step.title}
                    </h3>
                    <p className="text-gray-500 text-sm">{step.description}</p>
                  </div>

                  {isActive && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Play className="w-4 h-4 text-brand-teal fill-brand-teal" />
                    </motion.div>
                  )}

                  {index < steps.length - 1 && (
                    <div className="absolute left-9 top-[72px] w-0.5 h-4 bg-gray-200" />
                  )}
                </motion.div>
              )
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {steps.map((step) => {
              if (step.id !== activeStep) return null
              const IconComponent = step.icon

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="glass-card rounded-3xl overflow-hidden shadow-xl"
                >
                  <div className={`bg-gradient-to-r ${step.gradient} p-6`}>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                        <IconComponent className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <span className="text-white/80 text-sm font-medium">Step {step.id}</span>
                        <h3 className="text-2xl font-bold text-white">{step.title}</h3>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <p className="text-gray-600 mb-6">{step.description}</p>

                    <div className="space-y-3">
                      {step.details.map((detail, detailIndex) => (
                        <motion.div
                          key={detailIndex}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * detailIndex }}
                          className="flex items-center gap-3"
                        >
                          <CheckCircle className="w-5 h-5 text-brand-lime flex-shrink-0" />
                          <span className="text-gray-700">{detail}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center"
        >
          <button
            onClick={onGetStartedClick}
            className="inline-flex items-center gap-2 px-8 py-4 bg-brand-gradient text-white rounded-full hover:saturate-150 transition-all font-medium text-lg glow-brand"
          >
            Start Your Journey Today
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </section>
  )
}
