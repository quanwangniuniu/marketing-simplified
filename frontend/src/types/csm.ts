export type TierType = 'T1' | 'T2' | 'T3' | 'T4';

export const TIER_LABELS: Record<TierType, string> = {
  T1: 'T1 Frontline',
  T2: 'T2 Technical Support',
  T3: 'T3 Escalations',
  T4: 'T4 VIP',
};

export const TIER_COLORS: Record<TierType, string> = {
  T1: 'bg-blue-100 text-blue-800',
  T2: 'bg-yellow-100 text-yellow-800',
  T3: 'bg-orange-100 text-orange-800',
  T4: 'bg-purple-100 text-purple-800',
};

export interface Queue {
  id: number;
  slug: string;
  project: number | string;
  organisation: number | null;
  organisation_name: string | null;
  name: string;
  description: string;
  tier: TierType;
  tier_display: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CreateQueueData {
  project: number | string;
  name: string;
  description?: string;
  tier: TierType;
  organisation?: number | null;
}

export interface UpdateQueueData {
  name?: string;
  description?: string;
  tier?: TierType;
  organisation?: number | null;
  is_active?: boolean;
}

export interface QueueAgent {
  id: number;
  queue: number;
  user: number;
  user_email: string;
  user_name: string;
  assigned_by: number | null;
  created_at: string;
}

export interface QueueTeam {
  id: number;
  queue: number;
  team: number;
  team_name: string;
  created_at: string;
}

export interface QueueTicketCounts {
  todo: number;
  in_progress: number;
}

// ── CustomerUser ────────────────────────────────────────────────────────────

export type CustomerUserType = 'agent' | 'supervisor' | 'admin';

export const USER_TYPE_LABELS: Record<CustomerUserType, string> = {
  agent: 'Agent',
  supervisor: 'Supervisor',
  admin: 'Admin',
};

export const USER_TYPE_COLORS: Record<CustomerUserType, string> = {
  agent: 'bg-blue-50 text-blue-700',
  supervisor: 'bg-amber-50 text-amber-700',
  admin: 'bg-purple-50 text-purple-700',
};

export interface CustomerUser {
  id: number;
  user: number;
  user_email: string;
  user_name: string;
  team: number | null;
  team_name: string | null;
  queue: number | null;
  queue_name: string | null;
  organisation: number | null;
  organisation_name: string | null;
  user_type: CustomerUserType;
  user_type_display: string;
  is_active: boolean;
  created_at: string;
}

export interface CreateCustomerUserData {
  email: string;
  team?: number | null;
  queue?: number | null;
  organisation?: number | null;
  user_type: CustomerUserType;
}

export interface UpdateCustomerUserData {
  team?: number | null;
  queue?: number | null;
  organisation?: number | null;
  user_type?: CustomerUserType;
  is_active?: boolean;
}

// ── Ticket ──────────────────────────────────────────────────────────────────

export type TicketStatus = 'todo' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';

export const STATUS_LABELS: Record<TicketStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const STATUS_COLORS: Record<TicketStatus, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-50 text-blue-700',
  resolved: 'bg-green-50 text-green-700',
  closed: 'bg-gray-50 text-gray-500',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  critical: 'bg-red-50 text-red-700',
  high: 'bg-orange-50 text-orange-700',
  medium: 'bg-blue-50 text-blue-700',
  low: 'bg-gray-100 text-gray-600',
};

// ── SLA ─────────────────────────────────────────────────────────────────────

export interface SlaStatus {
  first_response_due: string | null;
  resolution_due: string | null;
  first_response_breached: boolean;
  resolution_breached: boolean;
  first_response_met: boolean;
  clock_running: boolean;
  first_response_remaining_seconds: number | null;
  resolution_remaining_seconds: number | null;
}

export interface SLAPriorityTarget {
  id: number;
  priority: TicketPriority;
  first_response_minutes: number;
  resolution_minutes: number;
}

export interface SLAPolicy {
  id: number;
  project: number;
  name: string;
  is_active: boolean;
  is_default: boolean;
  calendar: number | null;
  pause_on_pending: boolean;
  priority_targets: SLAPriorityTarget[];
  created_at: string;
  updated_at: string;
}

export interface UpdateSLAPolicyData {
  name?: string;
  is_active?: boolean;
  calendar?: number | null;
  pause_on_pending?: boolean;
  priority_targets?: Array<{
    priority: TicketPriority;
    first_response_minutes: number;
    resolution_minutes: number;
  }>;
}

export type Weekday =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday';

export interface DaySchedule {
  enabled: boolean;
  start?: string; // 'HH:MM'
  end?: string;   // 'HH:MM'
}

export type WeekSchedule = Record<Weekday, DaySchedule>;

export interface BusinessHoursCalendar {
  id: number;
  project: number;
  name: string;
  timezone: string;
  schedule: WeekSchedule;
  created_at: string;
  updated_at: string;
}

export interface SaveBusinessHoursCalendarData {
  name: string;
  timezone: string;
  schedule: WeekSchedule;
}

export interface Ticket {
  id: number;
  queue: number;
  queue_name: string;
  title: string;
  description: string;
  status: TicketStatus;
  status_display: string;
  priority: TicketPriority;
  priority_display: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  customer_email: string;
  tags: string[];
  created_at: string;
  first_response_due: string | null;
  resolution_due: string | null;
  sla: SlaStatus;
}

export interface CreateTicketData {
  queue: number;
  title: string;
  description?: string;
  priority?: TicketPriority;
  assigned_to?: number | null;
  customer_email?: string;
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assigned_to?: number | null;
  customer_email?: string;
}

// ── Invitation ──────────────────────────────────────────────────────────────

export interface CSMInvitation {
  id: number;
  email: string;
  project: number | string;
  team: number | null;
  invited_by: number | null;
  token: string;
  expires_at: string;
  accepted: boolean;
  accepted_at: string | null;
  is_expired: boolean;
  created_at: string;
}

export interface CreateInvitationData {
  email: string;
  project: number | string;
  team?: number | null;
}

// ── Notification ─────────────────────────────────────────────────────────────

export type NotificationActionStatus = 'pending' | 'accepted' | 'declined';

export interface CsmNotification {
  id: number;
  recipient: number;
  sender: number | null;
  sender_email: string | null;
  sender_name: string | null;
  notification_type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  action_status: NotificationActionStatus;
  organisation: number | null;
  organisation_name: string | null;
  created_at: string;
}

export interface InviteUserData {
  organisation: number;
  user_id: number;
  user_type: CustomerUserType;
  message?: string;
}
