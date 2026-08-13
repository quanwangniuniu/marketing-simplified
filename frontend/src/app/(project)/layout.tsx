import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { DashboardPanelPreferenceProvider } from '@/components/dashboard/DashboardPanelPreferenceContext';
import LegacyPathRedirect from '@/components/LegacyPathRedirect';
import {
  UPCOMING_MEETINGS_PANEL_STORAGE_KEY,
  normalizeUpcomingMeetingsPanelOpen,
} from '@/lib/dashboardPanelPreferences';


import ProjectStoreHydrator from '@/components/select-project/ProjectStoreHydrator';
import type { ProjectData } from '@/lib/api/projectApi';

function isValidActiveProject(value: unknown): value is ProjectData {
  if (!value || typeof value !== 'object') return false;

  const project = value as Record<string, unknown>;

  const validId =
    (typeof project.id === 'number' && Number.isFinite(project.id)) ||
    (typeof project.id === 'string' && project.id.trim().length > 0);

  return (
    validId &&
    typeof project.name === 'string' &&
    project.name.trim().length > 0 &&
    (project.slug === undefined || typeof project.slug === 'string')
  );
}

export default async function ProjectLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();

  const initialUpcomingMeetingsPanelOpen = normalizeUpcomingMeetingsPanelOpen(
    cookieStore.get(UPCOMING_MEETINGS_PANEL_STORAGE_KEY)?.value
  );

  const activeProjectCookie = cookieStore.get('active-project')?.value;

  let initialActiveProject: ProjectData | null = null;

  if (activeProjectCookie) {
    try {
      const parsed: unknown = JSON.parse(activeProjectCookie);
      initialActiveProject = isValidActiveProject(parsed) ? parsed : null;
    } catch {
      initialActiveProject = null;
    }
  }

  return (
    <ProjectStoreHydrator initialActiveProject={initialActiveProject}>
      <DashboardPanelPreferenceProvider
        initialUpcomingMeetingsPanelOpen={initialUpcomingMeetingsPanelOpen}
      >
        <Suspense fallback={null}>
          <LegacyPathRedirect />
        </Suspense>
        {children}
      </DashboardPanelPreferenceProvider>
    </ProjectStoreHydrator>
  );
}