'use client';

import MeetingsCard from './MeetingsCard';
import RecentActivityCard from './RecentActivityCard';
import TeamManagementSection from './TeamManagementSection';
import WorkspaceDashboard from '@/components/projects/WorkspaceDashboard';
import type { OverviewMock } from '@/types/overview';

interface OverviewContentProps {
  data: OverviewMock;
  projectId: number | null;
  projectName?: string | null;
}

export default function OverviewContent({
  data,
  projectId,
  projectName,
}: OverviewContentProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="xl:col-span-2">
        {projectId ? (
          <WorkspaceDashboard projectId={projectId} />
        ) : (
          <div className="rounded-xl border-[0.5px] border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
            No active project selected.
          </div>
        )}
      </div>
      <MeetingsCard upcoming={data.upcomingMeetings} actions={data.actionItems} />
      <RecentActivityCard activities={data.taskSummary.recent_activity} />
      <div className="xl:col-span-2">
        <TeamManagementSection projectId={projectId} projectName={projectName} />
      </div>
    </div>
  );
}
