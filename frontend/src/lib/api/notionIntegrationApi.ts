import api from '../api';

export interface NotionIntegrationStatus {
  connected: boolean;
  workspace_id?: string | null;
  workspace_name?: string | null;
  workspace_icon?: string | null;
  bot_id?: string | null;
  bot_name?: string | null;
  connected_at?: string | null;
}

export interface NotionImportPayload {
  page: string;
  draft_id?: number | null;
}

export interface NotionImportResponse {
  source_page_id?: string | null;
  draft: {
    id: number;
    title: string;
    status?: string;
    content_blocks_count?: number;
    updated_at?: string;
  };
}

export interface NotionExportPayload {
  draft_id: number;
  parent_page_id: string;
  title?: string | null;
}

export interface NotionExportResponse {
  page_id: string;
  url: string;
}

export const notionIntegrationApi = {
  getStatus: async (): Promise<NotionIntegrationStatus> => {
    const response = await api.get('/api/notion/status/');
    return response.data;
  },

  connect: async (): Promise<{ auth_url: string; state: string }> => {
    const response = await api.get('/api/notion/connect/');
    return response.data;
  },

  disconnect: async (): Promise<{ success: boolean }> => {
    const response = await api.post('/api/notion/disconnect/');
    return response.data;
  },

  importPage: async (payload: NotionImportPayload): Promise<NotionImportResponse> => {
    const response = await api.post('/api/notion/import/', payload);
    return response.data;
  },

  exportDraft: async (payload: NotionExportPayload): Promise<NotionExportResponse> => {
    const response = await api.post('/api/notion/export/', payload);
    return response.data;
  },
};
