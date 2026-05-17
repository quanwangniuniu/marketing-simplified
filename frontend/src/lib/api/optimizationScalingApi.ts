import api from "../api";

export interface ScalingPlan {
  id: number;
  task: number;
  strategy: "horizontal" | "vertical" | "hybrid";
  scaling_target?: string;
  risk_considerations?: string;
  max_scaling_limit?: string;
  stop_conditions?: string;
  affected_entities?: any[] | null;
  expected_outcomes?: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  started_at?: string | null;
  completed_at?: string | null;
  review_summary?: string;
  review_lessons_learned?: string;
  review_future_actions?: string;
  review_completed_at?: string | null;
  created_at: string;
  updated_at: string;
  steps?: ScalingStep[];
}

export interface ScalingPlanCreateRequest {
  task: number;
  strategy: "horizontal" | "vertical" | "hybrid";
  scaling_target?: string;
  risk_considerations?: string;
  max_scaling_limit?: string;
  stop_conditions?: string;
  affected_entities?: any[] | null;
  expected_outcomes?: string;
}

export interface ScalingPlanUpdateRequest {
  strategy?: "horizontal" | "vertical" | "hybrid";
  scaling_target?: string;
  risk_considerations?: string;
  max_scaling_limit?: string;
  stop_conditions?: string;
  affected_entities?: any[] | null;
  expected_outcomes?: string;
  status?: "planned" | "in_progress" | "completed" | "cancelled";
  started_at?: string | null;
  completed_at?: string | null;
  review_summary?: string;
  review_lessons_learned?: string;
  review_future_actions?: string;
  review_completed_at?: string | null;
}

export interface ScalingStep {
  id: number;
  plan: number;
  step_order: number;
  name?: string;
  planned_change?: string;
  expected_metrics?: Record<string, any> | null;
  actual_metrics?: Record<string, any> | null;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  scheduled_at?: string | null;
  executed_at?: string | null;
  notes?: string;
  stop_triggered: boolean;
  related_scaling_action?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ScalingStepCreateRequest {
  step_order: number;
  name?: string;
  planned_change?: string;
  expected_metrics?: Record<string, any> | null;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  scheduled_at?: string | null;
  notes?: string;
  related_scaling_action?: number | null;
}

export interface ScalingStepUpdateRequest {
  step_order?: number;
  name?: string;
  planned_change?: string;
  expected_metrics?: Record<string, any> | null;
  actual_metrics?: Record<string, any> | null;
  status?: "planned" | "in_progress" | "completed" | "cancelled";
  scheduled_at?: string | null;
  executed_at?: string | null;
  notes?: string;
  stop_triggered?: boolean;
  related_scaling_action?: number | null;
}

export const OptimizationScalingAPI = {
  // Scaling plan APIs
  listScalingPlans: (params?: { task_id?: number }) =>
    api.get<ScalingPlan[]>("/api/optimization/scaling-plans/", { params }),

  createScalingPlan: (data: ScalingPlanCreateRequest) =>
    api.post<ScalingPlan>("/api/optimization/scaling-plans/", data),

  getScalingPlan: (id: number) =>
    api.get<ScalingPlan>(`/api/optimization/scaling-plans/${id}/`),

  updateScalingPlan: (id: string | number, data: ScalingPlanUpdateRequest) =>
    api.patch<ScalingPlan>(`/api/optimization/scaling-plans/${id}/`, data),

  // Scaling step APIs
  listScalingSteps: (planId: number) =>
    api.get<ScalingStep[]>(`/api/optimization/scaling-plans/${planId}/steps/`),

  createScalingStep: (planId: number, data: ScalingStepCreateRequest) =>
    api.post<ScalingStep>(`/api/optimization/scaling-plans/${planId}/steps/`, data),

  getScalingStep: (id: number) =>
    api.get<ScalingStep>(`/api/optimization/scaling-steps/${id}/`),

  updateScalingStep: (id: number, data: ScalingStepUpdateRequest) =>
    api.patch<ScalingStep>(`/api/optimization/scaling-steps/${id}/`, data),

  deleteScalingStep: (id: number) =>
    api.delete(`/api/optimization/scaling-steps/${id}/`),
};
