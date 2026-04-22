import api from '../api';

export interface ProjectOrganization {
  id: number;
  name: string;
  slug?: string;
}

export interface ProjectOwner {
  id: number;
  username?: string;
  email?: string;
  name?: string;
}

export interface ProjectData {
  id: number;
  name: string;
  description?: string | null;
  organization_id?: number;  // Included for completeness, can be removed if never used
  organization?: ProjectOrganization;
  owner?: ProjectOwner | null;
  project_type?: string[];
  work_model?: string[];
  advertising_platforms?: string[];
  objectives?: string[];
  kpis?: Record<string, any>;
  target_kpi_value?: string | null;
  budget_management_type?: string | null;
  total_monthly_budget?: number | string | null;
  pacing_enabled?: boolean;
  budget_config?: Record<string, any>;
  primary_audience_type?: string | null;
  audience_targeting?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
  member_count?: number;
  status?: string; // Optional status field for future backend support
}

export interface ProjectMemberInvitePayload {
  email: string;
  role?: string;
}

export interface ProjectRoleOption {
  value: string;
  label: string;
}

export interface ProjectAvailableRolesResponse {
  roles: ProjectRoleOption[];
  default_role: string;
}

/** Writable fields for POST /api/core/projects/ (simple create). */
export interface CreateProjectPayload {
  name: string;
  description?: string | null;
  project_type?: string[];
  work_model?: string[];
  advertising_platforms?: string[];
  objectives?: string[];
  kpis?: Record<string, any>;
  target_kpi_value?: string | null;
  budget_management_type?: string | null;
  total_monthly_budget?: number | string | null;
  pacing_enabled?: boolean;
  budget_config?: Record<string, any>;
  primary_audience_type?: string | null;
  audience_targeting?: Record<string, any>;
}

export interface OnboardingProjectPayload {
  name: string;
  description?: string | null;
  media_work_types?: string[];
  use_cases?: string[];
  role?: string;
  team_size?: string;
  invite_emails?: string[];
  project_type?: string[];
  work_model?: string[];
  advertising_platforms?: string[];
  advertising_platforms_other?: string | null;
  objectives?: string[];
  kpis?: Record<string, any>;
  budget_management_type?: string | null;
  total_monthly_budget?: number | string | null;
  pacing_enabled?: boolean;
  budget_config?: Record<string, any>;
  primary_audience_type?: string | null;
  audience_targeting?: Record<string, any>;
  target_regions?: string[];
  owner_id?: number | null;
  invite_members?: ProjectMemberInvitePayload[];
}

export interface OnboardingProjectResponse {
  project: ProjectData;
}

export interface ProjectMemberUser {
  id: number;
  username?: string;
  email?: string;
  name?: string;
}

export interface ProjectMemberData {
  id: number;
  user: ProjectMemberUser;
  project: { id: number; name: string };
  role: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectInvitationData {
  id: number;
  email: string;
  role: string;
  project: { id: number; name: string };
  token?: string;
  invited_by?: ProjectMemberUser;
  approved?: boolean;
  approved_by?: ProjectMemberUser | null;
  approved_at?: string | null;
  accepted?: boolean;
  accepted_at?: string | null;
  expires_at?: string;
  created_at?: string;
}

/** Row from GET /api/core/projects/{id}/ad-channels/ */
export interface ProjectAdChannel {
  id: number;
  name: string;
}

const normalizeProjectsResponse = (data: any): ProjectData[] => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
};

const normalizeProjectMembersResponse = (
  data: any
): { members: ProjectMemberData[]; next: string | null } => {
  if (Array.isArray(data)) {
    return { members: data as ProjectMemberData[], next: null };
  }

  if (data && Array.isArray(data.results)) {
    return {
      members: data.results as ProjectMemberData[],
      next: typeof data.next === 'string' ? data.next : null,
    };
  }

  return { members: [], next: null };
};

const normalizePaginationUrl = (url: string): string => {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url;
  }

  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
};

export const ProjectAPI = {
  // Get all projects (filtered by user's organization on backend)
  getProjects: (options?: { activeOnly?: boolean }): Promise<ProjectData[]> => {
    const params = options?.activeOnly ? { active_only: true } : undefined;

    // Note: api instance has baseURL: '' (empty), so full path is needed
    // This matches pattern from taskApi.ts and budgetApi.ts
    // axios.get returns { data: ... }, so we return response.data which is the array
    return api
      .get<ProjectData[]>('/api/core/projects/', { params })
      .then((response) => normalizeProjectsResponse(response.data));
  },
  getProject: (projectId: number): Promise<ProjectData> => {
    return api
      .get<ProjectData>(`/api/core/projects/${projectId}/`)
      .then((response) => response.data);
  },

  getProjectAdChannels: (projectId: number): Promise<ProjectAdChannel[]> => {
    return api
      .get<ProjectAdChannel[]>(`/api/core/projects/${projectId}/ad-channels/`)
      .then((response) => (Array.isArray(response.data) ? response.data : []));
  },

  createProject: (payload: CreateProjectPayload): Promise<ProjectData> => {
    return api
      .post<ProjectData>('/api/core/projects/', payload)
      .then((response) => response.data);
  },

  // Create the first project through onboarding
  createProjectViaOnboarding: (payload: OnboardingProjectPayload): Promise<OnboardingProjectResponse | ProjectData> => {
    const mediaWorkTypeMap: Record<string, string> = {
      'Paid Social': 'paid_social',
      'Paid Search': 'paid_search',
      'Programmatic Advertising': 'programmatic',
      'Influencer / UGC Campaigns': 'influencer_ugc',
      'Cross-Channel Campaigns': 'cross_channel',
      'Performance (Direct Response)': 'performance',
      'Brand Awareness Campaigns': 'brand_campaigns',
      'App Acquisition / App Install Campaigns': 'app_acquisition',
    };

    const normalizedProjectTypes =
      payload.project_type && payload.project_type.length > 0
        ? payload.project_type
        : (payload.media_work_types || [])
            .map((label) => mediaWorkTypeMap[label] || null)
            .filter((item): item is string => Boolean(item));

    const normalizedInvites =
      payload.invite_members && payload.invite_members.length > 0
        ? payload.invite_members
        : (payload.invite_emails || []).map((email) => ({ email, role: 'member' as const }));

    const normalizedPayload: Record<string, any> = {
      name: payload.name,
      description: payload.description,
      project_type: normalizedProjectTypes,
      work_model: payload.work_model,
      advertising_platforms: payload.advertising_platforms,
      advertising_platforms_other: payload.advertising_platforms_other,
      objectives: payload.objectives,
      kpis: payload.kpis,
      budget_management_type: payload.budget_management_type,
      total_monthly_budget: payload.total_monthly_budget,
      pacing_enabled: payload.pacing_enabled,
      budget_config: payload.budget_config,
      primary_audience_type: payload.primary_audience_type,
      audience_targeting: payload.audience_targeting,
      target_regions: payload.target_regions,
      owner_id: payload.owner_id,
      invite_members: normalizedInvites,
    };

    Object.keys(normalizedPayload).forEach((key) => {
      const value = normalizedPayload[key];
      if (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)
      ) {
        delete normalizedPayload[key];
      }
    });

    return api
      .post<OnboardingProjectResponse | ProjectData>('/api/core/projects/onboarding/', normalizedPayload)
      .then((response) => response.data);
  },

  // Mark a project as the user's active project
  setActiveProject: (projectId: number) => {
    return api
      .post(`/api/core/projects/${projectId}/set_active/`)
      .then((response) => response.data);
  },

  // Delete a project (owner permission required)
  deleteProject: (projectId: number) => {
    return api.delete(`/api/core/projects/${projectId}/`).then((response) => response.data);
  },

  // Get members of a specific project
  getProjectMembers: (projectId: number): Promise<ProjectMemberData[]> => {
    return api
      .get(`/api/core/projects/${projectId}/members/`)
      .then((response) => {
        const { members } = normalizeProjectMembersResponse(response.data);
        return members;
      });
  },

  // Get allowed project role options for the current user's organization
  getProjectAvailableRoles: (projectId: number): Promise<ProjectAvailableRolesResponse> => {
    return api
      .get<ProjectAvailableRolesResponse>(`/api/core/projects/${projectId}/roles/`)
      .then((response) => response.data);
  },

  // Get all members of a specific project (fetches all pagination pages)
  getAllProjectMembers: async (projectId: number): Promise<ProjectMemberData[]> => {
    const allMembers: ProjectMemberData[] = [];
    const seenMemberIds = new Set<number>();
    const visitedUrls = new Set<string>();
    let nextUrl: string | null = `/api/core/projects/${projectId}/members/`;

    while (nextUrl) {
      const requestUrl = normalizePaginationUrl(nextUrl);

      if (visitedUrls.has(requestUrl)) {
        console.warn('[ProjectAPI] Detected repeated pagination URL, stopping:', requestUrl);
        break;
      }
      visitedUrls.add(requestUrl);

      const response = await api.get(requestUrl);
      const { members, next } = normalizeProjectMembersResponse(response.data);

      members.forEach((member) => {
        if (!seenMemberIds.has(member.id)) {
          seenMemberIds.add(member.id);
          allMembers.push(member);
        }
      });

      nextUrl = next;
    }

    return allMembers;
  },

  inviteProjectMember: (
    projectId: number,
    payload: ProjectMemberInvitePayload
  ): Promise<any> => {
    return api
      .post(`/api/core/projects/${projectId}/members/`, payload)
      .then((response) => response.data);
  },

  removeProjectMember: (projectId: number, memberId: number): Promise<any> => {
    return api
      .delete(`/api/core/projects/${projectId}/members/${memberId}/`)
      .then((response) => response.data);
  },

  updateProjectMemberRole: (
    projectId: number,
    memberId: number,
    role: string
  ): Promise<ProjectMemberData> => {
    return api
      .patch(`/api/core/projects/${projectId}/members/${memberId}/`, { role })
      .then((response) => response.data);
  },

  getPendingInvitationApprovals: (projectId: number): Promise<ProjectInvitationData[]> => {
    return api
      .get(`/api/core/projects/${projectId}/invitations/pending-approval/`)
      .then((response) => response.data || []);
  },
  getPendingInvitations: (projectId: number): Promise<ProjectInvitationData[]> => {
    return api
      .get(`/api/core/projects/${projectId}/invitations/`)
      .then((response) => response.data || []);
  },
  getMyPendingInvitations: (projectId?: number): Promise<ProjectInvitationData[]> => {
    const params = projectId ? { project_id: projectId } : undefined;
    return api
      .get(`/api/core/invitations/pending/`, { params })
      .then((response) => response.data || []);
  },
  acceptInvitation: (
    token: string,
    extra?: { password?: string; username?: string }
  ): Promise<any> => {
    return api
      .post(`/api/core/invitations/accept/`, {
        token,
        ...(extra?.password ? { password: extra.password } : {}),
        ...(extra?.username ? { username: extra.username } : {}),
      })
      .then((response) => response.data);
  },

  approveProjectInvitation: (projectId: number, invitationId: number): Promise<ProjectInvitationData> => {
    return api
      .post(`/api/core/projects/${projectId}/invitations/${invitationId}/approve/`)
      .then((response) => response.data);
  },

  rejectProjectInvitation: (projectId: number, invitationId: number): Promise<any> => {
    return api
      .delete(`/api/core/projects/${projectId}/invitations/${invitationId}/reject/`)
      .then((response) => response.data);
  },
};
