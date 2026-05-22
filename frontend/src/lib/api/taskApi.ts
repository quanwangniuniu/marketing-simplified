import api from "../api";
import {
  TaskData,
  CreateTaskData,
  TaskApprovalData,
  TaskForwardData,
  TaskLinkData,
  TaskComment,
  TaskRelationsResponse,
  TaskRelationAddRequest,
  TaskAttachment,
  TaskListFilters,
  TaskBulkUpdateRequest,
  TaskBulkActionResponse,
  GanttChartPayload,
  TaskCollaborationMetrics,
} from "@/types/task";

export type MentionUser = {
  id: number;
  username?: string | null;
  email?: string | null;
  name?: string | null;
  team_id?: number | null;
  team_name?: string | null;
  team?: {
    id?: number | null;
    name?: string | null;
  } | null;
};

export const TaskAPI = {
  // Get available task types
  getTaskTypes: async (): Promise<{ value: string; label: string }[]> => {
    const response = await api.get('/api/task-types/');
    const list = response.data?.task_types;
    return Array.isArray(list) ? list : [];
  },

  // Force create a new task
  forceCreateTask: (data: CreateTaskData) =>
    api.post("/api/tasks/force-create/", data),

  // Get all tasks with optional filters
  getTasks: (params?: TaskListFilters & { content_type?: string; object_id?: string; page?: number }) => {
    const queryParams: any = { ...params };
    if (queryParams.include_subtasks !== undefined) {
      queryParams.include_subtasks = queryParams.include_subtasks.toString();
    }
    if (queryParams.all_projects !== undefined) {
      queryParams.all_projects = queryParams.all_projects.toString();
    }
    if (queryParams.has_parent !== undefined) {
      queryParams.has_parent = queryParams.has_parent.toString();
    }
    return api.get("/api/tasks/", { params: queryParams });
  },

  getTasksGantt: async (params?: { project_id?: number }): Promise<GanttChartPayload> => {
    const response = await api.get("/api/tasks/gantt/", { params });
    return response.data as GanttChartPayload;
  },

  // Get a specific task by ID
  getTask: (taskId: number) => api.get(`/api/tasks/${taskId}/`),

    // Get collaboration and knowledge metrics for a task
  getCollaborationMetrics: async (
    taskId: number
  ): Promise<TaskCollaborationMetrics> => {
    const response = await api.get(`/api/tasks/${taskId}/collaboration-metrics/`);
    return response.data as TaskCollaborationMetrics;
  },
  
  // Update a task
  updateTask: (taskId: number, data: Partial<TaskData>) =>
    api.patch(`/api/tasks/${taskId}/`, data),

  bulkAction: async (
    payload: TaskBulkUpdateRequest
  ): Promise<TaskBulkActionResponse> => {
    const response = await api.post('/api/tasks/bulk_action/', payload);
    return response.data as TaskBulkActionResponse;
  },

  // Create a new task
  createTask: (data: CreateTaskData) => api.post("/api/tasks/", data),

  // Link task to a task type object
  linkTask: (taskId: number, contentType: string, objectId: string) =>
    api.post(`/api/tasks/${taskId}/link/`, {
      content_type: contentType,
      object_id: objectId,
    }),

  // Submit a task (DRAFT -> SUBMITTED)
  submitTask: (taskId: number) =>
    api.post(`/api/tasks/${taskId}/submit/`),

  // Start review for a task
  startReview: (taskId: number) =>
    api.post(`/api/tasks/${taskId}/start-review/`),

  // Revise a task
  revise: (taskId: number) => api.post(`/api/tasks/${taskId}/revise/`),

  // Make approval decision (approve or reject)
  makeApproval: (taskId: number, data: TaskApprovalData) =>
    api.post(`/api/tasks/${taskId}/make-approval/`, data),

  // Lock a task
  lock: (taskId: number) => api.post(`/api/tasks/${taskId}/lock/`),

  // Unlock a task (LOCKED -> APPROVED)
  unlock: (taskId: number) => api.post(`/api/tasks/${taskId}/unlock/`),

  // Cancel a task
  cancelTask: (taskId: number) =>
    api.post(`/api/tasks/${taskId}/cancel/`),

  // Forward task to next approver
  forward: (taskId: number, data: TaskForwardData) =>
    api.post(`/api/tasks/${taskId}/forward/`, data),

  // Get approval history
  getApprovalHistory: (taskId: number) =>
    api.get(`/api/tasks/${taskId}/approval-history/`),

  getComments: async (taskId: number): Promise<TaskComment[]> => {
    const response = await api.get(`/api/tasks/${taskId}/comments/`);
    const data: any = response.data;
    if (Array.isArray(data)) {
      return data as TaskComment[];
    }
    return (data.results || []) as TaskComment[];
  },

  getMentionUsers: async (
    taskId: number,
    query = ''
  ): Promise<MentionUser[]> => {
    const response = await api.get(`/api/tasks/${taskId}/mention-users/`, {
      params: { q: query },
    });

    const data: any = response.data;

    if (Array.isArray(data)) {
      return data as MentionUser[];
    }

    return (data.results || []) as MentionUser[];
  },

  createComment: async (
    taskId: number,
    data: { body: string; mentions?: number[]; is_clarification?: boolean }
  ): Promise<TaskComment> => {
    const response = await api.post(`/api/tasks/${taskId}/comments/`, data);
    return response.data as TaskComment;
  },

  createReply: async (
    taskId: number,
    data: { body: string; parent: number; mentions?: number[]; is_clarification?: boolean }
  ): Promise<TaskComment> => {
    const response = await api.post(`/api/tasks/${taskId}/comments/`, data);
    return response.data as TaskComment;
  },

  // Delete a task
  deleteTask: (taskId: number) => api.delete(`/api/tasks/${taskId}/`),

  // Field history
  getFieldHistory: (taskId: number, page = 1, pageSize = 20) =>
    api.get(`/api/tasks/${taskId}/field-history/`, { params: { page, page_size: pageSize } }),

  // Get all relations for a task
  getRelations: async (taskId: number): Promise<TaskRelationsResponse> => {
    const response = await api.get(`/api/tasks/${taskId}/relations/`);
    return response.data as TaskRelationsResponse;
  },

  // Add a relation to a task
  addRelation: async (
    taskId: number,
    data: TaskRelationAddRequest
  ): Promise<any> => {
    const response = await api.post(`/api/tasks/${taskId}/relations/`, data);
    return response.data;
  },

  // Delete a relation
  deleteRelation: (taskId: number, relationId: number) =>
    api.delete(`/api/tasks/${taskId}/relations/${relationId}/`),

  // Get all subtasks of a task
  getSubtasks: async (taskId: number): Promise<TaskData[]> => {
    const response = await api.get(`/api/tasks/${taskId}/subtasks/`);
    const data: any = response.data;
    if (Array.isArray(data)) {
      return data as TaskData[];
    }
    return (data.results || []) as TaskData[];
  },

  // Add a subtask to a parent task
  addSubtask: async (
    parentTaskId: number,
    childTaskId: number
  ): Promise<TaskData> => {
    const response = await api.post(`/api/tasks/${parentTaskId}/subtasks/`, {
      child_task_id: childTaskId,
    });
    return response.data as TaskData;
  },

  // Delete a subtask relationship
  deleteSubtask: (parentTaskId: number, subtaskId: number) =>
    api.delete(`/api/tasks/${parentTaskId}/subtasks/${subtaskId}/`),

  // Get all attachments for a task
  getAttachments: async (taskId: number): Promise<TaskAttachment[]> => {
    const response = await api.get(`/api/tasks/${taskId}/attachments/`);
    const data: any = response.data;
    if (Array.isArray(data)) {
      return data as TaskAttachment[];
    }
    return (data.results || []) as TaskAttachment[];
  },

  // Create a new attachment for a task
  createAttachment: async (
    taskId: number,
    file: File
  ): Promise<TaskAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/api/tasks/${taskId}/attachments/`, formData);
    return response.data as TaskAttachment;
  },

  // Delete an attachment
  deleteAttachment: async (
    taskId: number,
    attachmentId: number
  ): Promise<void> => {
    await api.delete(`/api/tasks/${taskId}/attachments/${attachmentId}/`);
  },

  // Download an attachment (get download URL)
  downloadAttachment: async (
    taskId: number,
    attachmentId: number
  ): Promise<any> => {
    const response = await api.get(
      `/api/tasks/${taskId}/attachments/${attachmentId}/download/`
    );
    return response.data;
  },


  moveSubtask: (newParentId: number, subtaskId: number, data: { old_parent_id: number }) =>
    api.post(`/api/tasks/${newParentId}/subtasks/${subtaskId}/move/`, data),

  getAutosave: async (type: string): Promise<Record<string, unknown> | null> => {
    const response = await api.get('/api/task-form-autosave/', { params: { type } });
    return response.status === 204 ? null : (response.data as Record<string, unknown>);
  },

  putAutosave: async (type: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const response = await api.put('/api/task-form-autosave/', payload, { params: { type } });
    return response.data as Record<string, unknown>;
  },

  deleteAutosave: async (type: string): Promise<void> => {
    await api.delete('/api/task-form-autosave/', { params: { type } });
  },
};
