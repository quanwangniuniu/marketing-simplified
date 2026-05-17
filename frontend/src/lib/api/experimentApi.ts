import api from "../api";

export interface Experiment {
  id: number;
  name: string;
  hypothesis: string;
  expected_outcome?: string | null;
  description?: string | null;
  control_group?: {
    campaigns?: string[];
    ad_set_ids?: string[];
    ad_ids?: string[];
  } | null;
  variant_group?: {
    campaigns?: string[];
    ad_set_ids?: string[];
    ad_ids?: string[];
  } | null;
  success_metric?: string | null;
  constraints?: string | null;
  start_date?: string | null; // Computed from Task.start_date
  end_date?: string | null; // Computed from Task.due_date
  started_at?: string | null;
  status: "draft" | "running" | "paused" | "completed" | "cancelled";
  experiment_outcome?: "win" | "lose" | "inconclusive" | null;
  outcome_notes?: string | null;
  task?: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  progress_updates?: ExperimentProgressUpdate[];
}

export interface ExperimentCreateRequest {
  task: number;
  name: string;
  hypothesis: string;
  expected_outcome?: string;
  description?: string;
  control_group?: {
    campaigns?: string[];
    ad_set_ids?: string[];
    ad_ids?: string[];
  };
  variant_group?: {
    campaigns?: string[];
    ad_set_ids?: string[];
    ad_ids?: string[];
  };
  success_metric?: string;
  constraints?: string;
  status?: "draft" | "running" | "paused" | "completed" | "cancelled";
}

export interface ExperimentUpdateRequest {
  name?: string;
  hypothesis?: string;
  expected_outcome?: string | null;
  description?: string | null;
  control_group?: {
    campaigns?: string[];
    ad_set_ids?: string[];
    ad_ids?: string[];
  } | null;
  variant_group?: {
    campaigns?: string[];
    ad_set_ids?: string[];
    ad_ids?: string[];
  } | null;
  success_metric?: string | null;
  constraints?: string | null;
  status?: "draft" | "running" | "paused" | "completed" | "cancelled";
  experiment_outcome?: "win" | "lose" | "inconclusive" | null;
  outcome_notes?: string | null;
}

export interface ExperimentProgressUpdate {
  id: number;
  experiment: number;
  update_date: string;
  notes: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ExperimentProgressUpdateCreateRequest {
  notes: string;
}

export const ExperimentAPI = {
  // Experiment APIs
  listExperiments: (params?: {
    status?: string;
    start_before?: string;
    end_after?: string;
    created_by?: number;
  }) => api.get<Experiment[]>("/api/experiment/experiments/", { params }),

  createExperiment: (data: ExperimentCreateRequest) =>
    api.post<Experiment>("/api/experiment/experiments/", data),

  getExperiment: (id: number) =>
    api.get<Experiment>(`/api/experiment/experiments/${id}/`),

  updateExperiment: (id: string | number, data: ExperimentUpdateRequest) =>
    api.patch<Experiment>(`/api/experiment/experiments/${id}/`, data),

  // Progress update APIs
  listProgressUpdates: (
    experimentId: number,
    params?: { start_date?: string; end_date?: string }
  ) =>
    api.get<ExperimentProgressUpdate[]>(
      `/api/experiment/experiments/${experimentId}/progress-updates/`,
      { params }
    ),

  createProgressUpdate: (
    experimentId: number,
    data: ExperimentProgressUpdateCreateRequest
  ) =>
    api.post<ExperimentProgressUpdate>(
      `/api/experiment/experiments/${experimentId}/progress-updates/`,
      data
    ),
};

