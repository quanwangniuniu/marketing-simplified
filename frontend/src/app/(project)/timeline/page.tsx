'use client';

import { Clock } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function ComingSoon() {
  return (
    <DashboardLayout>
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#A6E661]/15">
            <Clock className="h-6 w-6 text-[#3CCED7]" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Timeline · Coming soon</h2>
          <p className="mt-2 text-sm text-gray-500">
            A unified timeline across tasks, decisions, meetings, and campaigns is in the
            works. Stay tuned for a cross-module activity feed.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function TimelinePage() {
  return (
    <ProtectedRoute>
      <ComingSoon />
    </ProtectedRoute>
  );
}
