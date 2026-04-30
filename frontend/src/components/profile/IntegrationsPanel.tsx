'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ChevronRight } from 'lucide-react';
import SlackIntegrationModal from '@/components/slack/SlackIntegrationModal';
import ZoomIntegrationModal from '@/components/zoom/ZoomIntegrationModal';
import GoogleDocsIntegrationModal from '@/components/google-docs/GoogleDocsIntegrationModal';
import GoogleCalendarIntegrationModal from '@/components/google-calendar/GoogleCalendarIntegrationModal';
import FacebookIntegrationModal from '@/components/facebook/FacebookIntegrationModal';
import NotionIntegrationModal from '@/components/notion/NotionIntegrationModal';
import { slackApi, SlackConnectionStatus } from '@/lib/api/slackApi';
import { zoomApi } from '@/lib/api/zoomApi';
import { googleDocsApi } from '@/lib/api/googleDocsApi';
import { googleCalendarApi, type GoogleCalendarStatus } from '@/lib/api/googleCalendarApi';
import { facebookApi, type FacebookStatus } from '@/lib/api/facebookApi';
import { notionIntegrationApi } from '@/lib/api/notionIntegrationApi';
import { useProjectStore } from '@/lib/projectStore';

interface IntegrationsPanelProps {
  userId: number | string | null;
}

type IntegrationId = 'slack' | 'zoom' | 'gdocs' | 'gcal' | 'meta' | 'notion';

interface IntegrationRow {
  id: IntegrationId;
  name: string;
  description: string;
  iconBg: string;
  iconNode: React.ReactNode;
}

const INTEGRATIONS: IntegrationRow[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Messaging & Notifications',
    iconBg: '#4A154B',
    iconNode: (
      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.52 2.52 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.527 2.527 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.52v-6.314zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.52v2.52h-2.52zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.522 2.521 2.527 2.527 0 0 1-2.522-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.522 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.522 2.52A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.522-2.52v-2.522h2.522zM15.165 17.688a2.527 2.527 0 0 1-2.522-2.522 2.527 2.527 0 0 1 2.522-2.522h6.314a2.527 2.527 0 0 1 2.522 2.522A2.528 2.528 0 0 1 18.956 17.688h-3.79z" />
      </svg>
    ),
  },
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Video Meetings',
    iconBg: '#2D8CFF',
    iconNode: (
      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12c0 6.627-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0s12 5.373 12 12zm-6.462-3.692l-3.693 2.308V8H6.923A.923.923 0 006 8.923v6.154c0 .51.413.923.923.923H14v-2.616l3.538 2.212c.336.21.462.097.462-.233V8.54c0-.33-.126-.443-.462-.232z" />
      </svg>
    ),
  },
  {
    id: 'gdocs',
    name: 'Google Docs',
    description: 'Import & Export Documents',
    iconBg: '#0F9D58',
    iconNode: (
      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7zm0 1.5L18.5 8H14zM8 12h8v1.5H8zm0 3h8v1.5H8zm0-6h4v1.5H8z" />
      </svg>
    ),
  },
  {
    id: 'gcal',
    name: 'Google Calendar',
    description: 'Scheduling and sync',
    iconBg: '#4285F4',
    iconNode: (
      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
      </svg>
    ),
  },
  {
    id: 'meta',
    name: 'Meta (Facebook)',
    description: 'Ads data from Facebook Business',
    iconBg: '#1877F2',
    iconNode: (
      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Connect your own workspace',
    iconBg: '#111827',
    iconNode: <span className="text-sm font-semibold text-white">N</span>,
  },
];

export default function IntegrationsPanel({ userId }: IntegrationsPanelProps) {
  const activeProject = useProjectStore((state) => state.activeProject);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [isGoogleDocsModalOpen, setIsGoogleDocsModalOpen] = useState(false);
  const [isGoogleCalendarModalOpen, setIsGoogleCalendarModalOpen] = useState(false);
  const [isFacebookModalOpen, setIsFacebookModalOpen] = useState(false);
  const [isNotionModalOpen, setIsNotionModalOpen] = useState(false);

  const [slackStatus, setSlackStatus] = useState<SlackConnectionStatus | null>(null);
  const [zoomConnected, setZoomConnected] = useState<boolean | null>(null);
  const [googleDocsConnected, setGoogleDocsConnected] = useState<boolean | null>(null);
  const [googleDocsEmail, setGoogleDocsEmail] = useState<string | null>(null);
  const [gcalStatus, setGcalStatus] = useState<GoogleCalendarStatus | null>(null);
  const [facebookStatus, setFacebookStatus] = useState<FacebookStatus | null>(null);
  const [notionConnected, setNotionConnected] = useState<boolean | null>(null);
  const [notionWorkspaceName, setNotionWorkspaceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const hasOpenedSlackRef = useRef(false);
  const hasOpenedZoomRef = useRef(false);
  const hasOpenedGoogleDocsRef = useRef(false);
  const hasOpenedGoogleCalendarRef = useRef(false);
  const hasOpenedFacebookRef = useRef(false);
  const hasOpenedNotionRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      setSlackStatus(null);
      setZoomConnected(null);
      setGoogleDocsConnected(null);
      setGcalStatus(null);
      setFacebookStatus(null);
      setNotionConnected(null);
      setNotionWorkspaceName(null);
      setLoading(false);
      return;
    }
    let isActive = true;
    setLoading(true);
    const context = activeProject?.id ? { projectId: activeProject.id } : undefined;

    const loadAll = async () => {
      const [slackRes, zoomRes, gdocsRes, gcalRes, metaRes, notionRes] = await Promise.allSettled([
        slackApi.getStatus(context),
        zoomApi.getStatus(),
        googleDocsApi.getStatus(),
        googleCalendarApi.getStatus(),
        facebookApi.getStatus(),
        notionIntegrationApi.getStatus(),
      ]);
      if (!isActive) return;
      if (slackRes.status === 'fulfilled') {
        setSlackStatus(slackRes.value);
      } else {
        setSlackStatus(null);
      }
      if (zoomRes.status === 'fulfilled') {
        setZoomConnected(zoomRes.value.connected);
      } else {
        setZoomConnected(false);
      }
      if (gdocsRes.status === 'fulfilled') {
        setGoogleDocsConnected(gdocsRes.value.connected);
        setGoogleDocsEmail(gdocsRes.value.google_email ?? null);
      } else {
        setGoogleDocsConnected(false);
      }
      if (gcalRes.status === 'fulfilled') {
        setGcalStatus(gcalRes.value);
      } else {
        setGcalStatus({ connected: false, needs_reconnect: false });
      }
      if (metaRes.status === 'fulfilled') {
        setFacebookStatus(metaRes.value);
      } else {
        setFacebookStatus({ connected: false });
      }
      if (notionRes.status === 'fulfilled') {
        setNotionConnected(notionRes.value.connected);
        setNotionWorkspaceName(notionRes.value.workspace_name ?? null);
      } else {
        setNotionConnected(false);
        setNotionWorkspaceName(null);
      }
      setLoading(false);
    };

    loadAll();
    return () => {
      isActive = false;
    };
  }, [activeProject?.id, userId]);

  useEffect(() => {
    const stripParam = (param: string) => {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete(param);
      const newUrl = newParams.toString()
        ? `${window.location.pathname}?${newParams.toString()}`
        : window.location.pathname;
      router.replace(newUrl, { scroll: false });
    };

    if (searchParams.get('open_slack') === '1' && !hasOpenedSlackRef.current) {
      if (!loading && slackStatus?.can_manage_slack) setIsSlackModalOpen(true);
      hasOpenedSlackRef.current = true;
      stripParam('open_slack');
    }
    if (searchParams.get('open_zoom') === '1' && !hasOpenedZoomRef.current) {
      setIsZoomModalOpen(true);
      hasOpenedZoomRef.current = true;
      stripParam('open_zoom');
    }
    if (searchParams.get('open_google_docs') === '1' && !hasOpenedGoogleDocsRef.current) {
      setIsGoogleDocsModalOpen(true);
      hasOpenedGoogleDocsRef.current = true;
      stripParam('open_google_docs');
    }
    if (searchParams.get('open_google_calendar') === '1' && !hasOpenedGoogleCalendarRef.current) {
      setIsGoogleCalendarModalOpen(true);
      hasOpenedGoogleCalendarRef.current = true;
      stripParam('open_google_calendar');
    }
    if (searchParams.get('facebook_connected') === '1' && !hasOpenedFacebookRef.current) {
      setIsFacebookModalOpen(true);
      hasOpenedFacebookRef.current = true;
      toast.success('Meta connected.');
      stripParam('facebook_connected');
    }
    if (searchParams.get('open_notion') === '1' && !hasOpenedNotionRef.current) {
      setIsNotionModalOpen(true);
      hasOpenedNotionRef.current = true;
      stripParam('open_notion');
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
      stripParam('zoom_error');
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
      stripParam('google_docs_error');
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
      stripParam('google_calendar_error');
    }
    const facebookError = searchParams.get('facebook_error');
    if (facebookError) {
      const messages: Record<string, string> = {
        missing_code_or_state: 'Meta connection failed: missing callback data.',
        state_expired: 'Meta connection failed: authorization expired. Please try again.',
        invalid_state: 'Meta connection failed: invalid state.',
        user_not_found: 'Meta connection failed: user mismatch.',
        token_exchange_failed: 'Meta connection failed: token exchange failed.',
        access_denied: 'Meta connection cancelled.',
      };
      toast.error(messages[facebookError] ?? 'Meta connection failed. Please try again.');
      stripParam('facebook_error');
    }
    const notionError = searchParams.get('notion_error');
    if (notionError) {
      const messages: Record<string, string> = {
        missing_code: 'Notion connection failed: missing callback code.',
        state_expired: 'Notion connection failed: authorization expired. Please try again.',
        invalid_state: 'Notion connection failed: invalid state.',
        token_exchange_failed: 'Notion connection failed: token exchange failed.',
        access_denied: 'Notion connection cancelled.',
      };
      toast.error(messages[notionError] ?? 'Notion connection failed. Please try again.');
      stripParam('notion_error');
    }
  }, [slackStatus, loading, searchParams, router]);

  const canManageSlack = !!slackStatus?.can_manage_slack;
  const slackConnected = !!slackStatus?.is_connected && !!slackStatus?.is_active;
  const slackDisabled = loading || !canManageSlack;

  type RowStatus = {
    connected: boolean | null;
    label: string;
    labelEmphasis?: 'warning';
  };

  const statusFor = (id: IntegrationId): RowStatus => {
    if (loading) return { connected: null, label: 'Loading...' };
    switch (id) {
      case 'slack':
        if (!canManageSlack) return { connected: null, label: 'Admin only' };
        return slackConnected
          ? { connected: true, label: slackStatus?.slack_team_name ? `Connected · ${slackStatus.slack_team_name}` : 'Connected' }
          : { connected: false, label: 'Not connected' };
      case 'zoom':
        return zoomConnected
          ? { connected: true, label: 'Connected' }
          : { connected: false, label: 'Not connected' };
      case 'gdocs':
        return googleDocsConnected
          ? { connected: true, label: googleDocsEmail ? `Connected · ${googleDocsEmail}` : 'Connected' }
          : { connected: false, label: 'Not connected' };
      case 'gcal': {
        if (!gcalStatus) {
          return { connected: false, label: 'Not connected' };
        }
        if (gcalStatus.needs_reconnect) {
          return {
            connected: false,
            label: gcalStatus.google_email
              ? `Reconnect required · ${gcalStatus.google_email}`
              : 'Reconnect required',
            labelEmphasis: 'warning',
          };
        }
        if (gcalStatus.connected) {
          return {
            connected: true,
            label: gcalStatus.google_email
              ? `Connected · ${gcalStatus.google_email}`
              : 'Connected',
          };
        }
        return { connected: false, label: 'Not connected' };
      }
      case 'meta':
        if (!facebookStatus) return { connected: false, label: 'Not connected' };
        return facebookStatus.connected
          ? {
              connected: true,
              label: facebookStatus.business_name
                ? `Connected · ${facebookStatus.business_name}`
                : 'Connected',
            }
          : { connected: false, label: 'Not connected' };
      case 'notion':
        return notionConnected
          ? { connected: true, label: notionWorkspaceName ? `Connected · ${notionWorkspaceName}` : 'Connected' }
          : { connected: false, label: 'Not connected' };
    }
  };

  const openModal = (id: IntegrationId) => {
    if (id === 'slack') {
      if (slackDisabled) return;
      setIsSlackModalOpen(true);
    } else if (id === 'zoom') {
      setIsZoomModalOpen(true);
    } else if (id === 'gdocs') {
      setIsGoogleDocsModalOpen(true);
    } else if (id === 'gcal') {
      setIsGoogleCalendarModalOpen(true);
    } else if (id === 'meta') {
      setIsFacebookModalOpen(true);
    } else {
      setIsNotionModalOpen(true);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
        <p className="text-sm text-gray-500 mt-1">
          Connect external services to automate notifications, video meetings, document workflows, and calendar
          sync.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <ul className="divide-y divide-gray-100">
          {INTEGRATIONS.map((item) => {
            const { connected, label, labelEmphasis } = statusFor(item.id);
            const isDisabled = item.id === 'slack' ? slackDisabled : false;
            const dotClass =
              connected === true
                ? 'bg-[#3CCED7]'
                : connected === false
                  ? 'bg-gray-300'
                  : 'bg-gray-200';

            const labelClass =
              labelEmphasis === 'warning'
                ? 'text-amber-700 font-medium'
                : connected === true
                  ? 'text-[#3CCED7] font-medium'
                  : connected === false
                    ? 'text-gray-500'
                    : 'text-gray-400';

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openModal(item.id)}
                  disabled={isDisabled}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:hover:bg-transparent group"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: item.iconBg }}
                  >
                    {item.iconNode}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{item.description}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${dotClass}`} aria-hidden />
                    <span className={`text-xs truncate max-w-[200px] ${labelClass}`}>
                      {label}
                    </span>
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <SlackIntegrationModal isOpen={isSlackModalOpen} onClose={() => setIsSlackModalOpen(false)} />
      <ZoomIntegrationModal isOpen={isZoomModalOpen} onClose={() => setIsZoomModalOpen(false)} />
      <GoogleDocsIntegrationModal
        isOpen={isGoogleDocsModalOpen}
        onClose={() => setIsGoogleDocsModalOpen(false)}
      />
      <GoogleCalendarIntegrationModal
        isOpen={isGoogleCalendarModalOpen}
        onClose={() => setIsGoogleCalendarModalOpen(false)}
      />
      <FacebookIntegrationModal
        isOpen={isFacebookModalOpen}
        onClose={() => setIsFacebookModalOpen(false)}
      />
      <NotionIntegrationModal
        isOpen={isNotionModalOpen}
        onClose={() => setIsNotionModalOpen(false)}
      />
    </div>
  );
}
