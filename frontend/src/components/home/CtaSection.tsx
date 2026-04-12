"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

type CtaSectionProps = {
  onGetStartedClick: () => void
}

export default function CtaSection({ onGetStartedClick }: CtaSectionProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section className="py-24" ref={ref}>
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-brand-teal/5 border border-brand-teal/15 p-12 lg:p-20 text-center"
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-96 h-96 bg-brand-teal/10 rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-lime/10 rounded-full blur-[80px] translate-x-1/2 translate-y-1/2" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto space-y-6">
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
              Ready to transform your
              <br />
              <span className="bg-gradient-to-r from-brand-teal to-brand-lime bg-clip-text text-transparent">
                Ad operations
              </span>
              ?
            </h2>

            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Simplify every stage of your advertising lifecycle - from planning to performance.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                onClick={onGetStartedClick}
                className="text-lg px-8 h-14 rounded-full bg-brand-gradient hover:saturate-150 transition-all text-white glow-brand"
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 h-14 rounded-full border-2 border-brand-teal/40 text-brand-teal bg-white hover:bg-brand-teal/5"
              >
                Contact Us
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
