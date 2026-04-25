'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardSidebar from './DashboardSidebar';
import NotificationBell from './NotificationBell';
import UpcomingMeetingsPanel from './UpcomingMeetingsPanel';
import { useProjectStore } from '@/lib/projectStore';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import { splitMeetingRowsBySchedule } from '@/lib/meetings/meetingScheduleSplit';
import type { AlertData } from '@/lib/mock/dashboardMock';
import type { MeetingListItem } from '@/types/meeting';

interface DashboardLayoutProps {
  children: React.ReactNode;
  alerts?: AlertData[];
  upcomingMeetings?: MeetingListItem[];
  hideRightPanel?: boolean;
  mainClassName?: string;
}

const humanize = (value: string): string =>
  value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const BREADCRUMB_ROOT: Record<string, string> = {
  'select-project': 'Projects',
  overview: 'Dashboard',
  campaigns: 'Manage',
  tasks: 'Manage',
  decisions: 'Manage',
  spreadsheet: 'Manage',
  spreadsheets: 'Manage',
  meetings: 'Collaborate',
  calendar: 'Collaborate',
  messages: 'Collaborate',
  'messages-v2': 'Collaborate',
  miro: 'Collaborate',
  variations: 'Content',
  facebook_meta: 'Content',
  tiktok: 'Content',
  google_ads: 'Content',
  mailchimp: 'Content',
  'mailchimp-v2': 'Content',
  klaviyo: 'Content',
  'klaviyo-v2': 'Content',
  notion: 'Content',
  'notion-v2': 'Content',
  workflows: 'Tools',
  timeline: 'Tools',
  settings: 'Tools',
  agent: 'Overview',
  profile: 'Account',
};

const BREADCRUMB_LEAF: Record<string, string> = {
  'select-project': 'Select Project',
  overview: 'Overview',
  spreadsheet: 'Spreadsheets',
  'mailchimp-v2': 'Mailchimp',
  'klaviyo-v2': 'Klaviyo',
  'notion-v2': 'Notion',
  'messages-v2': 'Messages',
};

const getBreadcrumb = (pathname: string | null): { root: string; leaf: string } => {
  const segments = (pathname || '').split('/').filter(Boolean);
  const first = segments[0] || 'overview';
  const root = BREADCRUMB_ROOT[first] || 'Dashboard';
  const leaf = BREADCRUMB_LEAF[first] || humanize(first);
  return { root, leaf };
};

const ROOT_PATHS = new Set([
  '/overview',
  '/select-project',
  '/mailchimp',
  '/klaviyo',
  '/notion',
  '/messages',
  '/profile',
  '/subscription',
  '/integrations',
  '/workflows',
  '/timeline',
]);

export default function DashboardLayout({
  children,
  alerts = [],
  upcomingMeetings,
  hideRightPanel = false,
  mainClassName = '',
}: DashboardLayoutProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [meetingsLoading, setMeetingsLoading] = useState(
    () => !(upcomingMeetings && upcomingMeetings.length > 0)
  );
  const pathname = usePathname();
  const router = useRouter();
  const breadcrumb = useMemo(() => getBreadcrumb(pathname), [pathname]);
  const showBack = !!pathname && !ROOT_PATHS.has(pathname);
  const handleBack = () => {
    const segments = (pathname ?? '').split('/').filter(Boolean);
    const parent = segments.length > 1 ? '/' + segments.slice(0, -1).join('/') : '/overview';
    router.push(parent);
  };
  const activeProject = useProjectStore((s) => s.activeProject);
  const hasProjectStoreHydrated = useProjectStore((s) => s.hasHydrated);
  const [autoMeetings, setAutoMeetings] = useState<MeetingListItem[]>([]);
  const useExplicit = upcomingMeetings && upcomingMeetings.length > 0;

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useEffect(() => {
    if (useExplicit) {
      setMeetingsLoading(false);
      return;
    }
    const projectId = activeProject?.id;
    if (!hasProjectStoreHydrated) {
      setMeetingsLoading(true);
      return;
    }
    if (!projectId) {
      setAutoMeetings([]);
      setMeetingsLoading(false);
      return;
    }
    let cancelled = false;
    setMeetingsLoading(true);
    MeetingsAPI.listMeetingsPaginated(projectId, {
      ordering: '-created_at',
      page: 1,
    })
      .then((res) => {
        if (cancelled) return;
        const { incoming } = splitMeetingRowsBySchedule(res.results);
        setAutoMeetings(incoming);
      })
      .catch(() => {
        if (!cancelled) setAutoMeetings([]);
      })
      .finally(() => {
        if (!cancelled) setMeetingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject?.id, hasProjectStoreHydrated, useExplicit]);

  const meetingsForPanel = useExplicit ? upcomingMeetings! : autoMeetings;

  return (
    <div className="fixed inset-0 flex bg-[#F7F8FA] overflow-hidden">
      <DashboardSidebar />

      {/* Main content */}
      <div className="min-h-0 flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-5 h-12 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2 text-sm">
            {showBack && (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Go back"
                title="Go back"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <span className="text-gray-400">{breadcrumb.root}</span>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-900">{breadcrumb.leaf}</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell alerts={alerts} />
            {!hideRightPanel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
              >
                {isPanelOpen ? (
                  <><PanelRightClose className="w-4 h-4 mr-1" /> Hide Panel</>
                ) : (
                  <><PanelRightOpen className="w-4 h-4 mr-1" /> Show Panel</>
                )}
              </Button>
            )}
          </div>
        </header>

        {/* Scrollable content */}
        <main className={`min-h-0 flex-1 overflow-y-auto p-5 space-y-4 ${mainClassName}`}>
          {children}
        </main>
      </div>

      {!hideRightPanel && (
        <UpcomingMeetingsPanel
          meetings={meetingsForPanel}
          isOpen={isPanelOpen}
          loading={meetingsLoading}
        />
      )}
    </div>
  );
}
