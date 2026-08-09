/**
 * Admin Override Audit Types
 *
 * Matches the backend AdminOverrideAudit model and serializer
 * (backend/access_control/models.py, backend/access_control/serializers.py).
 * Records every superuser/org-admin bypass of the module permission check
 * enforced by AuthorizationMiddleware.
 */

export type OverrideType = 'SUPERUSER' | 'ORG_ADMIN';

/**
 * Single override audit entry, as returned by the list endpoint.
 */
export interface OverrideAuditEntry {
  id: number;
  user_id: number;
  username: string;
  organization_id: number | null;
  override_type: OverrideType;
  module: string | null;
  action: string | null;
  method: string;
  path: string;
  reason: string;
  ip_address: string | null;
  created_at: string; // ISO 8601 datetime
}

/**
 * Filter parameters for override audit queries.
 * All fields are optional and combined with AND logic.
 */
export interface OverrideAuditFilters {
  user_id?: number;
  override_type?: OverrideType;
  module?: string;
  from?: string; // ISO 8601 datetime
  to?: string; // ISO 8601 datetime
}

/**
 * Paginated API response, matching Django REST Framework's default
 * PageNumberPagination shape.
 */
export interface OverrideAuditResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: OverrideAuditEntry[];
}
