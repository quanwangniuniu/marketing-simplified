import api from '../api';
import {
  ExperienceGroup,
  ExperienceGroupListItem,
  CreateExperienceGroupData,
  UpdateExperienceGroupData,
} from '@/types/experienceGroup';

const BASE = '/api/experience-groups';

export const ExperienceGroupAPI = {
  list: (params?: { project?: number }) =>
    api.get<{ count: number; next: string | null; previous: string | null; results: ExperienceGroupListItem[] } | ExperienceGroupListItem[]>(`${BASE}/`, { params }),

  retrieve: (id: number) =>
    api.get<ExperienceGroup>(`${BASE}/${id}/`),

  create: (data: CreateExperienceGroupData, projectId: number) =>
    api.post<ExperienceGroup>(`${BASE}/`, data, { params: { project: projectId } }),

  update: (id: number, data: UpdateExperienceGroupData) =>
    api.patch<ExperienceGroup>(`${BASE}/${id}/`, data),

  destroy: (id: number) =>
    api.delete(`${BASE}/${id}/`),

  publish: (id: number) =>
    api.post<ExperienceGroup>(`${BASE}/${id}/publish/`),

  preview: (id: number) =>
    api.get<ExperienceGroup & { is_preview: boolean }>(`${BASE}/${id}/preview/`),
};
