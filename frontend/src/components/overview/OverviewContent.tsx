'use client';

import TaskStatusCard from './TaskStatusCard';
import DecisionsCard from './DecisionsCard';
import MeetingsCard from './MeetingsCard';
import RecentActivityCard from './RecentActivityCard';
import type { OverviewMock } from '@/types/overview';

interface OverviewContentProps {
  data: OverviewMock;
}

export default function OverviewContent({ data }: OverviewContentProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <TaskStatusCard summary={data.taskSummary} />
      <DecisionsCard pending={data.pendingDecisions} drafts={data.myDrafts} />
      <MeetingsCard upcoming={data.upcomingMeetings} actions={data.actionItems} />
      <RecentActivityCard activities={data.taskSummary.recent_activity} />
    </div>
  );
}
