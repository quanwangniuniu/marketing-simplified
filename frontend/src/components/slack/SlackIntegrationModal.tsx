'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { SlackPreferenceRow } from './SlackPreferenceRow';
import {
    slackApi,
    SlackConnectionStatus,
    NotificationPreference,
    SlackChannel,
    SLACK_OAUTH_STATE_STORAGE_KEY,
    SlackRequestContext,
} from '@/lib/api/slackApi';
import {
    buildPreferenceSummary,
    EventType,
    getScopedPreferences,
} from './slackPreferenceSummary';
import { useProjectStore } from '@/lib/projectStore';
import toast from 'react-hot-toast';
import { CheckCircle2, Slack, Loader2, Filter } from 'lucide-react';

interface SlackIntegrationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PREFERENCE_ROWS: Array<{
    eventType: EventType;
    label: string;
    description: string;
}> = [
    {
        eventType: 'TASK_CREATED',
        label: 'Task Created',
        description: 'Notify when a new task is created.',
    },
    {
        eventType: 'TASK_STATUS_CHANGE',
        label: 'Task Review Updates',
        description: 'Notify when a task enters review, is approved or rejected, or is cancelled.',
    },
    {
        eventType: 'COMMENT_UPDATED',
        label: 'Task Comments',
        description: 'Notify when a new comment is posted on a task.',
    },
    {
        eventType: 'DECISION_CREATED',
        label: 'Decision Made',
        description: 'Notify when a decision is committed or approved.',
    },
    {
        eventType: 'DEADLINE_REMINDER',
        label: 'Task Due Reminders',
        description: 'Daily reminders for assigned tasks due soon.',
    },
];

export default function SlackIntegrationModal({ isOpen, onClose }: SlackIntegrationModalProps) {
    const activeProject = useProjectStore((state) => state.activeProject);
    const activeProjectId = activeProject?.id ?? null;
    const [loading, setLoading] = useState(true);
    const [connection, setConnection] = useState<SlackConnectionStatus | null>(null);
    const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
    const [channels, setChannels] = useState<SlackChannel[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<number | 'ALL'>('ALL');
    const [loadingChannels, setLoadingChannels] = useState(false);
    const slackContext: SlackRequestContext | undefined = activeProjectId
        ? { projectId: activeProjectId }
        : undefined;

    const fetchData = useCallback(async () => {
        const requestContext = activeProjectId
            ? { projectId: activeProjectId }
            : undefined;

        try {
            setLoading(true);
            const connStatus = await slackApi.getStatus(requestContext);
            setConnection(connStatus);

            if (!connStatus.can_manage_slack) {
                setPreferences([]);
                setChannels([]);
                setSelectedProjectId('ALL');
                return;
            }

            setSelectedProjectId((previousSelection) => {
                if (
                    activeProjectId &&
                    connStatus.manageable_projects.some(
                        (project) => project.id === activeProjectId
                    )
                ) {
                    return activeProjectId;
                }

                if (
                    previousSelection !== 'ALL' &&
                    !connStatus.manageable_projects.some(
                        (project) => project.id === previousSelection
                    )
                ) {
                    return 'ALL';
                }

                return previousSelection;
            });

            const prefsList = await slackApi.getPreferences(requestContext);
            setPreferences(prefsList);

            if (connStatus.is_active) {
                setLoadingChannels(true);
                try {
                    const chList = await slackApi.getChannels(requestContext);
                    setChannels(chList);
                } catch (e) {
                    console.error("Failed to load channels", e);
                } finally {
                    setLoadingChannels(false);
                }
            } else {
                setChannels([]);
            }

        } catch (error) {
            console.error('Failed to fetch Slack status:', error);
            toast.error('Failed to load Slack integration details.');
        } finally {
            setLoading(false);
        }
    }, [activeProjectId]);

    useEffect(() => {
        const activeProjectId = activeProject?.id;
        const manageableProjects = connection?.manageable_projects ?? [];
        if (
            selectedProjectId !== 'ALL' &&
            !manageableProjects.some((project) => project.id === selectedProjectId)
        ) {
            if (
                activeProjectId &&
                manageableProjects.some((project) => project.id === activeProjectId)
            ) {
                setSelectedProjectId(activeProjectId);
            } else {
                setSelectedProjectId('ALL');
            }
        }
    }, [activeProject?.id, connection, selectedProjectId]);

    useEffect(() => {
        if (isOpen) {
            void fetchData();
        }
    }, [fetchData, isOpen]);

    const handleConnect = async () => {
        try {
            const { url, state } = await slackApi.initOAuth(slackContext);
            window.localStorage.setItem(SLACK_OAUTH_STATE_STORAGE_KEY, state);
            window.location.href = url;
        } catch (error) {
            console.error('Failed to init OAuth:', error);
            toast.error('Failed to start Slack connection process.');
        }
    };

    const handleDisconnect = async () => {
        try {
            await slackApi.disconnect(slackContext);
            toast.success('Slack workspace disconnected.');
            await fetchData();
        } catch (error) {
            console.error('Failed to disconnect:', error);
            toast.error('Failed to disconnect Slack.');
        }
    };

    const manageableProjects = connection?.manageable_projects ?? [];
    const scopedPreferences = getScopedPreferences(
        preferences,
        manageableProjects,
        selectedProjectId
    );
    const selectedProjectHasMissingPreferences = (
        selectedProjectId !== 'ALL' &&
        manageableProjects.some((project) => project.id === selectedProjectId) &&
        scopedPreferences.length === 0
    );

    const updatePreference = async (eventType: EventType, updates: Partial<NotificationPreference>) => {
        // Find all preferences matching this event type AND within the current scope
        const targets = scopedPreferences.filter((preference) => preference.event_type === eventType);
        const targetIds = new Set(targets.map((preference) => preference.id));

        if (targets.length === 0) {
            console.warn(`No preference found for ${eventType} in current scope`);
            return;
        }

        // Optimistic update local state
        const oldPreferences = [...preferences];
        setPreferences(preferences.map(p => {
            if (targetIds.has(p.id)) {
                return { ...p, ...updates };
            }
            return p;
        }));

        try {
            // Update all matching records
            await Promise.all(targets.map(p =>
                slackApi.updatePreference(p.id, updates, slackContext)
            ));
            toast.success(selectedProjectId === 'ALL' ? 'Settings updated for all projects.' : 'Project settings updated.');
        } catch (error) {
            // Revert on failure
            setPreferences(oldPreferences);
            toast.error('Failed to update settings.');
        }
    };

    const togglePreference = (eventType: EventType) => {
        const currentSummary = buildPreferenceSummary({
            eventType,
            preferences,
            manageableProjects,
            connection,
            selectedProjectId,
        });
        updatePreference(eventType, { is_active: currentSummary.toggleState !== 'on' });
    };

    const changeChannel = (eventType: EventType, channelId: string) => {
        const actualId = channelId === "default" ? "" : channelId;
        const channelObj = channels.find(c => c.id === actualId);
        const updates: Partial<NotificationPreference> = { slack_channel_id: actualId };

        if (channelObj) {
            updates.slack_channel_name = channelObj.name;
        } else {
            updates.slack_channel_name = "";
        }
        updatePreference(eventType, updates);
    };


    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-[600px]">
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="flex items-center justify-center gap-2 text-xl pb-2">
                            <Slack className="w-6 h-6 text-[#4A154B]" />
                            Slack Integration
                        </DialogTitle>
                        <DialogDescription className="text-center">
                            Connect your Slack workspace to receive real-time notifications.
                        </DialogDescription>
                    </DialogHeader>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-3">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <p className="text-sm text-gray-500">Loading details...</p>
                        </div>
                    ) : !connection?.can_manage_slack ? (
                        <div className="py-6 flex flex-col items-center space-y-6">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                <Slack className="w-8 h-8 text-gray-400" />
                            </div>
                            <div className="text-center space-y-2 max-w-sm">
                                <h3 className="text-lg font-medium text-gray-900">Slack access is limited</h3>
                                <p className="text-sm text-gray-500">
                                    Slack can only be managed by project owners, Super Administrators, Organization Admins, Team Leaders, and Campaign Managers for projects they oversee.
                                </p>
                            </div>
                        </div>
                    ) : !connection?.is_connected ? (
                        // Not Connected State
                        <div className="py-6 flex flex-col items-center space-y-6">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                <Slack className="w-8 h-8 text-gray-500" />
                            </div>
                            <div className="text-center space-y-2 max-w-sm">
                                <h3 className="text-lg font-medium text-gray-900">Connect to Slack</h3>
                                <p className="text-sm text-gray-500">
                                    Stay updated with your team&apos;s progress. Get instant notifications in your preferred Slack channel.
                                </p>
                            </div>
                            <button
                                onClick={handleConnect}
                                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-[#4A154B] hover:bg-[#3d113e] transition-colors w-full sm:w-auto"
                            >
                                <Slack className="w-5 h-5 mr-2" />
                                Connect Workspace
                            </button>
                        </div>
                    ) : (
                        // Connected State
                        <div className="flex min-h-0 flex-1 flex-col py-2">
                            <div className="shrink-0 space-y-4 pb-2">
                                {/* Connection Info */}
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-semibold text-green-800">Connected Successfully</h4>
                                        <p className="text-sm text-green-700 mt-1">
                                            Linked to workspace <span className="font-semibold">{connection.slack_team_name}</span>.
                                            {loadingChannels && <span className="ml-2 text-xs text-gray-500 animate-pulse">Loading channels...</span>}
                                        </p>
                                    </div>
                                </div>

                                {/* Project Filter */}
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-gray-900">Notification Settings</h3>

                                    <div className="flex items-center gap-2">
                                        <Filter className="w-4 h-4 text-gray-400" />
                                        <Select
                                            value={String(selectedProjectId)}
                                            onValueChange={(val) => setSelectedProjectId(val === 'ALL' ? 'ALL' : Number(val))}
                                        >
                                            <SelectTrigger className="w-[180px] h-8 text-xs bg-white">
                                                <SelectValue placeholder="Select Project" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL">All Projects ({manageableProjects.length})</SelectItem>
                                                {manageableProjects.map(p => (
                                                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {selectedProjectId === 'ALL' && (
                                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                        Changes made in All Projects mode will be applied to every project you can manage.
                                    </div>
                                )}
                            </div>

                            {/* Preferences List */}
                            <div className="min-h-0 flex-1 overflow-y-auto border-t pt-2 pr-1">
                                {selectedProjectHasMissingPreferences ? (
                                    <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded">
                                        Slack preferences could not be loaded for the selected project context.
                                    </div>
                                ) : scopedPreferences.length > 0 ? (
                                    <div className="divide-y divide-gray-100">
                                        {PREFERENCE_ROWS.map((row) => {
                                            const summary = buildPreferenceSummary({
                                                eventType: row.eventType,
                                                preferences,
                                                manageableProjects,
                                                connection,
                                                selectedProjectId,
                                            });

                                            return (
                                                <SlackPreferenceRow
                                                    key={row.eventType}
                                                    label={row.label}
                                                    description={row.description}
                                                    eventType={row.eventType}
                                                    toggleState={summary.toggleState}
                                                    summaryText={summary.summaryText}
                                                    selectedChannel={summary.channelValue}
                                                    showChannelSelect={summary.showChannelSelect}
                                                    channels={channels}
                                                    loadingChannels={loadingChannels}
                                                    defaultChannelName={connection.default_channel_name}
                                                    defaultChannelId={connection.default_channel_id}
                                                    onToggle={togglePreference}
                                                    onChannelChange={changeChannel}
                                                />
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded">
                                        Settings are only available for projects you can manage.
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="mt-4 shrink-0 border-t pt-4 flex justify-between items-center">
                                <p className="text-xs text-gray-400">
                                    Team ID: {connection.slack_team_id}
                                </p>
                                <button
                                    onClick={() => {
                                        if (window.confirm('Are you sure you want to disconnect Slack?')) {
                                            handleDisconnect();
                                        }
                                    }}
                                    className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-2 rounded hover:bg-red-50 transition-colors"
                                >
                                    Disconnect Integration
                                </button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
