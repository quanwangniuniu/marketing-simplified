import type { OriginMeetingPayload } from '@/types/meeting';

/** Task provenance when created from a meeting action item (SMP-489). */
export interface OriginActionItemPayload {
  id: number;
  title: string;
  meeting_id: number;
  project_id?: number | string;
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

export interface TaskTag {
  name: string;
  color: string;
}

// Type for getting an existing task
export interface TaskData {
  id?: number;
  /** URL-friendly identifier; present on all API responses. */
  slug?: string;
  owner?: UserSummary;
  owner_id?: number | null; // Write-only for updates
  created_by?: UserSummary | null;
  project_id: number | string; // Required for creation
  /** Task type; valid values come from GET /api/task-types/ */
  type: string;
  summary: string;
  description?: string;
  current_approver?: UserSummary; // For display (from API response)
  current_approver_id?: number | null;
  start_date?: string | null; // Date field
  due_date?: string; // Date field
  content_type?: string;
  object_id?: string;
  /** Slug of the linked object (e.g. decision slug) for slug-based navigation */
  linked_object_slug?: string | null;
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
  parent_relationship?: TaskParentRelationshipEntry[] | null;
  order_in_project?: number; // Order of task within its project
  approval_chain_progress?: ApprovalChainProgress | null;
  can_lock?: boolean;
  approvals_summary?: {
    approved_count: number;
    required_count: number;
    display: string;
  } | null;
  /** True when the current user has pinned this task. */
  is_pinned?: boolean;
  /** Draft-only: persisted create-panel state (backend stores JSON) */
  draft_payload?: unknown | null;
  /** Provenance: meeting this task is anchored to, if any (task detail only). */
  origin_meeting?: OriginMeetingPayload | null;
  /** Provenance: action item this task was converted from, if any (task detail only). */
  origin_action_item?: OriginActionItemPayload | null;
  /** Frontend-owned colored tags `{ name, color }`; PATCH/create sends full replacement array */
  tags?: TaskTag[];
  /** Set when this task was imported from Linear. */
  linear_issue_id?: string | null;
  /** ISO datetime of creation (auto-set by server). */
  created_at?: string;
  /** ISO datetime of the last modification (auto-set by server). */
  updated_at?: string;
}

export interface TaskParentRelationshipEntry {
  parent_task_id: number | string;
  parent_task_slug?: string;
  parent_task_summary?: string;
}

/** Resolve current parent task id from API ``parent_relationship`` payload. */
export function getTaskParentId(
  task: Pick<TaskData, 'parent_relationship'>,
): number | null {
  const rel = task.parent_relationship;
  if (!rel || !Array.isArray(rel) || rel.length === 0) {
    return null;
  }
  const id = rel[0]?.parent_task_id;
  if (typeof id === 'number' && Number.isFinite(id)) {
    return id;
  }
  if (typeof id === 'string' && id.trim() !== '') {
    const parsed = Number(id);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Resolve parent slug for slug-only task detail URLs (never use numeric id in path). */
export function getTaskParentSlug(
  task: Pick<TaskData, 'parent_relationship'>,
): string | null {
  const rel = task.parent_relationship;
  const slug = rel?.[0]?.parent_task_slug;
  return typeof slug === 'string' && slug.trim() !== '' ? slug : null;
}

/** Resolve parent summary for immediate picker display. */
export function getTaskParentSummary(
  task: Pick<TaskData, 'parent_relationship'>,
): string | null {
  const rel = task.parent_relationship;
  const summary = rel?.[0]?.parent_task_summary;
  return typeof summary === 'string' && summary.trim() !== '' ? summary : null;
}

// Type for creating a new task (current_approver_id is user ID)
export interface CreateTaskData {
  project_id: number | string;
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
  origin_meeting_id?: number | string;
  /** Stored on task JSON field (omit to leave empty). */
  tags?: TaskTag[];
}

export interface UserSummary {
  id: number;
  username: string;
  email: string;
  avatar?: string | null;
  name?: string;
}

/** Returns the best available display name for any user-like object. */
export function userDisplayName(u: { name?: string; username?: string; email?: string; id?: number }): string {
  return u.name || u.username || u.email || (u.id != null ? `User #${u.id}` : 'Unknown');
}

export interface ProjectSummary {
  id: number;
  slug?: string;
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
  target_task_id: number | string;
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
  project_id?: number | string;
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
  tag_names?: string[];
  search?: string;
  page_size?: number;
}

/** GET /api/tasks/gantt/ — chart payload derived server-side from tasks + dates */
export interface GanttLegendItem {
  band: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
  label: string;
}

export interface GanttRow {
  id: number;
  slug?: string;
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

// ── Task Intelligence ────────────────────────────────────────────────────────

export interface IntelligenceTaskStub {
  id: number;
  slug?: string;
  summary: string;
  status: string;
  priority: string | null;
  type: string;
  due_date: string | null;
  project_id: number | string;
  owner: { id: number; username: string } | null;
  current_approver: { id: number; username: string } | null;
  updated_at: string | null;
}

export interface IntelligenceSignal {
  count: number;
  tasks: IntelligenceTaskStub[];
}

export interface IntelligenceActivityEntry {
  task_id: number;
  task_summary: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface IntelligenceVelocityPoint {
  week: string;
  count: number;
}

export interface IntelligenceRisk {
  score: number;
  level: 'low' | 'medium' | 'high';
  signals: { type: string; count: number }[];
}

export interface IntelligenceProgress {
  total: number;
  todo: number;
  in_progress: number;
  done: number;
  by_status: Record<string, number>;
  completion_pct: number;
}

export interface TaskIntelligencePayload {
  overdue: IntelligenceSignal & { };
  due_soon: IntelligenceSignal & { days_window: number };
  blocked: IntelligenceSignal;
  high_priority: IntelligenceSignal;
  awaiting_approval: IntelligenceSignal;
  stalled: IntelligenceSignal & { stall_days: number };
  progress: IntelligenceProgress;
  recent_activity: IntelligenceActivityEntry[];
  velocity: IntelligenceVelocityPoint[];
  risk: IntelligenceRisk;
}

// ── Work Cycle History ───────────────────────────────────────────────────────

export interface WorkCycleTaskStub {
  id: number;
  slug?: string;
  summary: string;
  status: string;
  priority: string | null;
  type: string;
  due_date: string | null;
  project_id: number | string;
}

export interface WorkCycleFieldEntry {
  task_id: number;
  task_slug?: string | null;
  task_summary: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface WorkCycleHistoryPayload {
  date_from: string;
  date_to: string;
  added: WorkCycleTaskStub[];
  completed: WorkCycleTaskStub[];
  field_changes: {
    status: WorkCycleFieldEntry[];
    owner: WorkCycleFieldEntry[];
    priority: WorkCycleFieldEntry[];
    due_date: WorkCycleFieldEntry[];
  };
}

// ── My Actions ───────────────────────────────────────────────────────────────

export interface MyActionsTaskStub {
  id: number;
  slug?: string;
  summary: string;
  status: string;
  priority: string | null;
  type: string;
  due_date: string | null;
  project_id: number | string;
  owner: { id: number; username: string } | null;
  current_approver: { id: number; username: string } | null;
  updated_at: string | null;
}

export interface MyActionsPayload {
  assigned_to_me: MyActionsTaskStub[];
  awaiting_my_approval: MyActionsTaskStub[];
  approved_pending_lock: MyActionsTaskStub[];
  overdue_i_own: MyActionsTaskStub[];
  due_soon_i_own: MyActionsTaskStub[];
  blocked_i_own: MyActionsTaskStub[];
  high_priority_i_own: MyActionsTaskStub[];
  comment_followups: MyActionsTaskStub[];
}
