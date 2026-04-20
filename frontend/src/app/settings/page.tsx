'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import useAuth from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { Settings as SettingsIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import SlackIntegrationModal from '@/components/slack/SlackIntegrationModal';
import ZoomIntegrationModal from '@/components/zoom/ZoomIntegrationModal';
import GoogleDocsIntegrationModal from '@/components/google-docs/GoogleDocsIntegrationModal';
import GoogleCalendarIntegrationModal from '@/components/google-calendar/GoogleCalendarIntegrationModal';
import { slackApi, SlackConnectionStatus } from '@/lib/api/slackApi';
import { useProjectStore } from '@/lib/projectStore';

function SettingsPageContent() {
    const { user, logout, refreshUser } = useAuth();
    const activeProject = useProjectStore((state) => state.activeProject);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);
    const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
    const [isGoogleDocsModalOpen, setIsGoogleDocsModalOpen] = useState(false);
    const [isGoogleCalendarModalOpen, setIsGoogleCalendarModalOpen] = useState(false);
    const [slackStatus, setSlackStatus] = useState<SlackConnectionStatus | null>(null);
    const [slackStatusLoading, setSlackStatusLoading] = useState(true);
    const hasOpenedSlackRef = useRef(false);
    const hasOpenedZoomRef = useRef(false);
    const hasOpenedGoogleDocsRef = useRef(false);
    const hasOpenedGoogleCalendarRef = useRef(false);
    const userId = user?.id ?? null;

    // Refresh user data once on mount only — not in a loop.
    // Must NOT include `user` in deps: refreshUser() updates user → would re-trigger infinitely.
    useEffect(() => {
        refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let isActive = true;

        const loadSlackStatus = async () => {
            if (!userId) {
                if (isActive) {
                    setSlackStatus(null);
                    setSlackStatusLoading(false);
                }
                return;
            }

            setSlackStatusLoading(true);

            try {
                const status = await slackApi.getStatus(
                    activeProject?.id ? { projectId: activeProject.id } : undefined
                );
                if (isActive) {
                    setSlackStatus(status);
                }
            } catch (error) {
                console.error('Failed to load Slack status:', error);
                if (isActive) {
                    setSlackStatus(null);
                }
            } finally {
                if (isActive) {
                    setSlackStatusLoading(false);
                }
            }
        };

        void loadSlackStatus();

        return () => {
            isActive = false;
        };
    }, [activeProject?.id, userId]);

    // Handle URL parameters (modal auto-open, OAuth redirects).
    useEffect(() => {
        if (searchParams.get('open_slack') === '1' && !hasOpenedSlackRef.current) {
            if (!slackStatusLoading && slackStatus?.can_manage_slack) {
                setIsSlackModalOpen(true);
            }
            hasOpenedSlackRef.current = true;

            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete('open_slack');
            const newUrl = newParams.toString()
                ? `${window.location.pathname}?${newParams.toString()}`
                : window.location.pathname;
            router.replace(newUrl, { scroll: false });
        }

        if (searchParams.get('open_zoom') === '1' && !hasOpenedZoomRef.current) {
            setIsZoomModalOpen(true);
            hasOpenedZoomRef.current = true;

            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete('open_zoom');
            const newUrl = newParams.toString()
                ? `${window.location.pathname}?${newParams.toString()}`
                : window.location.pathname;
            router.replace(newUrl, { scroll: false });
        }

        if (searchParams.get('open_google_docs') === '1' && !hasOpenedGoogleDocsRef.current) {
            setIsGoogleDocsModalOpen(true);
            hasOpenedGoogleDocsRef.current = true;

            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete('open_google_docs');
            const newUrl = newParams.toString()
                ? `${window.location.pathname}?${newParams.toString()}`
                : window.location.pathname;
            router.replace(newUrl, { scroll: false });
        }

        if (searchParams.get('open_google_calendar') === '1' && !hasOpenedGoogleCalendarRef.current) {
            setIsGoogleCalendarModalOpen(true);
            hasOpenedGoogleCalendarRef.current = true;

            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete('open_google_calendar');
            const newUrl = newParams.toString()
                ? `${window.location.pathname}?${newParams.toString()}`
                : window.location.pathname;
            router.replace(newUrl, { scroll: false });
        }

        const zoomError = searchParams.get('zoom_error');
        if (zoomError) {
            const messages: Record<string, string> = {
                invalid_state: 'Zoom connection failed: invalid state. Please try again.',
                state_expired: 'Zoom connection failed: authorization link expired. Please try again.',
                session_expired: 'Zoom connection failed: session expired. Please try again.',
                user_not_found: 'Zoom connection failed: user not found.',
                token_exchange_failed: 'Zoom connection failed: could not retrieve token.',
                access_denied: 'Zoom connection cancelled.',
            };
            toast.error(messages[zoomError] ?? 'Zoom connection failed. Please try again.');
            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete('zoom_error');
            const newUrl = newParams.toString()
                ? `${window.location.pathname}?${newParams.toString()}`
                : window.location.pathname;
            router.replace(newUrl, { scroll: false });
        }

        const googleDocsError = searchParams.get('google_docs_error');
        if (googleDocsError) {
            const messages: Record<string, string> = {
                missing_code: 'Google Docs connection failed: missing callback code.',
                state_expired: 'Google Docs connection failed: authorization expired. Please try again.',
                invalid_state: 'Google Docs connection failed: invalid state.',
                token_exchange_failed: 'Google Docs connection failed: token exchange failed.',
            };
            toast.error(messages[googleDocsError] ?? 'Google Docs connection failed. Please try again.');
            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete('google_docs_error');
            const newUrl = newParams.toString()
                ? `${window.location.pathname}?${newParams.toString()}`
                : window.location.pathname;
            router.replace(newUrl, { scroll: false });
        }

        const googleCalendarError = searchParams.get('google_calendar_error');
        if (googleCalendarError) {
            const messages: Record<string, string> = {
                missing_code: 'Google Calendar connection failed: missing callback code.',
                state_expired: 'Google Calendar connection failed: authorization expired. Please try again.',
                invalid_state: 'Google Calendar connection failed: invalid state.',
                token_exchange_failed: 'Google Calendar connection failed: token exchange failed.',
            };
            toast.error(messages[googleCalendarError] ?? 'Google Calendar connection failed. Please try again.');
            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete('google_calendar_error');
            const newUrl = newParams.toString()
                ? `${window.location.pathname}?${newParams.toString()}`
                : window.location.pathname;
            router.replace(newUrl, { scroll: false });
        }
    }, [slackStatus, slackStatusLoading, searchParams, router]);

    const canManageSlack = !!slackStatus?.can_manage_slack;
    const isSlackCardDisabled = slackStatusLoading || !canManageSlack;

    const layoutUser = user
        ? {
            name: user.username || 'User',
            email: user.email || '',
            roles: user.roles || [],
            avatar: user.avatar || undefined,
            first_name: user.first_name || '',
            last_name: user.last_name || '',
        }
        : undefined;

    const handleUserAction = async (action: string) => {
        if (action === 'settings') {
            // Already on settings page
        } else if (action === 'logout') {
            await logout();
        }
    };

    return (
        <Layout user={layoutUser} onUserAction={handleUserAction}>
            <div className="flex h-full flex-col bg-gray-50 p-6 md:p-8">
                <div className="max-w-7xl mx-auto w-full">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3">
                            <SettingsIcon className="w-6 h-6 text-blue-600" />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                                <p className="text-sm text-gray-500">Manage your workspace preferences and integrations</p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-8">
                        {/* Integrations Section */}
                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Integrations</h2>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
                                {/* Slack Card */}
                                <div className={`bg-white border border-gray-200 rounded-xl p-6 shadow-sm transition-all ${isSlackCardDisabled ? 'opacity-75' : 'hover:shadow-md'}`}>
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#4A154B] rounded-lg flex items-center justify-center">
                                                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.52 2.52 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.527 2.527 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.52v-6.314zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.52v2.52h-2.52zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.522 2.521 2.527 2.527 0 0 1-2.522-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.522 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.522 2.52A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.522-2.52v-2.522h2.522zM15.165 17.688a2.527 2.527 0 0 1-2.522-2.522 2.527 2.527 0 0 1 2.522-2.522h6.314a2.527 2.527 0 0 1 2.522 2.522A2.528 2.528 0 0 1 18.956 17.688h-3.79z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">Slack</h3>
                                                <p className="text-sm text-gray-500">Messaging & Notifications</p>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                        Connect your Slack workspace to receive notifications and manage tasks directly from Slack.
                                    </p>
                                    {isSlackCardDisabled && (
                                        <p className="text-xs text-gray-500 mb-4">
                                            {slackStatusLoading
                                                ? 'Checking Slack permissions...'
                                                : 'Slack can only be managed by project owners, Super Administrators, Organization Admins, Team Leaders, and Campaign Managers for projects they oversee.'}
                                        </p>
                                    )}
                                    <button
                                        onClick={() => {
                                            if (!isSlackCardDisabled) {
                                                setIsSlackModalOpen(true);
                                            }
                                        }}
                                        disabled={isSlackCardDisabled}
                                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed hover:bg-blue-700"
                                    >
                                        {slackStatusLoading ? 'Loading...' : 'Configure'}
                                    </button>
                                </div>

                                {/* Zoom Card */}
                                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#2D8CFF] rounded-lg flex items-center justify-center">
                                                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M24 12c0 6.627-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0s12 5.373 12 12zm-6.462-3.692l-3.693 2.308V8H6.923A.923.923 0 006 8.923v6.154c0 .51.413.923.923.923H14v-2.616l3.538 2.212c.336.21.462.097.462-.233V8.54c0-.33-.126-.443-.462-.232z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">Zoom</h3>
                                                <p className="text-sm text-gray-500">Video Meetings</p>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                        Connect your Zoom account to create and schedule video meetings directly from the platform.
                                    </p>
                                    <button
                                        onClick={() => setIsZoomModalOpen(true)}
                                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                                    >
                                        Configure
                                    </button>
                                </div>

                                {/* Google Docs Card */}
                                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#0F9D58] rounded-lg flex items-center justify-center">
                                                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7zm0 1.5L18.5 8H14zM8 12h8v1.5H8zm0 3h8v1.5H8zm0-6h4v1.5H8z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">Google Docs</h3>
                                                <p className="text-sm text-gray-500">Import & Export Documents</p>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                        Connect Google Docs to import external documents and export decision content.
                                    </p>
                                    <button
                                        onClick={() => setIsGoogleDocsModalOpen(true)}
                                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                                    >
                                        Configure
                                    </button>
                                </div>

                                {/* Google Calendar Card */}
                                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#4285F4] rounded-lg flex items-center justify-center">
                                                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">Google Calendar</h3>
                                                <p className="text-sm text-gray-500">Scheduling and sync</p>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                        Import Google events and sync your primary platform calendar with Google Calendar.
                                    </p>
                                    <button
                                        onClick={() => setIsGoogleCalendarModalOpen(true)}
                                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                                    >
                                        Configure
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
            <SlackIntegrationModal
                isOpen={isSlackModalOpen}
                onClose={() => setIsSlackModalOpen(false)}
            />
            <ZoomIntegrationModal
                isOpen={isZoomModalOpen}
                onClose={() => setIsZoomModalOpen(false)}
            />
            <GoogleDocsIntegrationModal
                isOpen={isGoogleDocsModalOpen}
                onClose={() => setIsGoogleDocsModalOpen(false)}
            />
            <GoogleCalendarIntegrationModal
                isOpen={isGoogleCalendarModalOpen}
                onClose={() => setIsGoogleCalendarModalOpen(false)}
            />
        </Layout>
    );
}

export default function SettingsPage() {
    return (
        <ProtectedRoute>
            <Suspense>
                <SettingsPageContent />
            </Suspense>
        </ProtectedRoute>
    );
}
