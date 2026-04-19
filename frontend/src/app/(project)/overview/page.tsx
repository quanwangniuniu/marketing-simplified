'use client';

import ChatFAB from '@/components/global-chat/ChatFAB';
import DashboardLayout from '@/components/dashboard-v2/DashboardLayout';
import OverviewContent from '@/components/overview/OverviewContent';
import { mockOverview } from '@/lib/mock/overviewMock';
import { mockAlerts } from '@/lib/mock/dashboardMock';

export default function OverviewPage() {
  return (
    <DashboardLayout alerts={mockAlerts} upcomingMeetings={mockOverview.upcomingMeetings}>
      <OverviewContent data={mockOverview} />
      <ChatFAB />
    </DashboardLayout>
  );
}
