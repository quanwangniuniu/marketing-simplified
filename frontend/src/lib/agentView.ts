export const AGENT_VIEW_COOKIE_NAME = "agent-active-view";

export const AGENT_VIEWS = [
  "overview",
  "spreadsheets",
  "decisions",
  "tasks",
  "workflows",
  "settings",
] as const;

export type AgentView = (typeof AGENT_VIEWS)[number];

export function normalizeAgentView(value: string | null | undefined): AgentView {
  if (value && AGENT_VIEWS.includes(value as AgentView)) {
    return value as AgentView;
  }

  return "overview";
}
