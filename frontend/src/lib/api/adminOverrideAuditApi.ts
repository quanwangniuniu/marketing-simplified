/**
 * Admin Override Audit API Client
 *
 * Fetches AdminOverrideAudit entries from the backend, with optional
 * filtering and pagination. Restricted server-side to superusers and
 * org admins (403 for everyone else).
 */

import api from '../api';
import type {
  OverrideAuditFilters,
  OverrideAuditResponse,
} from '@/types/adminOverrideAudit';

const URL = '/api/access_control/admin-override-audits/';

/**
 * Fetch a page of override audit entries with optional filters.
 *
 * @example
 * const response = await fetchOverrideAudits(
 *   { override_type: 'SUPERUSER', from: '2026-07-01T00:00:00Z' },
 *   1,
 *   50
 * );
 */
export async function fetchOverrideAudits(
  filters?: OverrideAuditFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<OverrideAuditResponse> {
  const params: Record<string, any> = {
    page,
    page_size: pageSize,
  };

  if (filters?.user_id) {
    params.user_id = filters.user_id;
  }
  if (filters?.override_type) {
    params.override_type = filters.override_type;
  }
  if (filters?.module) {
    params.module = filters.module;
  }
  if (filters?.from) {
    params.from = filters.from;
  }
  if (filters?.to) {
    params.to = filters.to;
  }

  const response = await api.get<OverrideAuditResponse>(URL, { params });
  return response.data;
}

const adminOverrideAuditApi = {
  fetchOverrideAudits,
};

export default adminOverrideAuditApi;
