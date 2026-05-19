export interface TrackingConfig {
  idle_seconds: number;
  heartbeat_seconds: number;
  session_timeout_seconds: number;
  event_flush_seconds: number;
}

export interface EngagementData {
  task_id: number;
  open_count: number;
  first_interaction_at: string | null;
  last_open_at: string | null;
  total_active_seconds: number;
}
