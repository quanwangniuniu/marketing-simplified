import type { Meta, StoryObj } from "@storybook/react"

import HelpNewUserSpotlight from "@/components/help-center/HelpNewUserSpotlight"

const meta: Meta<typeof HelpNewUserSpotlight> = {
  title: "Help Center/HelpNewUserSpotlight",
  component: HelpNewUserSpotlight,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "New-user spotlight section for Help Center with left image card, right onboarding copy, and primary CTA.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof HelpNewUserSpotlight>

export const Default: Story = {}

export const Fullscreen: Story = {
  parameters: {
    layout: "fullscreen",
  },
}

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
}

export const CustomCopy: Story = {
  args: {
    title: "New to MediaJira?",
    description:
      "Take a quick tour to set up projects, invite teammates, and find best-practice templates for your first week.",
    ctaLabel: "Start onboarding",
    ctaHref: "/help-center/get-started",
  },
}
