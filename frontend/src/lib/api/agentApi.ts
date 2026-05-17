import api from '../api';
import {
  AgentSession,
  AgentSessionDetail,
  CreateSessionRequest,
  UpdateSessionRequest,
  AgentChatRequest,
  AgentSpreadsheet,
  SSEEvent,
  AgentWorkflowDefinition,
  AgentWorkflowStep,
  AgentWorkflowRun,
} from '@/types/agent';

/** Build auth headers for SSE fetch requests (mirrors Axios interceptor logic). */
function getSSEAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const authStorage = typeof window !== 'undefined'
    ? localStorage.getItem('auth-storage')
    : null;
  if (authStorage) {
    try {
      const parsed = JSON.parse(authStorage);
      const token = parsed.state?.token;
      const orgToken = parsed.state?.organizationAccessToken;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (orgToken) headers['X-Organization-Token'] = orgToken;
    } catch {
      // ignore parse errors
    }
  }
  return headers;
}

export const AgentAPI = {
  // ==================== Session CRUD ====================

  listSessions: async (params?: { search?: string }): Promise<AgentSession[]> => {
    const response = await api.get('/api/agent/sessions/', {
      params: params?.search?.trim() ? { search: params.search.trim() } : undefined,
    });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results || []);
  },

  createSession: async (data: CreateSessionRequest): Promise<AgentSession> => {
    const response = await api.post<AgentSession>('/api/agent/sessions/', data);
    return response.data;
  },

  getSession: async (sessionId: string | number): Promise<AgentSessionDetail> => {
    const response = await api.get<AgentSessionDetail>(
      `/api/agent/sessions/${sessionId}/`
    );
    return response.data;
  },

  updateSession: async (sessionId: string | number, data: UpdateSessionRequest): Promise<AgentSession> => {
    const response = await api.patch<AgentSession>(
      `/api/agent/sessions/${sessionId}/`,
      data
    );
    return response.data;
  },

  deleteSession: async (sessionId: string | number): Promise<void> => {
    await api.delete(`/api/agent/sessions/${sessionId}/`);
  },

  // ==================== Chat (SSE Streaming) ====================

  sendMessage: (
    sessionId: number | string,
    data: AgentChatRequest,
    onEvent: (event: SSEEvent) => void,
    onError?: (error: Error) => void,
    onDone?: () => void
  ): AbortController => {
    const controller = new AbortController();

    const headers: Record<string, string> = {
      ...getSSEAuthHeaders(),
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    };

    // Determine base URL (match axios instance config)
    const baseURL =
      (typeof process !== 'undefined' &&
        process.env?.NEXT_PUBLIC_API_URL?.trim()) ||
      '';

    fetch(`${baseURL}/api/agent/sessions/${sessionId}/chat/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          let errMessage: string;
          if (response.status === 504) {
            errMessage = 'Request timed out. Please try again.';
          } else if (response.status >= 500) {
            errMessage = 'Server error. Please try again.';
          } else {
            const errText = await response.text().catch(() => '');
            try {
              const errJson = JSON.parse(errText);
              errMessage = errJson.detail || `Request failed (${response.status})`;
            } catch {
              errMessage = `Request failed (${response.status})`;
            }
          }
          throw new Error(errMessage);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue; // skip empty/comment

            if (trimmed.startsWith('data: ')) {
              const jsonStr = trimmed.slice(6);
              try {
                const event: SSEEvent = JSON.parse(jsonStr);
                onEvent(event);
                if (event.type === 'done') {
                  onDone?.();
                  return;
                }
              } catch {
                // skip malformed JSON
              }
            }
          }
        }

        // Stream ended without 'done' event
        onDone?.();
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        onError?.(err);
      });

    return controller;
  },

  // ==================== Spreadsheet List ====================

  listSpreadsheets: async (): Promise<AgentSpreadsheet[]> => {
    const response = await api.get<AgentSpreadsheet[]>(
      '/api/agent/spreadsheets/'
    );
    return response.data;
  },

  // ==================== Data Reports (CSV) ====================

  fetchReports: async () => {
    const response = await api.get('/api/agent/data/reports/');
    return response.data;
  },

  fetchReportData: async (fileId: string) => {
    const response = await api.get(`/api/agent/data/reports/${fileId}/`);
    return response.data;
  },

  /**
   * Upload a file and stream back analysis results via SSE.
   * Returns an AbortController to cancel the request.
   */
  uploadAndAnalyze: (
    file: File,
    sessionId: string | null,
    onEvent: (event: SSEEvent) => void,
    onError?: (error: Error) => void,
    onDone?: () => void
  ): AbortController => {
    const controller = new AbortController();

    const headers: Record<string, string> = {
      ...getSSEAuthHeaders(),
      'Accept': 'text/event-stream',
    };

    const formData = new FormData();
    formData.append('file', file);
    if (sessionId) formData.append('session_id', sessionId);

    const baseURL =
      (typeof process !== 'undefined' &&
        process.env?.NEXT_PUBLIC_API_URL?.trim()) ||
      '';

    fetch(`${baseURL}/api/agent/upload-analyze/`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          let errMessage: string;
          if (response.status === 504) {
            errMessage = 'Request timed out. Please try again.';
          } else if (response.status >= 500) {
            errMessage = 'Server error. Please try again.';
          } else {
            const errText = await response.text().catch(() => '');
            try {
              const errJson = JSON.parse(errText);
              errMessage = errJson.detail || `Upload failed (${response.status})`;
            } catch {
              errMessage = `Upload failed (${response.status})`;
            }
          }
          throw new Error(errMessage);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;

            if (trimmed.startsWith('data: ')) {
              const jsonStr = trimmed.slice(6);
              try {
                const event: SSEEvent = JSON.parse(jsonStr);
                onEvent(event);
                if (event.type === 'done') {
                  onDone?.();
                  return;
                }
              } catch {
                // skip malformed JSON
              }
            }
          }
        }

        onDone?.();
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        onError?.(err);
      });

    return controller;
  },

  fetchReportsSummary: async () => {
    const response = await api.get('/api/agent/data/reports/summary/');
    return response.data;
  },

  deleteReport: async (fileId: string): Promise<void> => {
    await api.delete(`/api/agent/data/reports/${fileId}/`);
  },

  fetchLatestAnomalies: async () => {
    const response = await api.get('/api/agent/anomalies/latest/');
    return response.data;
  },

  getConfigStatus: async (): Promise<{
    dify_api: boolean;
    dify_chat: boolean;
    dify_calendar: boolean;
    dify_miro: boolean;
    anthropic: boolean;
  }> => {
    const response = await api.get('/api/agent/config/status/');
    return response.data;
  },

  // ==================== Workflows ====================

  listWorkflows: async (): Promise<AgentWorkflowDefinition[]> => {
    const response = await api.get('/api/agent/workflows/');
    const data = response.data;
    return Array.isArray(data) ? data : (data.results || []);
  },

  getWorkflow: async (workflowId: string): Promise<AgentWorkflowDefinition> => {
    const response = await api.get<AgentWorkflowDefinition>(
      `/api/agent/workflows/${workflowId}/`
    );
    return response.data;
  },

  createWorkflow: async (data: {
    name: string;
    description?: string;
    status?: string;
  }): Promise<AgentWorkflowDefinition> => {
    const response = await api.post<AgentWorkflowDefinition>(
      '/api/agent/workflows/',
      data
    );
    return response.data;
  },

  updateWorkflow: async (
    workflowId: string,
    data: Partial<{ name: string; description: string; status: string; is_default: boolean }>
  ): Promise<AgentWorkflowDefinition> => {
    const response = await api.patch<AgentWorkflowDefinition>(
      `/api/agent/workflows/${workflowId}/`,
      data
    );
    return response.data;
  },

  deleteWorkflow: async (workflowId: string): Promise<void> => {
    await api.delete(`/api/agent/workflows/${workflowId}/`);
  },

  listSteps: async (workflowId: string): Promise<AgentWorkflowStep[]> => {
    const response = await api.get<AgentWorkflowStep[]>(
      `/api/agent/workflows/${workflowId}/steps/`
    );
    return response.data;
  },

  createStep: async (
    workflowId: string,
    data: { name: string; step_type: string; order?: number; config?: Record<string, unknown>; description?: string }
  ): Promise<AgentWorkflowStep> => {
    const response = await api.post<AgentWorkflowStep>(
      `/api/agent/workflows/${workflowId}/steps/`,
      data
    );
    return response.data;
  },

  deleteStep: async (workflowId: string, stepId: string): Promise<void> => {
    await api.delete(`/api/agent/workflows/${workflowId}/steps/?step_id=${stepId}`);
  },

  reorderSteps: async (
    workflowId: string,
    stepIds: string[]
  ): Promise<AgentWorkflowStep[]> => {
    const response = await api.post<AgentWorkflowStep[]>(
      `/api/agent/workflows/${workflowId}/steps/reorder/`,
      { step_ids: stepIds }
    );
    return response.data;
  },

  getWorkflowRun: async (runId: string): Promise<AgentWorkflowRun> => {
    const response = await api.get<AgentWorkflowRun>(
      `/api/agent/workflow-runs/${runId}/`
    );
    return response.data;
  },
};
