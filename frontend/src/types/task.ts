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
  linked_object?: unknown;
  is_subtask?: boolean; // Indicates if this task is a subtask
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
  has_parent?: boolean; // true = subtasks only, false = top-level only
  due_date_after?: string; // YYYY-MM-DD
  due_date_before?: string;
  created_after?: string;
  created_before?: string;
  include_subtasks?: boolean;
  all_projects?: boolean;
}
