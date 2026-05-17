import api from '../api';

export interface PlatformPolicyUpdateData {
  id?: number;
  // Read-only nested objects (returned by API)
  task?: { id: number; summary: string; status: string; type: string };
  created_by?: { id: number; username: string; email: string };
  assigned_to?: { id: number; username: string; email: string } | null;
  reviewed_by?: { id: number; username: string; email: string } | null;
  // Write-only ID fields (for creation/update)
  task_id?: number | null;
  assigned_to_id?: number | null;
  reviewed_by_id?: number | null;
  // Platform & Policy Info
  platform: string;
  policy_change_type: string;
  policy_description: string;
  policy_reference_url?: string | null;
  effective_date?: string | null;
  // Affected Scope
  affected_campaigns?: string[];
  affected_ad_sets?: string[];
  affected_assets?: string[];
  // Impact Assessment
  performance_impact?: string;
  budget_impact?: string;
  compliance_risk?: string;
  // Immediate Actions
  immediate_actions_required: string;
  action_deadline?: string | null;
  // Mitigation Tracking
  mitigation_status?: string;
  mitigation_plan?: string;
  mitigation_steps?: {
    step: string;
    status: string;
    assigned_to?: number | null;
    completed_at?: string | null;
  }[];
  mitigation_execution_notes?: string;
  mitigation_completed_at?: string | null;
  mitigation_results?: string;
  // Post-Mitigation Review
  post_mitigation_review?: string;
  review_completed_at?: string | null;
  all_impacts_addressed?: boolean;
  lessons_learned?: string;
  // Notes & References
  notes?: string;
  related_references?: string[];
  // Metadata
  created_at?: string;
  updated_at?: string;
}

export interface PolicyChoicesResponse {
  platforms: { value: string; label: string }[];
  policy_change_types: { value: string; label: string }[];
}

export const PolicyAPI = {

  // List platform policy updates with optional filters
  list: (params?: {
    platform?: string;
    mitigation_status?: string;
    policy_change_type?: string;
    assigned_to_id?: number;
    task_id?: number;
  }) => api.get('/api/policy/platform-policy-updates/', { params }),

  // Create a new platform policy update
  create: (data: Partial<PlatformPolicyUpdateData>) =>
    api.post('/api/policy/platform-policy-updates/', data),

  // Get a specific platform policy update
  get: (id: number) =>
    api.get(`/api/policy/platform-policy-updates/${id}/`),

  // Partially update a platform policy update
  update: (id: string | number, data: Partial<PlatformPolicyUpdateData>) =>
    api.patch(`/api/policy/platform-policy-updates/${id}/`, data),

  // Delete a platform policy update
  delete: (id: number) =>
    api.delete(`/api/policy/platform-policy-updates/${id}/`),

  // Mark mitigation as completed
  markMitigationCompleted: (id: number) =>
    api.post(`/api/policy/platform-policy-updates/${id}/mark-mitigation-completed/`),

  // Mark post-mitigation review as completed
  markReviewed: (id: number) =>
    api.post(`/api/policy/platform-policy-updates/${id}/mark-reviewed/`),

  getChoices: () => api.get("/api/platform-policy-updates/choices/"),
};
