'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import OverrideAuditTable from '@/components/audit/OverrideAuditTable';

export default function OverrideAuditsPage() {
  return (
    <ProtectedRoute requireAdmin fallback="/unauthorized">
      <Layout showPermissionRole={true}>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Override Audit Log</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Every superuser or organization-admin action that bypassed the normal permission check.
            </p>
          </div>
          <OverrideAuditTable />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
