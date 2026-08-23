/**
 * Audit Log API Client
 *
 * Provides functions to fetch audit log data from the backend API
 * with support for filtering and pagination.
 */

import api from '../api';
import type {
  AuditLogFilters,
  AuditLogResponse,
  AdminAuditEventFilters,
  PaginatedAdminAuditEvents,
} from '@/types/audit';

const BASE = '/api/projects';

/**
 * Fetch audit log entries for a specific meeting with optional filtering and pagination.
 *
 * @param projectId - The project ID
 * @param meetingId - The meeting ID
 * @param filters - Optional filter parameters (event_type, actor_id, date range)
 * @param page - Current page number (default: 1)
 * @param pageSize - Number of entries per page (default: 50)
 * @returns Paginated audit log response
 *
 * @example
 * // Fetch all entries for a meeting
 * const response = await fetchAuditLog(123, 456);
 *
 * @example
 * // Fetch with filters and pagination
 * const response = await fetchAuditLog(
 *   123,
 *   456,
 *   {
 *     event_type: ['meeting.status_changed', 'meeting.title_changed'],
 *     actor_id: 789,
 *     from: '2026-05-01T00:00:00Z',
 *     to: '2026-05-31T23:59:59Z'
 *   },
 *   2,
 *   25
 * );
 */
export async function fetchAuditLog(
  projectId: number | string,
  meetingId: number,
  filters?: AuditLogFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<AuditLogResponse> {
  const url = `${BASE}/${projectId}/meetings/${meetingId}/audit-log/`;

  // Build query parameters
  const params: Record<string, any> = {
    page,
    page_size: pageSize,
  };

  // Add filters to params
  if (filters?.event_type && filters.event_type.length > 0) {
    params.event_type = filters.event_type;
  }

  if (filters?.actor_id) {
    params.actor_id = filters.actor_id;
  }

  if (filters?.from) {
    params.from = filters.from;
  }

  if (filters?.to) {
    params.to = filters.to;
  }

  try {
    const response = await api.get<AuditLogResponse>(url, { params });
    return response.data;
  } catch (error) {
    // Let axios error handling (interceptors) take care of 401/403/500
    // but provide a more specific error message for this context
    if (error instanceof Error) {
      throw new Error(`Failed to fetch audit log: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Convenience function to fetch audit log for the first page
 */
export async function fetchAuditLogFirstPage(
  projectId: number | string,
  meetingId: number,
  filters?: AuditLogFilters,
  pageSize: number = 50
): Promise<AuditLogResponse> {
  return fetchAuditLog(projectId, meetingId, filters, 1, pageSize);
}

/**
 * Convenience function to fetch audit log for a specific page
 */
export async function fetchAuditLogPage(
  projectId: number | string,
  meetingId: number,
  page: number,
  filters?: AuditLogFilters,
  pageSize: number = 50
): Promise<AuditLogResponse> {
  return fetchAuditLog(projectId, meetingId, filters, page, pageSize);
}

// Export all functions as a single API object (optional alternative style)
const auditLogApi = {
  fetchAuditLog,
  fetchAuditLogFirstPage,
  fetchAuditLogPage,
};

export default auditLogApi;

/**
 * Fetch paginated admin audit events.
 * Supports optional filtering by action and target_type.
 */
export const AdminAuditLogAPI = {
  list: (filters?: AdminAuditEventFilters) =>
    api.get<PaginatedAdminAuditEvents>('/api/audit/events/', { params: filters }),
};
