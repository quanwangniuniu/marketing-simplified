"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { ArrowRight, Quote, Star } from "lucide-react"
import { Avatar } from "@/components/avatar/Avatar"

const testimonials = [
  {
    id: 1,
    quote: "Finally, one place to manage budgets, assets, and approvals. We cut our setup time by half.",
    author: "Jack Wilson",
    role: "Senior Media Buyer",
    company: "Agency Partners",
    avatar: "/avatars/person-1.jpg",
    rating: 5,
  },
  {
    id: 2,
    quote: "I love how the review and approval flow feels natural. No more endless Slack threads.",
    author: "Eve Turner",
    role: "Designer",
    company: "Creative Studio",
    avatar: "/avatars/person-2.jpg",
    rating: 5,
  },
  {
    id: 3,
    quote: "The reporting dashboard gives instant clarity. We spot underperforming channels in minutes.",
    author: "Grace Lee",
    role: "Data Analyst",
    company: "Growth Labs",
    avatar: "/avatars/person-3.jpg",
    rating: 5,
  },
  {
    id: 4,
    quote: "The AI Agent has transformed how we manage campaigns. It catches issues before they become problems.",
    author: "Marcus Chen",
    role: "Marketing Director",
    company: "Tech Ventures",
    avatar: "/avatars/person-4.jpg",
    rating: 5,
  },
  {
    id: 5,
    quote: "Cross-platform campaign management used to take hours. Now it takes minutes.",
    author: "Sarah Martinez",
    role: "Media Specialist",
    company: "Digital First",
    avatar: "/avatars/person-9.jpg",
    rating: 5,
  },
  {
    id: 6,
    quote: "Our team collaboration improved dramatically. Everyone knows exactly what's happening.",
    author: "Tom Anderson",
    role: "Project Manager",
    company: "Brand Works",
    avatar: "/avatars/person-6.jpg",
    rating: 5,
  },
]

function TestimonialCard({ testimonial }: { testimonial: (typeof testimonials)[0] }) {
  return (
    <div className="glass-card rounded-2xl p-4 sm:p-6 min-w-[260px] max-w-[calc(100vw-3rem)] sm:min-w-[350px] sm:max-w-none flex-shrink-0 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col h-auto min-h-[200px] sm:h-[280px]">
      <div className="mb-2 sm:mb-4">
        <Quote className="w-6 h-6 sm:w-8 sm:h-8 text-brand-teal/30" />
      </div>

      <div className="flex gap-1 mb-2 sm:mb-3">
        {[...Array(testimonial.rating)].map((_, i) => (
          <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
        ))}
      </div>

      <p className="text-sm sm:text-base text-gray-700 mb-4 sm:mb-6 flex-grow leading-relaxed">
        &quot;{testimonial.quote}&quot;
      </p>

      <div className="flex items-center gap-3 mt-auto pt-4 border-t border-gray-100">
        <Avatar
          src={testimonial.avatar}
          alt={testimonial.author}
          size="lg"
          fallback={testimonial.author.split(" ").map((n) => n[0]).join("")}
          className="ring-2 ring-white shadow flex-shrink-0"
        />
        <div>
          <div className="font-bold text-gray-900">{testimonial.author}</div>
          <div className="text-sm text-gray-600">{testimonial.role}</div>
          <div className="text-xs text-gray-400">{testimonial.company}</div>
        </div>
      </div>
    </div>
  )
}

export default function NewTestimonialsSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section ref={ref} className="py-20 bg-gray-50/50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            What teams{" "}
            <span className="bg-gradient-to-r from-brand-teal to-brand-lime bg-clip-text text-transparent">
              love
            </span>{" "}
            about us
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            From setup to reporting, Marketing Simplified helps teams stay aligned, efficient, and confident in every
            campaign.
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative mb-12"
      >
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-gray-50/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-gray-50/80 to-transparent z-10 pointer-events-none" />

        <div className="overflow-hidden">
          <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
            {testimonials.map((testimonial) => (
              <div key={testimonial.id} className="pr-6">
                <TestimonialCard testimonial={testimonial} />
              </div>
            ))}
            {testimonials.map((testimonial) => (
              <div key={`dup-${testimonial.id}`} className="pr-6">
                <TestimonialCard testimonial={testimonial} />
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="text-center"
      >
        <button className="inline-flex items-center gap-2 px-8 py-4 bg-brand-gradient text-white rounded-full hover:saturate-150 transition-all font-medium text-lg glow-brand">
          See All Reviews
          <ArrowRight className="w-5 h-5" />
        </button>
      </motion.div>
    </section>
  )
}
