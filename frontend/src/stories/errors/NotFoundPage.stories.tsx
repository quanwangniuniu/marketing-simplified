import type { Meta, StoryObj } from "@storybook/react";
import { within, expect } from "@storybook/test";

import NotFoundPage from "@/app/not-found";

const meta: Meta<typeof NotFoundPage> = {
  title: "Pages/NotFound",
  component: NotFoundPage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Simple 404 page with shared home header/footer, marketing screenshot, and a primary recovery CTA.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        onClickCapture={(event) => {
          const target = event.target as HTMLElement | null;
          const clickable = target?.closest?.("a, button");
          if (clickable) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof NotFoundPage>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("One does not simply walk into a 404...."),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("link", { name: "TRY MARKETING SIMPLIFIED" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("Get Started Today!"),
    ).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};
