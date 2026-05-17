import api from "../api";
import type {
  ReportTask,
  ReportTaskCreateRequest,
  ReportTaskUpdateRequest,
  ReportTaskKeyAction,
  ReportKeyActionCreateRequest,
  ReportKeyActionUpdateRequest,
} from "@/types/report";

const BASE = "/api/report/reports";

export const ReportAPI = {
  listReports: (params?: { task?: number }) =>
    api.get<ReportTask[]>(`${BASE}/`, { params }),

  createReport: (data: ReportTaskCreateRequest) =>
    api.post<ReportTask>(`${BASE}/`, data),

  getReport: (id: number) => api.get<ReportTask>(`${BASE}/${id}/`),

  updateReport: (id: string | number, data: ReportTaskUpdateRequest) =>
    api.patch<ReportTask>(`${BASE}/${id}/`, data),

  listKeyActions: (reportId: number) =>
    api.get<ReportTaskKeyAction[]>(`${BASE}/${reportId}/key-actions/`),

  createKeyAction: (reportId: number, data: ReportKeyActionCreateRequest) =>
    api.post<ReportTaskKeyAction>(`${BASE}/${reportId}/key-actions/`, data),

  getKeyAction: (reportId: number, actionId: number) =>
    api.get<ReportTaskKeyAction>(
      `${BASE}/${reportId}/key-actions/${actionId}/`
    ),

  updateKeyAction: (
    reportId: number,
    actionId: number,
    data: ReportKeyActionUpdateRequest
  ) =>
    api.patch<ReportTaskKeyAction>(
      `${BASE}/${reportId}/key-actions/${actionId}/`,
      data
    ),

  deleteKeyAction: (reportId: number, actionId: number) =>
    api.delete<void>(`${BASE}/${reportId}/key-actions/${actionId}/`),
};

export default ReportAPI;
