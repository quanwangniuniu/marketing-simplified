"use client"

import Image from "next/image"
import Link from "next/link"
import { BookOpen, CircleHelp, CreditCard, MessageSquare, Settings, ShieldCheck, Users } from "lucide-react"

import HelpAcademyCard from "@/components/help-center/HelpAcademyCard"
import HelpHero from "@/components/help-center/HelpHero"
import HelpSupportEscalationCards from "@/components/help-center/HelpSupportEscalationCards"
import { Button } from "@/components/ui/button"

const topicCards = [
  {
    title: "Getting started",
    description: "Set up your workspace, invite teammates, and launch your first campaign faster.",
    href: "/docs",
    icon: CircleHelp,
  },
  {
    title: "Automation and rules",
    description: "Learn how to build automations and keep campaign workflows consistent.",
    href: "/docs/product",
    icon: Settings,
  },
  {
    title: "Billing and plans",
    description: "Manage plans, invoices, and account-level billing preferences.",
    href: "/pricing",
    icon: CreditCard,
  },
  {
    title: "Security and privacy",
    description: "Understand data protection, privacy controls, and account security practices.",
    href: "/security",
    icon: ShieldCheck,
  },
  {
    title: "Team collaboration",
    description: "Organize handoffs across creative, media, and operations teams.",
    href: "/solutions",
    icon: Users,
  },
  {
    title: "Integrations",
    description: "Connect your ad channels and tools to centralize campaign execution.",
    href: "/docs/product",
    icon: BookOpen,
  },
  {
    title: "Community",
    description: "Get advice from peers and learn practical workflows from active users.",
    href: "/help-center/community",
    icon: MessageSquare,
  },
  {
    title: "Contact support",
    description: "Reach the support team for urgent issues, troubleshooting, and account help.",
    href: "/help-center/contact-support",
    icon: CircleHelp,
  },
]

const academyCards = [
  {
    level: "Beginner" as const,
    title: "Structure work with projects and tasks",
    durationMinutes: 25,
    summary:
      "Build and manage projects, organize tasks, streamline collaboration, and automate recurring work.",
    href: "/help-center/academy/structure-work",
    ctaLabel: "Get started",
  },
  {
    level: "Beginner" as const,
    title: "Get started as an Administrator",
    durationMinutes: 15,
    summary: "Learn workspace roles, permissions, and setup best practices for smooth team onboarding.",
    href: "/help-center/academy/administrator",
    ctaLabel: "Get started",
  },
  {
    level: "Intermediate" as const,
    title: "Accelerate outcomes with AI workflows",
    durationMinutes: 25,
    summary: "Use AI-powered workflows to speed delivery and reduce repetitive campaign tasks.",
    href: "/help-center/academy/ai-workflows",
    ctaLabel: "Get started",
  },
]

const supportEscalationCards = [
  {
    title: "Go to Academy",
    description: "Follow structured courses and walkthroughs to unblock setup and team workflows.",
    href: "/help-center/academy",
    ctaLabel: "Start learning",
    tone: "academy" as const,
  },
  {
    title: "Visit community",
    description: "Get advice from peers, best practices, and real examples from active users.",
    href: "/help-center/community",
    ctaLabel: "Go to forum",
    tone: "community" as const,
  },
  {
    title: "Contact support",
    description: "Reach our support team for account issues, billing questions, and urgent troubleshooting.",
    href: "/help-center/contact-support",
    ctaLabel: "Open support",
    tone: "contact" as const,
  },
]

export default function HelpCenterPage() {
  return (
    <>
      <HelpHero onSearchSubmit={(query) => {
        const params = query ? `?q=${encodeURIComponent(query)}` : ""
        globalThis.location.href = `/docs${params}`
      }} />

      <section className="bg-white py-14 md:py-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 lg:text-5xl">Get your questions answered</h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {topicCards.map((card) => {
              const Icon = card.icon
              return (
                <Link
                  key={card.title}
                  href={card.href}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-teal/10 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
                >
                  <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal transition-colors duration-200 group-hover:bg-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-brand-teal/5 py-14 md:py-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Marketing Academy</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.02em] text-slate-900 lg:text-5xl">
                Get more out of Marketing 
              </h2>
            </div>
            <Button
              asChild
              className="mt-8 h-14 rounded-full bg-brand-gradient px-8 text-lg leading-8 text-white hover:saturate-150 focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
            >
              <Link href="/help-center/academy">Go to Marketing Academy</Link>
            </Button>
          </div>
          <div className="mt-8 md:mt-10">
            <HelpAcademyCard cards={academyCards} />
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center bg-white py-10 md:py-12">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 md:px-6 lg:grid-cols-2 lg:items-center">
          <div className="mx-auto w-full max-w-[360px] rounded-3xl bg-white p-2 lg:max-w-[340px]">
            <div className="overflow-hidden rounded-3xl">
              <Image
                src="/help-center/community access.png"
                alt="Community members sharing support and best practices"
                width={1800}
                height={1200}
                sizes="(max-width: 1024px) 75vw, 340px"
                className="h-auto min-h-[150px] w-full object-contain lg:min-h-[200px]"
              />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900 lg:text-5xl">Connect with other users</h2>
            <p className="mt-8 max-w-xl text-2xl leading-8 text-gray-900">
              Explore practical advice, real examples, and peer guidance from the MediaJira community.
            </p>
            <Button
              asChild
              className="ml-auto mt-8 h-14 rounded-full bg-brand-gradient px-8 text-lg leading-8 text-white hover:saturate-150 focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
            >
              <Link href="/help-center/community">Go to forum</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="w-full bg-brand-teal/10 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Still have questions?</h2>
          
          <div className="mt-8 md:mt-10">
            <HelpSupportEscalationCards cards={supportEscalationCards} />
          </div>
        </div>
      </section>
    </>
  )
}
