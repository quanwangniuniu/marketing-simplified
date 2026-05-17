export interface TourStep {
  type: "modal" | "spotlight"
  target?: string // data-tour attribute selector
  title: string
  description: string
}

export const tourSteps: TourStep[] = [
  {
    type: "modal",
    title: "Welcome to AI Agent",
    description: "Your AI-powered campaign analysis workspace. Upload data, get insights, and make smarter decisions — all in one place.",
  },
  {
    type: "spotlight",
    target: "tour-nav",
    title: "Navigate Your Workspace",
    description: "Switch between Overview, Spreadsheets, and Tasks to manage different aspects of your campaigns.",
  },
  {
    type: "spotlight",
    target: "tour-main-content",
    title: "Overview Dashboard",
    description: "Real-time KPI metrics, performance charts, and campaign rankings — your command center at a glance.",
  },
  {
    type: "spotlight",
    target: "tour-chat",
    title: "AI Chat Assistant",
    description: "Upload CSV/Excel files or ask questions — the AI analyzes your data and recommends actions automatically.",
  },
  {
    type: "spotlight",
    target: "tour-right-panel",
    title: "Alerts Panel",
    description: "Track anomalies from analysis results so nothing slips through.",
  },
  {
    type: "modal",
    title: "You're All Set!",
    description: "Explore your workspace and let AI do the heavy lifting. You can restart this tour anytime from Settings.",
  },
]
