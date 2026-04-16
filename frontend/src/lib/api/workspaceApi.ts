// SMP-472: Project Workspace Dashboard API client
import api from "../api";

// ── Type definitions ────────────────────────────────────────────────────────

export interface WorkspaceDecision {
  id: number;
  title: string | null;
  status: string;
  risk_level: string | null;
  updated_at: string;
  has_unresolved_tasks: boolean; // True if decision has linked tasks not yet completed
}

export interface WorkspaceTask {
  id: number;
  summary: string;
  status: string;
  priority: string;
  type: string;
  due_date: string | null;
  updated_at: string;
  is_overdue: boolean; // True when due date is past and task is not in terminal status
  is_blocked: boolean; // True if another task is blocking this one
  is_decision_linked: boolean; // True if this task is linked to a Decision
  owner_initials?: string | null; // Responsible person's initials (e.g. "TU")
}

export interface WorkspaceSpreadsheet {
  id: number;
  name: string;
  updated_at: string;
  has_running_job: boolean; // True if a PatternJob is queued or running
}

export interface WorkspacePattern {
  id: string;
  name: string;
  description: string;
  version: number;
  updated_at: string;
  /** Spreadsheet where the pattern was created; used to link to `/projects/:id/spreadsheets/:spreadsheetId`. */
  origin_spreadsheet_id: number | null;
}

export interface WorkspaceDashboardData {
  decisions: WorkspaceDecision[];
  tasks: WorkspaceTask[];
  spreadsheets: WorkspaceSpreadsheet[];
  patterns: WorkspacePattern[];
}

// ── API call ────────────────────────────────────────────────────────────────

export const WorkspaceAPI = {
  /**
   * Fetch the project workspace dashboard summary.
   * Returns decisions, tasks, spreadsheets, and patterns scoped to the given project.
   * Requires project_id query param — returns 400 if missing or invalid.
   */
  getWorkspaceDashboard: (
    projectId: number,
  ): Promise<WorkspaceDashboardData> => {
    return api
      .get<WorkspaceDashboardData>("/api/dashboard/workspace/", {
        params: { project_id: projectId },
      })
      .then((response: { data: WorkspaceDashboardData }) => response.data);
  },
};
