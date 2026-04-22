// SMP-472: Project Workspace Dashboard API client
import api from "../api";

// ── WorkspaceDashboard types (ProjectWorkspaceDashboardView) ────────────────

export interface WorkspaceDecision {
  id: number;
  title: string | null;
  status: string;
  risk_level: string | null;
  updated_at: string;
  has_unresolved_tasks: boolean;
}

export interface WorkspaceTask {
  id: number;
  summary: string;
  status: string;
  priority: string;
  type: string;
  due_date: string | null;
  updated_at: string;
  is_overdue: boolean;
  is_blocked: boolean;
  is_decision_linked: boolean;
  owner_initials?: string | null;
}

export interface WorkspaceSpreadsheet {
  id: number;
  name: string;
  updated_at: string;
  has_running_job: boolean;
}

export interface WorkspacePattern {
  id: string;
  name: string;
  description: string;
  version: number;
  updated_at: string;
  origin_spreadsheet_id: number | null;
}

export interface WorkspaceDashboardData {
  decisions: WorkspaceDecision[];
  tasks: WorkspaceTask[];
  spreadsheets: WorkspaceSpreadsheet[];
  patterns: WorkspacePattern[];
}

// ── DashboardSummary types (DashboardSummaryView) ───────────────────────────

export interface StatusBreakdownItem {
  status: string; // e.g. "TO_DO" | "IN_PROGRESS" | "DONE" | "RESEARCH" | "CANCELLED"
  display_name: string; // e.g. "Done"
  count: number;
  color: string; // hex color string from backend
}

export interface PriorityBreakdownItem {
  priority: string; // e.g. "HIGHEST" | "HIGH" | "MEDIUM" | "LOW" | "LOWEST"
  count: number;
}

export interface TypeBreakdownItem {
  type: string; // e.g. "budget" | "asset" | "retrospective" | "report" | "execution"
  display_name: string;
  count: number;
  percentage: number;
}

export interface TimeMetrics {
  completed_last_7_days: number;
  updated_last_7_days: number;
  created_last_7_days: number;
  due_soon: number; // tasks due within the next 7 days (not yet completed)
}

export interface StatusOverview {
  total_work_items: number;
  breakdown: StatusBreakdownItem[];
}

export interface DailyActivity {
  date: string; // "YYYY-MM-DD"
  created: number;
  completed: number;
}

export interface DashboardSummaryData {
  time_metrics: TimeMetrics;
  status_overview: StatusOverview;
  priority_breakdown: PriorityBreakdownItem[];
  types_of_work: TypeBreakdownItem[];
  /** Per-day created/completed counts. Length = days param (7 or 30), sorted chronologically. */
  daily_task_activity: DailyActivity[];
}

// ── API calls ────────────────────────────────────────────────────────────────

export const WorkspaceAPI = {
  /**
   * Fetch the project workspace zone data.
   * Returns decisions, tasks, spreadsheets, and patterns scoped to the project.
   * Requires project_id — returns 400 if missing or invalid.
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

  /**
   * Fetch aggregated dashboard summary metrics.
   * Returns status breakdown, priority breakdown, types of work, time metrics,
   * and per-day task activity for the trend chart.
   *
   * @param projectId  Scope metrics to this project.
   * @param days       Time window for daily_task_activity. 7 or 30. Default: 7.
   */
  getDashboardSummary: (
    projectId: number,
    days: 7 | 30 = 7,
  ): Promise<DashboardSummaryData> => {
    return api
      .get<DashboardSummaryData>("/api/dashboard/summary/", {
        params: { project_id: projectId, days },
      })
      .then((response: { data: DashboardSummaryData }) => response.data);
  },
};
