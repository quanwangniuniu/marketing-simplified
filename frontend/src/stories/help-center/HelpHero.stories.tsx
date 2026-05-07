import type { Meta, StoryObj } from "@storybook/react"
import { expect, fn, userEvent, within } from "@storybook/test"

import HelpHero from "@/components/help-center/HelpHero"

const meta: Meta<typeof HelpHero> = {
  title: "Help Center/HelpHero",
  component: HelpHero,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Public Help Center hero section with accessible search input, clear action, and right-aligned illustration.",
      },
    },
  },
  args: {
    onSearchSubmit: fn(),
  },
}

export default meta
type Story = StoryObj<typeof HelpHero>

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

export const WithCustomCopy: Story = {
  args: {
    title: "Need a hand?",
    helperText: "Type a keyword or browse the most common support paths.",
    searchPlaceholder: "Search guides, billing, setup, and integrations",
  },
}

export const SearchSubmitInteraction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("searchbox", { name: "Search help center" })
    await userEvent.type(input, "billing")
    await userEvent.keyboard("{Enter}")
    await expect(args.onSearchSubmit).toHaveBeenCalledWith("billing")
  },
}

export const EmptySubmitInteraction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("searchbox", { name: "Search help center" })
    await userEvent.click(input)
    await userEvent.keyboard("{Enter}")
    await expect(args.onSearchSubmit).toHaveBeenCalledWith("")
  },
}
