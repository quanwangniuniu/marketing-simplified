'use client';

import { Suspense } from 'react';
import DashboardLayout from '@/components/dashboard-v2/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import useAuth from '@/hooks/useAuth';
import IntegrationsPanel from '@/components/profile-v2/IntegrationsPanel';
import { Skeleton } from '@/components/ui/skeleton';

function IntegrationsV2Skeleton() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="p-6 bg-white rounded-lg shadow-xl border border-gray-200 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function IntegrationsV2Content() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mx-auto max-w-4xl">
          <IntegrationsPanel userId={userId} />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function IntegrationsV2Page() {
  return (
    <ProtectedRoute loadingComponent={<IntegrationsV2Skeleton />}>
      <Suspense fallback={<IntegrationsV2Skeleton />}>
        <IntegrationsV2Content />
      </Suspense>
    </ProtectedRoute>
  );
}
