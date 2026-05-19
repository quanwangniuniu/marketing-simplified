import api from '@/lib/api';

export interface ExperienceGroup {
  id: number;
  name: string;
  description: string;
  status: string;
}

export interface SupportChannel {
  id: number;
  name: string;
  channel_type: string;
  channel_type_display: string;
  welcome_message: string;
  offline_fallback_message: string;
  routing_destination: string;
  operating_hours: Record<string, { open: boolean; start: string; end: string }>;
  is_active: boolean;
  experience_groups: ExperienceGroup[];
  project: number;
  created_at: string;
  updated_at: string;
}

export interface SupportChannelPayload {
  name: string;
  channel_type: string;
  welcome_message?: string;
  offline_fallback_message?: string;
  routing_destination?: string;
  operating_hours?: Record<string, { open: boolean; start: string; end: string }>;
  is_active?: boolean;
  experience_group_ids?: number[];
  project: number;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const DEFAULT_OPERATING_HOURS = Object.fromEntries(
  DAYS.map((day) => [day, { open: day !== 'saturday' && day !== 'sunday', start: '09:00', end: '17:00' }])
);

export const supportChannelApi = {
  listChannels: async (params?: { project_id?: number; channel_type?: string; is_active?: boolean }) => {
    const response = await api.get<SupportChannel[]>('/api/support/channels/', { params });
    return response.data;
  },

  getChannel: async (id: number) => {
    const response = await api.get<SupportChannel>(`/api/support/channels/${id}/`);
    return response.data;
  },

  createChannel: async (payload: SupportChannelPayload) => {
    const response = await api.post<SupportChannel>('/api/support/channels/', payload);
    return response.data;
  },

  updateChannel: async (id: number, payload: Partial<SupportChannelPayload>) => {
    const response = await api.patch<SupportChannel>(`/api/support/channels/${id}/`, payload);
    return response.data;
  },

  deleteChannel: async (id: number) => {
    await api.delete(`/api/support/channels/${id}/`);
  },

  deactivateChannel: async (id: number) => {
    const response = await api.post<SupportChannel>(`/api/support/channels/${id}/deactivate/`);
    return response.data;
  },

  activateChannel: async (id: number) => {
    const response = await api.post<SupportChannel>(`/api/support/channels/${id}/activate/`);
    return response.data;
  },

  getChoices: async () => {
    const response = await api.get<{ channel_types: { value: string; label: string }[] }>(
      '/api/support/channels/choices/'
    );
    return response.data;
  },

  listExperienceGroups: async (params?: { project?: number }) => {
    const response = await api.get<ExperienceGroup[] | { results: ExperienceGroup[] }>('/api/experience-groups/', { params });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },
};
