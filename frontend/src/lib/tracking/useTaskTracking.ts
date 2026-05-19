'use client';

// TASK_OPEN and FIRST_INTERACTION are now detected server-side by ServerSideTrackingMiddleware.
// Hook shell kept for call-site compatibility.
export function useTaskTracking(_taskId: number, _projectId?: number | null) {
  return {
    markInteraction: (_element: string, _action: string): void => {},
  };
}
