'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ChevronRight } from 'lucide-react';
import SlackIntegrationModal from '@/components/slack/SlackIntegrationModal';
import ZoomIntegrationModal from '@/components/zoom/ZoomIntegrationModal';
import GoogleDocsIntegrationModal from '@/components/google-docs/GoogleDocsIntegrationModal';
import { slackApi, SlackConnectionStatus } from '@/lib/api/slackApi';
import { zoomApi } from '@/lib/api/zoomApi';
import { googleDocsApi } from '@/lib/api/googleDocsApi';
import { useProjectStore } from '@/lib/projectStore';

interface IntegrationsPanelProps {
  userId: number | string | null;
}

type IntegrationId = 'slack' | 'zoom' | 'gdocs';

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
];

export default function IntegrationsPanel({ userId }: IntegrationsPanelProps) {
  const activeProject = useProjectStore((state) => state.activeProject);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [isGoogleDocsModalOpen, setIsGoogleDocsModalOpen] = useState(false);

  const [slackStatus, setSlackStatus] = useState<SlackConnectionStatus | null>(null);
  const [zoomConnected, setZoomConnected] = useState<boolean | null>(null);
  const [googleDocsConnected, setGoogleDocsConnected] = useState<boolean | null>(null);
  const [googleDocsEmail, setGoogleDocsEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const hasOpenedSlackRef = useRef(false);
  const hasOpenedZoomRef = useRef(false);
  const hasOpenedGoogleDocsRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      setSlackStatus(null);
      setZoomConnected(null);
      setGoogleDocsConnected(null);
      setLoading(false);
      return;
    }
    let isActive = true;
    setLoading(true);
    const context = activeProject?.id ? { projectId: activeProject.id } : undefined;

    const loadAll = async () => {
      const [slackRes, zoomRes, gdocsRes] = await Promise.allSettled([
        slackApi.getStatus(context),
        zoomApi.getStatus(),
        googleDocsApi.getStatus(),
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
  }, [slackStatus, loading, searchParams, router]);

  const canManageSlack = !!slackStatus?.can_manage_slack;
  const slackConnected = !!slackStatus?.is_connected && !!slackStatus?.is_active;
  const slackDisabled = loading || !canManageSlack;

  const statusFor = (id: IntegrationId) => {
    if (loading) return { connected: null as boolean | null, label: 'Loading...' };
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
    }
  };

  const openModal = (id: IntegrationId) => {
    if (id === 'slack') {
      if (slackDisabled) return;
      setIsSlackModalOpen(true);
    } else if (id === 'zoom') {
      setIsZoomModalOpen(true);
    } else {
      setIsGoogleDocsModalOpen(true);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
        <p className="text-sm text-gray-500 mt-1">
          Connect external services to automate notifications, video meetings, and document workflows.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <ul className="divide-y divide-gray-100">
          {INTEGRATIONS.map((item) => {
            const { connected, label } = statusFor(item.id);
            const isDisabled = item.id === 'slack' ? slackDisabled : false;
            const dotClass =
              connected === true
                ? 'bg-[#3CCED7]'
                : connected === false
                  ? 'bg-gray-300'
                  : 'bg-gray-200';

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
                    <span
                      className={`text-xs truncate max-w-[200px] ${
                        connected === true
                          ? 'text-[#3CCED7] font-medium'
                          : connected === false
                            ? 'text-gray-500'
                            : 'text-gray-400'
                      }`}
                    >
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
    </div>
  );
}
