'use client';

import ChatFAB from '@/components/global-chat/ChatFAB';
import DashboardLayout from '@/components/dashboard-v2/DashboardLayout';
import KPICardRow from '@/components/dashboard-v2/KPICardRow';
import BudgetPacingChart from '@/components/dashboard-v2/BudgetPacingChart';
import CampaignTable from '@/components/dashboard-v2/CampaignTable';
import ActivityFeed from '@/components/dashboard-v2/ActivityFeed';
import AccountHealthCard from '@/components/dashboard-v2/AccountHealthCard';
import {
  mockKPIs,
  mockAttributions,
  mockPacingData,
  mockCampaigns,
  mockAlerts,
  mockDataSources,
  mockActivities,
  mockAccountHealth,
} from '@/lib/mock/dashboardMock';

export default function DashboardPage() {
  return (
    <DashboardLayout alerts={mockAlerts} dataSources={mockDataSources}>
      <KPICardRow data={mockKPIs} attributions={mockAttributions} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <BudgetPacingChart data={mockPacingData} />
        <CampaignTable
          campaigns={mockCampaigns.filter(c => c.isAnomaly)}
          title="Anomaly Campaigns"
          compact
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ActivityFeed activities={mockActivities} />
        <AccountHealthCard health={mockAccountHealth} dataSources={mockDataSources} />
      </div>

      <ChatFAB />
    </DashboardLayout>
  );
}
