import type { OriginMeetingPayload } from '@/types/meeting';

/** Task provenance when created from a meeting action item (SMP-489). */
export interface OriginActionItemPayload {
  id: number;
  title: string;
  meeting_id: number;
  project_id?: number;
  detail_url?: string;
  url?: string;
}

export interface ApprovalChainStepRecord {
  approved_by: UserSummary;
  is_approved: boolean;
  decided_time: string;
  comment: string | null;
}

export interface ApprovalChainStepData {
  step_number: number;
  role_name: string;
  status: 'approved' | 'current' | 'pending';
  approver: UserSummary;
  record: ApprovalChainStepRecord | null;
}

export interface ApprovalChainProgress {
  current_step: number;
  total_steps: number;
  step_display: string;
  chain_name: string;
  next_approver: UserSummary | null;
  steps: ApprovalChainStepData[];
}

// Type for getting an existing task
export interface TaskData {
  id?: number;
  owner?: UserSummary;
  owner_id?: number | null; // Write-only for updates
  project_id: number; // Required for creation
  /** Task type; valid values come from GET /api/task-types/ */
  type: string;
  summary: string;
  description?: string;
  current_approver?: UserSummary; // For display (from API response)
  current_approver_id?: number;
  start_date?: string | null; // Date field
  due_date?: string; // Date field
  content_type?: string;
  object_id?: string;
  project?: ProjectSummary;
  status?:
    | "DRAFT"
    | "SUBMITTED"
    | "UNDER_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "LOCKED"
    | "CANCELLED";
  priority?: string;
  planned_start_date?: string | null;
  linked_object?: unknown;
  is_subtask?: boolean;
  subtask_count?: number;
  parent_relationship?: any; // Parent relationship if this is a subtask
  order_in_project?: number; // Order of task within its project
  approval_chain_progress?: ApprovalChainProgress | null;
  can_lock?: boolean;
  approvals_summary?: {
    approved_count: number;
    required_count: number;
    display: string;
  } | null;
  /** Draft-only: persisted create-panel state (backend stores JSON) */
  draft_payload?: unknown | null;
  /** Provenance: meeting this task is anchored to, if any (task detail only). */
  origin_meeting?: OriginMeetingPayload | null;
  /** Provenance: action item this task was converted from, if any (task detail only). */
  origin_action_item?: OriginActionItemPayload | null;
  /** Set when this task was imported from Linear. */
  linear_issue_id?: string | null;
}

// Type for creating a new task (current_approver_id is user ID)
export interface CreateTaskData {
  project_id: number;
  /** Task type; valid values come from GET /api/task-types/ */
  type: string;
  summary: string;
  description?: string;
  priority?: string;
  current_approver_id?: number; // User ID for creation
  start_date?: string | null; // Date field
  due_date?: string;
  /** If true, task stays in DRAFT and draft_payload is persisted. */
  create_as_draft?: boolean;
  /** Draft-only: persisted create-panel state (backend stores JSON) */
  draft_payload?: unknown | null;
  /** When set, creates ``MeetingTaskOrigin`` on the server (same project as task). */
  origin_meeting_id?: number;
}

export interface UserSummary {
  id: number;
  username: string;
  email: string;
  name?: string;
}

/** Returns the best available display name for any user-like object. */
export function userDisplayName(u: { name?: string; username?: string; email?: string; id?: number }): string {
  return u.name || u.username || u.email || (u.id != null ? `User #${u.id}` : 'Unknown');
}

export interface ProjectSummary {
  id: number;
  name: string;
}

export interface TaskApprovalData {
  action: "approve" | "reject";
  comment?: string;
}

export interface TaskForwardData {
  next_approver_id: number;
  comment?: string;
}

export interface TaskLinkData {
  content_type: string;
  object_id: string;
}

// Represents a single task-level comment returned by the backend
export interface TaskComment {
  id: number;
  task: number;
  user: UserSummary;
  body: string;
  created_at: string;
  parent: number | null;
  is_clarification: boolean;
  response_time_secs: number | null;
  replies: TaskComment[];
}

// Task relation types
export interface TaskRelationItem {
  relation_id: number;
  task: TaskData;
}

export interface TaskRelationsResponse {
  causes: TaskRelationItem[];
  is_caused_by: TaskRelationItem[];
  blocks: TaskRelationItem[];
  is_blocked_by: TaskRelationItem[];
  clones: TaskRelationItem[];
  is_cloned_by: TaskRelationItem[];
  relates_to: TaskRelationItem[];
}

export interface TaskRelationAddRequest {
  target_task_id: number;
  relationship_type: 'causes' | 'blocks' | 'clones' | 'relates_to';
}

// Represents a single task-level attachment returned by the backend
export interface TaskAttachment {
  id: number;
  task: number;
  file: string; // URL to the file
  original_filename: string;
  file_size: number;
  content_type: string;
  checksum: string;
  scan_status: 'pending' | 'scanning' | 'clean' | 'infected' | 'error_scanning';
  uploaded_by: UserSummary;
  created_at: string;
}

// Shared filter shape for task list/board/timeline views
export interface TaskListFilters {
  project_id?: number;
  type?: string | string[];
  status?: string | string[];
  priority?: string | string[];
  owner_id?: number | number[];
  current_approver_id?: number | number[];
  has_parent?: boolean;
  has_subtasks?: boolean;
  due_date_after?: string; // YYYY-MM-DD
  due_date_before?: string;
  created_after?: string;
  created_before?: string;
  include_subtasks?: boolean;
  all_projects?: boolean;
}

/** GET /api/tasks/gantt/ — chart payload derived server-side from tasks + dates */
export interface GanttLegendItem {
  band: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
  label: string;
}

export interface GanttRow {
  id: number;
  display_key: string;
  summary: string;
  status_label: string;
  priority?: string;
  band: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
  owner_initials: string;
  owner_color_index: number;
  bar_start: string;
  bar_end: string;
  duration_days: number;
}

export interface GanttChartPayload {
  sprint_label: string;
  task_count: number;
  today: string;
  range: { start: string; end: string };
  legend: GanttLegendItem[];
  rows: GanttRow[];
}

export interface TaskBulkUpdateRequest {
  task_ids: number[];
  status?: TaskData['status'];
  due_date?: string | null;
  owner_id?: number | null;
  current_approver_id?: number | null;
  priority?: string;
  start_date?: string | null;
  planned_start_date?: string | null;
}

export interface TaskBulkFailureItem {
  task_id: number | null;
  reason: string;
}

export interface TaskBulkActionResult {
  requested_count: number;
  succeeded_count: number;
  failed_count: number;
  updated_count: number;
  succeeded: number[];
  failed: TaskBulkFailureItem[];
  atomic: boolean;
  applied_fields: string[];
}

export interface TaskBulkActionResponse {
  detail: string;
  result: TaskBulkActionResult;
}

export interface TaskFieldHistoryEntry {
  id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_name: string | null;
  changed_by_avatar: string | null;
  changed_at: string;
}

export type TaskCollaborationMetrics = {
  comment_response: {
    reply_count: number;
    responses_with_timing: number;
    average_response_time_secs: number | null;
    max_response_time_secs: number | null;
  };
  discussion_threads: {
    total_comments: number;
    root_comment_count: number;
    reply_count: number;
    threads_with_replies: number;
    max_thread_depth: number;
    average_thread_depth: number;
    max_thread_size: number;
    average_thread_size: number;
  };
  clarifications: {
    request_count: number;
  };
  mentions: {
    reviewer_ping_count: number;
    cross_team_mention_count: number;
  };
  approval_delays: {
    completed_approval_count: number;
    average_delay_secs: number | null;
    max_delay_secs: number | null;
  };
  shared_access: {
    access_count: number;
    unique_accessor_count: number;
  };
  documentation_revisits: {
    revisit_count: number;
    unique_document_count: number;
  };
  internal_searches: {
    search_count: number;
    unique_query_count: number;
  };
  ai_help_requests: {
    request_count: number;
    unique_trigger_count: number;
  };
  snippet_interactions: {
    interaction_count: number;
    unique_snippet_count: number;
  };
};