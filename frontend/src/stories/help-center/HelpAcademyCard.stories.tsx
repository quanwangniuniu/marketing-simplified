import type { Meta, StoryObj } from "@storybook/react"
import Link from "next/link"

import HelpAcademyCard from "@/components/help-center/HelpAcademyCard"

const meta: Meta<typeof HelpAcademyCard> = {
  title: "Help Center/HelpAcademyCard",
  component: HelpAcademyCard,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Academy / Learning cards rendered in a responsive grid (3 per row on desktop).",
      },
    },
  },
  decorators: [
    (Story) => (
      <section className="bg-[#f3f3f3] py-12 md:py-16">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[#3a3a3a]">Asana Academy</p>
              <h2 className="mt-2 text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-[#202020] md:text-5xl">
                Get more out of Asana
              </h2>
            </div>
            <Link
              href="/help-center/academy"
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#222] px-7 text-base font-medium text-[#111] transition-colors hover:bg-white"
            >
              Go to Asana Academy
            </Link>
          </div>
          <div className="mt-8 md:mt-10">
            <Story />
          </div>
        </div>
      </section>
    ),
  ],
  args: {
    cards: [
      {
        level: "Beginner",
        title: "Structure work with projects and tasks",
        durationMinutes: 25,
        summary:
          "Build and manage projects, organize tasks, streamline collaboration, and unlock Asana's AI to automate and accelerate your team's work.",
        href: "/help-center/academy/structure-work",
        ctaLabel: "Get started",
      },
      {
        level: "Beginner",
        title: "Get started as an Administrator",
        durationMinutes: 15,
        summary:
          "Learn the fundamental roles, responsibilities, and expectations for workspace management to build your foundation as an Asana admin.",
        href: "/help-center/academy/administrator",
        ctaLabel: "Get started",
      },
      {
        level: "Intermediate",
        title: "Accelerate outcomes with AI Teammates",
        durationMinutes: 25,
        summary:
          "Collaborate with AI Teammates to drive faster, context-aware business outcomes across your team's workflows.",
        href: "/help-center/academy/ai-teammates",
        ctaLabel: "Get started",
      },
    ],
  },
}

export default meta
type Story = StoryObj<typeof HelpAcademyCard>

export const Default: Story = {}

export const Intermediate: Story = {
  args: {
    cards: [
      {
        level: "Intermediate",
        title: "Reporting Fundamentals",
        durationMinutes: 24,
        summary:
          "Build repeatable reports and dashboards so your team can monitor delivery, spend, and outcomes with confidence.",
        href: "/help-center/academy/reporting-fundamentals",
        ctaLabel: "Get started",
      },
      {
        level: "Intermediate",
        title: "Campaign Status Reviews",
        durationMinutes: 20,
        summary: "Run structured weekly reviews and keep stakeholders aligned on risks, wins, and next steps.",
        href: "/help-center/academy/status-reviews",
        ctaLabel: "Get started",
      },
      {
        level: "Intermediate",
        title: "Cross-team Collaboration",
        durationMinutes: 26,
        summary: "Coordinate creative, media, and operations teams with clear ownership and shared timelines.",
        href: "/help-center/academy/collaboration",
        ctaLabel: "Get started",
      },
    ],
  },
}

export const Advanced: Story = {
  args: {
    cards: [
      {
        level: "Advanced",
        title: "Scaling Multi-Team Operations",
        durationMinutes: 32,
        summary:
          "Set up governance and collaboration patterns for large organizations running cross-team campaigns.",
        href: "/help-center/academy/scaling-operations",
        ctaLabel: "Get started",
      },
      {
        level: "Advanced",
        title: "Automation Governance",
        durationMinutes: 30,
        summary: "Design safe automation boundaries and approval gates for complex campaign workflows.",
        href: "/help-center/academy/automation-governance",
        ctaLabel: "Get started",
      },
      {
        level: "Advanced",
        title: "Executive Performance Views",
        durationMinutes: 35,
        summary: "Create executive-level reporting views that connect outputs to business outcomes.",
        href: "/help-center/academy/executive-views",
        ctaLabel: "Get started",
      },
    ],
  },
}

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
}
