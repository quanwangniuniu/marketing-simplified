import api from '../api';
import type { TaskEngagementSummary } from '@/types/taskEngagement';

/**
 * Server-side task engagement summary (Track-01 / Ray-approved metrics).
 *
 *   GET /api/behavioral-tracking/tasks/{taskId}/engagement-summary/
 *
 * Response body: TaskEngagementSummary (owner-only; current user + task).
 */

/** Live summary API (behavioral_tracking engagement-summary). */
export const TASK_ENGAGEMENT_SUMMARY_USE_MOCK = false;

export const TASK_ENGAGEMENT_SUMMARY_PATH =
  '/api/behavioral-tracking/tasks';

export function engagementSummaryUrl(taskId: number): string {
  return `${TASK_ENGAGEMENT_SUMMARY_PATH}/${taskId}/engagement-summary/`;
}

/** Shared mock returned by getEngagementSummary while USE_MOCK is true. */
export const MOCK_TASK_ENGAGEMENT_SUMMARY: TaskEngagementSummary = {
  visits: 12,
  estimated_active_ms: 3_900_000,
  last_operated_at: '2026-05-17T14:30:00.000Z',
  write_operations_count: 8,
};

export const TaskEngagementAPI = {
  /**
   * Returns engagement summary for the current user on a task.
   * Uses mock data while TASK_ENGAGEMENT_SUMMARY_USE_MOCK is true.
   */
  getEngagementSummary: async (
    taskId: number,
  ): Promise<TaskEngagementSummary> => {
    if (TASK_ENGAGEMENT_SUMMARY_USE_MOCK) {
      void taskId;
      return MOCK_TASK_ENGAGEMENT_SUMMARY;
    }
    const response = await api.get<TaskEngagementSummary>(
      engagementSummaryUrl(taskId),
    );
    return response.data;
  },
};
