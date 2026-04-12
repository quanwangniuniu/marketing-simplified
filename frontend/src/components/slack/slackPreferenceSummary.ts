import {
  NotificationPreference,
  SlackConnectionStatus,
  SlackManageableProject,
} from '@/lib/api/slackApi';

export type ToggleState = 'on' | 'off' | 'mixed';
export type ChannelState = 'default' | 'single' | 'mixed';
export type EventType = NotificationPreference['event_type'];

export interface PreferenceSummary {
  toggleState: ToggleState;
  enabledCount: number;
  totalCount: number;
  channelState: ChannelState;
  channelValue: string;
  summaryText?: string;
  showChannelSelect: boolean;
}

export const normalizeChannelValue = (
  preference: NotificationPreference,
  connection: SlackConnectionStatus | null
) => {
  if (!preference.slack_channel_id) {
    return 'default';
  }

  if (connection && preference.slack_channel_id === connection.default_channel_id) {
    return 'default';
  }

  return preference.slack_channel_id;
};

export const getManageableProjectIds = (
  manageableProjects: SlackManageableProject[]
) => new Set(manageableProjects.map((project) => project.id));

export const getManageablePreferences = (
  preferences: NotificationPreference[],
  manageableProjects: SlackManageableProject[]
) => {
  const manageableProjectIds = getManageableProjectIds(manageableProjects);
  return preferences.filter((preference) => manageableProjectIds.has(preference.project));
};

export const getScopedPreferences = (
  preferences: NotificationPreference[],
  manageableProjects: SlackManageableProject[],
  selectedProjectId: number | 'ALL'
) => {
  const manageablePreferences = getManageablePreferences(preferences, manageableProjects);
  if (selectedProjectId === 'ALL') {
    return manageablePreferences;
  }

  return manageablePreferences.filter(
    (preference) => preference.project === selectedProjectId
  );
};

export const buildPreferenceSummary = ({
  eventType,
  preferences,
  manageableProjects,
  connection,
  selectedProjectId,
}: {
  eventType: EventType;
  preferences: NotificationPreference[];
  manageableProjects: SlackManageableProject[];
  connection: SlackConnectionStatus | null;
  selectedProjectId: number | 'ALL';
}): PreferenceSummary => {
  const scopedPreferences = getScopedPreferences(
    preferences,
    manageableProjects,
    selectedProjectId
  );
  const eventPreferences = scopedPreferences.filter(
    (preference) => preference.event_type === eventType
  );
  const totalCount =
    selectedProjectId === 'ALL'
      ? manageableProjects.length
      : eventPreferences.length;

  if (totalCount === 0) {
    return {
      toggleState: 'off',
      enabledCount: 0,
      totalCount: 0,
      channelState: 'default',
      channelValue: 'default',
      showChannelSelect: false,
    };
  }

  const enabledPreferences = eventPreferences.filter((preference) => preference.is_active);
  const enabledCount = enabledPreferences.length;

  let toggleState: ToggleState = 'off';
  if (enabledCount === totalCount) {
    toggleState = 'on';
  } else if (enabledCount > 0) {
    toggleState = 'mixed';
  }

  const channelValues = Array.from(
    new Set(
      enabledPreferences.map((preference) => normalizeChannelValue(preference, connection))
    )
  );

  let channelState: ChannelState = 'default';
  let channelValue = 'default';

  if (enabledPreferences.length > 0) {
    if (channelValues.length === 1) {
      channelValue = channelValues[0];
      channelState = channelValue === 'default' ? 'default' : 'single';
    } else {
      channelState = 'mixed';
      channelValue = 'mixed';
    }
  }

  let summaryText: string | undefined;
  if (selectedProjectId === 'ALL') {
    if (toggleState === 'on') {
      summaryText = `Enabled for all projects.`;
    } else if (toggleState === 'off') {
      summaryText = `Disabled for all projects.`;
    } else {
      summaryText = `Enabled for ${enabledCount}/${totalCount} projects.`;
    }

    if (enabledCount > 0 && channelState === 'mixed') {
      summaryText += ' Channels vary by project.';
    }
  }

  return {
    toggleState,
    enabledCount,
    totalCount,
    channelState,
    channelValue,
    summaryText,
    showChannelSelect: toggleState !== 'off',
  };
};
