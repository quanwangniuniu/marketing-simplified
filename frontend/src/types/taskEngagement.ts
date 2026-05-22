/**
 * Server-side task engagement summary (contract draft for syz alignment).
 *
 * Live path (see taskEngagementApi.ts):
 *   GET /api/behavioral-tracking/tasks/{taskId}/engagement-summary/
 */

export interface TaskEngagementSummary {
  visits: number;
  estimated_active_ms: number;
  last_operated_at: string | null;
  write_operations_count: number;
}
