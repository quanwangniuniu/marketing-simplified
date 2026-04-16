import api from "../api";

export interface GoogleDocsStatus {
  connected: boolean;
  google_email?: string | null;
}

export interface GoogleDocListItem {
  id: string;
  name: string;
  modified_time?: string | null;
  web_view_link?: string | null;
}

export const googleDocsApi = {
  getStatus: async (): Promise<GoogleDocsStatus> => {
    const response = await api.get("/api/google-docs/status/");
    return response.data;
  },

  connect: async (): Promise<{ auth_url: string; state: string }> => {
    const response = await api.get("/api/google-docs/connect/");
    return response.data;
  },

  disconnect: async (): Promise<{ success: boolean }> => {
    const response = await api.post("/api/google-docs/disconnect/");
    return response.data;
  },

  importDocument: async (documentId: string, decisionId?: number) => {
    const response = await api.post("/api/google-docs/import/", {
      document_id: documentId,
      decision_id: decisionId,
    });
    return response.data;
  },

  listDocuments: async (pageSize: number = 20): Promise<GoogleDocListItem[]> => {
    const response = await api.get("/api/google-docs/documents/", {
      params: { pageSize },
    });
    const data = response.data;
    return Array.isArray(data?.items) ? data.items : [];
  },

  exportDecision: async (decisionId: number, title?: string) => {
    const response = await api.post("/api/google-docs/export/", {
      decision_id: decisionId,
      title,
    });
    return response.data as { document_id: string; url: string };
  },

  exportRawContent: async (title: string, content: string) => {
    const response = await api.post("/api/google-docs/export/raw/", {
      title,
      content,
    });
    return response.data as { document_id: string; url: string };
  },

  importFromGoogleSheets: async (sheetUrl: string) => {
    const response = await api.post("/api/google-docs/sheets/import/", {
      sheet_url: sheetUrl,
    });
    return response.data as { title: string; matrix: string[][] };
  },

  exportToGoogleSheets: async (title: string, matrix: string[][]) => {
    const response = await api.post("/api/google-docs/sheets/export/", {
      title,
      matrix,
    });
    return response.data as { spreadsheet_id: string; url: string };
  },
};
