"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import Image from "next/image"
import { ArrowRight, Zap } from "lucide-react"

const integrations = [
  { name: "Google Ads", icon: "/icons/google-ads.svg" },
  { name: "Meta Ads", icon: "/icons/meta.svg" },
  { name: "TikTok", icon: "/icons/tiktok.svg" },
  { name: "Slack", icon: "/icons/slack.svg" },
  { name: "Zoom", icon: "/icons/zoom.svg" },
  { name: "Stripe", icon: "/icons/stripe.svg" },
  { name: "Google Sheets", icon: "/icons/google-spreadsheet.svg" },
  { name:"Google Gemini", icon: "/icons/google-gemini.svg" },
]

const stats = [
  { value: "10+", label: "Integrations" },
  { value: "10K+", label: "Active Teams" },
  { value: "99.9%", label: "Uptime" },
  { value: "24/7", label: "Support" },
]

export default function IntegrationsSection() {
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
            <Zap className="w-4 h-4" />
            Seamless Integrations
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Connect with your{" "}
            <span className="bg-gradient-to-r from-brand-teal to-brand-lime bg-clip-text text-transparent">
              favorite tools
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Marketing Simplified works with 10+ tools you already use, making it easy to centralize your workflow.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <div className="grid grid-cols-4 md:grid-cols-7 gap-6">
            {integrations.map(({ name, icon }, index) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.3, delay: 0.05 * index }}
                className="group relative flex flex-col items-center justify-center gap-2 p-5 glass-card rounded-2xl hover:shadow-lg transition-all duration-300 cursor-pointer"
              >
                <Image src={icon} alt={name} width={28} height={28} />
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-brand-gradient rounded-3xl p-8 md:p-12"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-white/80 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center mt-12"
        >
          <button className="inline-flex items-center gap-2 px-8 py-4 bg-brand-gradient text-white rounded-full hover:saturate-150 transition-all font-medium text-lg glow-brand">
            View All Integrations
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </section>
  )
}
