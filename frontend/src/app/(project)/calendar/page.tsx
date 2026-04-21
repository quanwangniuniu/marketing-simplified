'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import CalendarPageContent from '@/components/calendar-v2/CalendarPageContent';

function CalendarV2Content() {
  return (
    <DashboardLayout hideRightPanel>
      <div className="-m-5 h-[calc(100vh-3rem)] flex flex-col bg-white">
        <CalendarPageContent />
      </div>
    </DashboardLayout>
  );
}

export default function CalendarV2Page() {
  return (
    <ProtectedRoute>
      <CalendarV2Content />
    </ProtectedRoute>
  );
}
