import api from '../api';

export const SLACK_OAUTH_STATE_STORAGE_KEY = 'slack_oauth_state';

export interface SlackManageableProject {
    id: number;
    name: string;
}

export interface SlackConnectionStatus {
    is_connected: boolean;
    slack_team_name?: string | null;
    slack_team_id?: string | null;
    default_channel_id?: string | null;
    default_channel_name?: string | null;
    is_active: boolean;
    can_manage_slack: boolean;
    manageable_projects: SlackManageableProject[];
}

export interface SlackChannel {
    id: string;
    name: string;
    is_private: boolean;
}

export interface SlackRequestContext {
    projectId?: number | null;
    organizationId?: number | null;
}

// Backend representation of a preference
export interface NotificationPreference {
    id: number;
    project: number;
    event_type: 'TASK_STATUS_CHANGE' | 'DECISION_CREATED' | 'DEADLINE_REMINDER' | 'TASK_CREATED' | 'COMMENT_UPDATED';
    event_type_display: string;
    is_active: boolean;
    slack_channel_id?: string;
    slack_channel_name?: string;
}

const buildSlackContextParams = (context?: SlackRequestContext) => {
    if (!context) {
        return undefined;
    }

    if (context.projectId) {
        return { project_id: context.projectId };
    }

    if (context.organizationId) {
        return { organization_id: context.organizationId };
    }

    return undefined;
};

export const slackApi = {
    // Initialize OAuth flow
    initOAuth: async (context?: SlackRequestContext): Promise<{ url: string; state: string }> => {
        const response = await api.get('/api/slack/oauth/init/', {
            params: buildSlackContextParams(context),
        });
        return response.data;
    },

    // Handle OAuth callback
    handleCallback: async (code: string, state: string): Promise<any> => {
        const response = await api.post('/api/slack/oauth/callback/', { code, state });
        return response.data;
    },

    // Get connection status
    getStatus: async (context?: SlackRequestContext): Promise<SlackConnectionStatus> => {
        const response = await api.get('/api/slack/status/', {
            params: buildSlackContextParams(context),
        });
        return response.data;
    },

    // Disconnect Slack
    disconnect: async (context?: SlackRequestContext): Promise<{ success: boolean }> => {
        const response = await api.post(
            '/api/slack/disconnect/',
            null,
            { params: buildSlackContextParams(context) }
        );
        return response.data;
    },

    // Get notification preferences
    getPreferences: async (context?: SlackRequestContext): Promise<NotificationPreference[]> => {
        const response = await api.get<NotificationPreference[]>('/api/slack/preferences/', {
            params: buildSlackContextParams(context),
        });
        return response.data;
    },

    // Update a specific preference
    updatePreference: async (
        id: number,
        data: Partial<NotificationPreference>,
        context?: SlackRequestContext
    ): Promise<NotificationPreference> => {
        const response = await api.patch(`/api/slack/preferences/${id}/`, data, {
            params: buildSlackContextParams(context),
        });
        return response.data;
    },

    // Create default preference if none exists (usually backend handles this on connection, but good to have)
    createPreference: async (
        data: Partial<NotificationPreference>,
        context?: SlackRequestContext
    ): Promise<NotificationPreference> => {
        const response = await api.post('/api/slack/preferences/', data, {
            params: buildSlackContextParams(context),
        });
        return response.data;
    },

    // Get available Slack channels
    getChannels: async (context?: SlackRequestContext): Promise<SlackChannel[]> => {
        const response = await api.get('/api/slack/channels/', {
            params: buildSlackContextParams(context),
        });
        return response.data;
    }
};
