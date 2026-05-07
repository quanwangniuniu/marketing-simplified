import type { Meta, StoryObj } from "@storybook/react"
import { expect, userEvent, within } from "@storybook/test"

import HelpSupportEscalationCards from "@/components/help-center/HelpSupportEscalationCards"

const meta: Meta<typeof HelpSupportEscalationCards> = {
  title: "Help Center/HelpSupportEscalationCards",
  component: HelpSupportEscalationCards,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Support escalation cards for high-intent actions near the help center footer. Cards are fully clickable with clear destination labels.",
      },
    },
  },
  decorators: [
    (Story) => (
      <section className="w-full bg-brand-teal/10 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Still have questions?</h2>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-800">
            Choose the best support path and continue with the right team.
          </p>
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
        title: "Go to Academy",
        description: "Follow structured courses and walkthroughs to unblock setup and team workflows.",
        href: "/help-center/academy",
        ctaLabel: "Start learning",
        tone: "academy",
      },
      {
        title: "Visit community",
        description: "Get advice from peers, best practices, and real examples from active users.",
        href: "/help-center/community",
        ctaLabel: "Go to forum",
        tone: "community",
      },
      {
        title: "Contact support",
        description: "Reach our support team for account issues, billing questions, and urgent troubleshooting.",
        href: "/help-center/contact-support",
        ctaLabel: "Open support",
        tone: "contact",
      },
    ],
  },
}

export default meta
type Story = StoryObj<typeof HelpSupportEscalationCards>

export const Default: Story = {}

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
}

export const LinkInteraction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const supportLink = canvas.getByRole("link", { name: /contact support/i })
    await userEvent.hover(supportLink)
    await expect(supportLink).toHaveAttribute("href", "/help-center/contact-support")
  },
}
