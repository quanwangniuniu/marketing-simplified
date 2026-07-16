export type ChannelType = 'live_chat' | 'contact_form' | 'email';
export type OfflineAlternative = 'message_only' | 'contact_form' | 'knowledge_base';

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface DayHours {
  enabled: boolean;
  start?: string;
  end?: string;
}

export type OperatingHours = Record<Weekday, DayHours>;

const weekdayHours = (): DayHours => ({ enabled: true, start: '09:00', end: '17:00' });
const disabledDay = (): DayHours => ({ enabled: false });

export const DEFAULT_OPERATING_HOURS: OperatingHours = {
  monday: weekdayHours(),
  tuesday: weekdayHours(),
  wednesday: weekdayHours(),
  thursday: weekdayHours(),
  friday: weekdayHours(),
  saturday: disabledDay(),
  sunday: disabledDay(),
};

export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  live_chat: 'Live chat',
  contact_form: 'Contact form',
  email: 'Email',
};

export const OFFLINE_ALTERNATIVE_LABELS: Record<OfflineAlternative, string> = {
  message_only: 'Message only',
  contact_form: 'Contact form',
  knowledge_base: 'Knowledge base',
};

export interface ExperienceGroupStub {
  id: number;
  name: string;
}

export interface SupportChannelListItem {
  id: number;
  display_name: string;
  channel_type: ChannelType;
  is_active: boolean;
  assignment_count: number;
  default_queue_name: string | null;
  experience_groups: ExperienceGroupStub[];
  sort_order: number;
}

export interface SupportChannelDetail extends SupportChannelListItem {
  project: number;
  welcome_message: string;
  ticket_confirmation_message: string;
  operating_hours: OperatingHours;
  timezone: string;
  offline_fallback_message: string;
  offline_alternative: OfflineAlternative;
  offline_alternative_target_id: number | null;
  default_queue: number | null;
  ticket_form: number | null;
  ticket_form_name: string | null;
  email_address: string;
  embed_key: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSupportChannelData {
  channel_type: ChannelType;
  display_name: string;
  welcome_message?: string;
  ticket_confirmation_message?: string;
  operating_hours?: OperatingHours;
  timezone?: string;
  offline_fallback_message?: string;
  offline_alternative?: OfflineAlternative;
  offline_alternative_target_id?: number | null;
  default_queue?: number | null;
  ticket_form?: number | null;
  email_address?: string;
  sort_order?: number;
  is_active?: boolean;
}

export type UpdateSupportChannelData = Partial<
  Omit<CreateSupportChannelData, 'channel_type'>
>;

export interface ReplaceChannelAssignmentsPayload {
  experience_group_ids: number[];
}

export interface EmbedSnippetResponse {
  snippet: string;
  embed_key: string;
}
