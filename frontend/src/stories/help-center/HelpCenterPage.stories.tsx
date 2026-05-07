import type { Meta, StoryObj } from "@storybook/react"

import HelpCenterPage from "@/components/help-center/HelpCenterPage"

const meta: Meta<typeof HelpCenterPage> = {
  title: "Help Center/HelpCenterPage",
  component: HelpCenterPage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Composed Help Center page with hero search, onboarding spotlight, topic cards, academy section, community block, and support escalation cards.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof HelpCenterPage>

export const Default: Story = {}

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
}
