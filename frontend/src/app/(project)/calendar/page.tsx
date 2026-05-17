'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import CalendarPageContent from '@/components/calendar/CalendarPageContent';

function CalendarV2Content() {
  return (
    <DashboardLayout hideRightPanel mainClassName="!p-0 !space-y-0">
      <div className="flex h-full min-h-0 flex-col bg-white">
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
