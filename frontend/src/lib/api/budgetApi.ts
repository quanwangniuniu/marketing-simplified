import api from "../api";

/** Path prefix matches `backend/budget_approval/urls.py` included at `api/budgets/`. */
// const POOLS = "/api/task/budget-pools/"; // legacy (404 — no matching Django route)
// const TASKS = "/api/task/budget-tasks/";
const POOLS = "/api/budgets/pools/";
const TASKS = "/api/budgets/requests/";

function listResults<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "results" in data) {
    const r = (data as { results?: T[] }).results;
    return Array.isArray(r) ? r : [];
  }
  return [];
}

// --- Types (aligned with `BudgetTaskDetailSerializer`, `BudgetPoolSerializer`, transitions) ---

export interface UserSummary {
  id: number;
  username: string;
  email?: string | null;
}

export interface TaskSummary {
  id: number;
  type: string;
  status: string;
  summary: string;
  description?: string | null;
  project_id: number;
}

export interface BudgetTaskCapabilities {
  edit: boolean;
  submit: boolean;
  approve: boolean;
  reject: boolean;
  activate: boolean;
  complete: boolean;
  cancel: boolean;
}

/** Nested pool on budget task (summary serializer). */
export interface BudgetPoolSummary {
  id: number;
  project_id: number;
  name: string;
  code?: string | null;
  currency: string;
  total_amount: string;
  reserved_amount: string;
  finalized_amount: string;
  available_amount: string;
  allow_over_allocation: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Full pool from `BudgetPoolSerializer` (retrieve / create / snapshot). */
export interface BudgetPoolData {
  id: number;
  project: number;
  name: string;
  code?: string | null;
  ad_channel?: number | null;
  currency: string;
  total_amount: string;
  reserved_amount: string;
  finalized_amount: string;
  available_amount: string;
  /** Legacy field kept for compatibility with older UI components. */
  used_amount?: string;
  allow_over_allocation: boolean;
  is_active: boolean;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetTaskDetail {
  id: number;
  task: TaskSummary;
  status: string;
  budget_pool: BudgetPoolSummary;
  owner: UserSummary;
  current_approver: UserSummary | null;
  source: string;
  currency: string;
  requested_amount: string;
  approved_amount: string | null;
  spent_amount: string | null;
  purpose_type: string;
  purpose_ref?: string | null;
  purpose_text?: string | null;
  approval_comment?: string | null;
  rejection_reason?: string | null;
  cancel_reason?: string | null;
  can: BudgetTaskCapabilities;
  submitted_at?: string | null;
  approved_at?: string | null;
  activated_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  rejected_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Legacy compatibility shape consumed by pre-redesign task components. */
export type BudgetRequestData = BudgetTaskDetail & {
  budget_pool_id?: number | null;
  budget_pool?: number | BudgetPoolSummary | null;
  amount?: string;
  ad_channel?: string | number | null;
  ad_channel_detail?: { name?: string | null } | null;
  is_escalated?: boolean;
  notes?: string | null;
};

export interface BudgetTaskCreateRequest {
  project_id: number;
  summary: string;
  description?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  budget_pool_id: number;
  current_approver_id?: number | null;
  currency: string;
  requested_amount: string;
  purpose_type: "campaign" | "initiative" | "other";
  purpose_ref?: string | null;
  purpose_text?: string | null;
  source?: string;
}

export interface BudgetTaskPatchRequest {
  summary?: string;
  description?: string | null;
  current_approver_id?: number | null;
  requested_amount?: string;
  purpose_type?: "campaign" | "initiative" | "other";
  purpose_ref?: string | null;
  purpose_text?: string | null;
}

export interface BudgetTransitionResponse {
  budget_task: BudgetTaskDetail;
  budget_pool_snapshot: BudgetPoolData;
  event: Record<string, unknown> | null;
}

export interface CreateBudgetPoolPayload {
  project: number;
  name: string;
  code?: string | null;
  currency: string;
  total_amount: string;
  ad_channel?: number | null;
  allow_over_allocation?: boolean;
  is_active?: boolean;
}

/** @deprecated Use CreateBudgetPoolPayload; kept for existing forms. */
export type CreateBudgetPoolData = CreateBudgetPoolPayload;

export interface ApproveBudgetPayload {
  approved_amount: string;
  currency: string;
  comment?: string;
}

export interface RejectBudgetPayload {
  reason: string;
  comment?: string;
}

/** Legacy decision payload used by older hooks/components. */
export interface ApprovalDecisionData {
  action?: "approve" | "reject";
  approved_amount?: string;
  currency?: string;
  reason?: string;
  comment?: string;
}

export interface FinalizeBudgetPayload {
  spent_amount: string;
  currency: string;
  comment?: string;
}

export interface CancelBudgetPayload {
  currency: string;
  spent_amount?: string;
  reason?: string;
  comment?: string;
}

export interface CommentPayload {
  comment?: string;
}

export const BudgetAPI = {
  // --- Budget pools ---
  getBudgetPools: (params?: {
    project_id?: number;
    currency?: string;
    is_active?: boolean;
  }) => api.get(POOLS, { params }),

  /** Normalized list (handles paginated `results` or plain array). */
  async listBudgetPools(
    params?: {
      project_id?: number;
      currency?: string;
      is_active?: boolean;
    },
  ): Promise<BudgetPoolData[]> {
    const { data } = await api.get(POOLS, { params });
    return listResults<BudgetPoolData>(data);
  },

  createBudgetPool: (data: CreateBudgetPoolPayload) =>
    api.post(POOLS, data),

  getBudgetPool: (id: number) => api.get(`${POOLS}${id}/`),

  updateBudgetPool: (id: number, data: Partial<CreateBudgetPoolPayload>) =>
    api.patch(`${POOLS}${id}/`, data),

  deleteBudgetPool: (id: number) => api.delete(`${POOLS}${id}/`),

  // --- Budget tasks (task id == budget task pk) ---
  getBudgetTasks: (params?: {
    project_id?: number;
    status?: string;
    owner_id?: number;
    current_approver_id?: number;
    budget_pool_id?: number;
  }) => api.get(TASKS, { params }),

  // --- Legacy aliases kept for compatibility with pre-redesign UI ---
  getBudgetRequests: (params?: {
    project_id?: number;
    status?: string;
    owner_id?: number;
    current_approver_id?: number;
    budget_pool_id?: number;
  }) => api.get(TASKS, { params }),

  createBudgetTask: (data: BudgetTaskCreateRequest) =>
    api.post(TASKS, data),

  createBudgetRequest: (data: BudgetTaskCreateRequest | BudgetRequestData | Record<string, unknown>) =>
    api.post(TASKS, data),

  getBudgetTask: (taskId: number) => api.get(`${TASKS}${taskId}/`),

  getBudgetRequest: (taskId: number) => api.get(`${TASKS}${taskId}/`),

  patchBudgetTask: (taskId: number, data: BudgetTaskPatchRequest) =>
    api.patch(`${TASKS}${taskId}/`, data),

  updateBudgetRequest: (taskId: number, data: BudgetTaskPatchRequest | Partial<BudgetRequestData> | Record<string, unknown>) =>
    api.patch(`${TASKS}${taskId}/`, data),

  deleteBudgetRequest: (taskId: number) => api.delete(`${TASKS}${taskId}/`),

  submitBudgetTask: (taskId: number, body?: CommentPayload) =>
    api.post(`${TASKS}${taskId}/submit/`, body ?? {}),

  startBudgetReview: (taskId: number, body?: CommentPayload) =>
    api.post(`${TASKS}${taskId}/start-review/`, body ?? {}),

  startReview: (taskId: number, body?: CommentPayload) =>
    api.post(`${TASKS}${taskId}/start-review/`, body ?? {}),

  approveBudgetTask: (taskId: number, body: ApproveBudgetPayload) =>
    api.post(`${TASKS}${taskId}/approve/`, body),

  rejectBudgetTask: (taskId: number, body: RejectBudgetPayload) =>
    api.post(`${TASKS}${taskId}/reject/`, body),

  makeDecision: (taskId: number, body: ApprovalDecisionData) => {
    if (body.action === "reject") {
      const payload: Record<string, unknown> = {};
      if (body.reason !== undefined) payload.reason = body.reason;
      if (body.comment !== undefined) payload.comment = body.comment;
      return api.post(`${TASKS}${taskId}/reject/`, {
        ...payload,
      });
    }
    const payload: Record<string, unknown> = {};
    if (body.approved_amount !== undefined) payload.approved_amount = body.approved_amount;
    if (body.currency !== undefined) payload.currency = body.currency;
    if (body.comment !== undefined) payload.comment = body.comment;
    return api.post(`${TASKS}${taskId}/approve/`, {
      ...payload,
    });
  },

  activateBudgetTask: (taskId: number, body?: CommentPayload) =>
    api.post(`${TASKS}${taskId}/activate/`, body ?? {}),

  completeBudgetTask: (taskId: number, body: FinalizeBudgetPayload) =>
    api.post(`${TASKS}${taskId}/complete/`, body),

  cancelBudgetTask: (taskId: number, body: CancelBudgetPayload) =>
    api.post(`${TASKS}${taskId}/cancel/`, body),

  getBudgetTaskEvents: (taskId: number) =>
    api.get(`${TASKS}${taskId}/events/`),
};
