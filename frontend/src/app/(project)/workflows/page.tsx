'use client';

import { Workflow } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-v2/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function ComingSoon() {
  return (
    <DashboardLayout>
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#3CCED7]/10">
            <Workflow className="h-6 w-6 text-[#3CCED7]" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Workflows · Coming soon</h2>
          <p className="mt-2 text-sm text-gray-500">
            Automated workflows are on our roadmap. You&apos;ll be able to chain tasks,
            decisions, and integrations here once it ships.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function WorkflowsPage() {
  return (
    <ProtectedRoute>
      <ComingSoon />
    </ProtectedRoute>
  );
}
