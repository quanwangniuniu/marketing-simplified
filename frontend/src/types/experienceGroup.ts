export type ExperienceGroupStatus = 'DRAFT' | 'PUBLISHED';

export interface ExperienceGroup {
  id: number;
  name: string;
  description: string;
  status: ExperienceGroupStatus;
  draft_snapshot: Record<string, unknown> | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  customer_count: number;
}

export interface ExperienceGroupListItem {
  id: number;
  name: string;
  description: string;
  status: ExperienceGroupStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateExperienceGroupData {
  name: string;
  description?: string;
}

export interface UpdateExperienceGroupData {
  name?: string;
  description?: string;
}
