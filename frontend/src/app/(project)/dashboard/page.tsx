'use client';

import DashboardLayout from '@/components/dashboard-v2/DashboardLayout';
import KPICardRow from '@/components/dashboard-v2/KPICardRow';
import BudgetPacingChart from '@/components/dashboard-v2/BudgetPacingChart';
import CampaignTable from '@/components/dashboard-v2/CampaignTable';
import {
  mockKPIs,
  mockPacingData,
  mockCampaigns,
  mockAlerts,
  mockDataSources,
} from '@/lib/mock/dashboardMock';

export default function DashboardPage() {
  return (
    <DashboardLayout alerts={mockAlerts} dataSources={mockDataSources}>
      <KPICardRow data={mockKPIs} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <BudgetPacingChart data={mockPacingData} />
        <CampaignTable campaigns={mockCampaigns.slice(0, 5)} />
      </div>

      <CampaignTable campaigns={mockCampaigns} />
    </DashboardLayout>
  );
}
