'use client';

import React from 'react';
import Layout from '@/components/layout/Layout';
import ModuleApproverEditor from '@/components/ui/ModuleApproverEditor';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const MODULES = [
  { id: 'ASSET', name: 'Asset Management', description: 'Asset Management module approvals' },
  { id: 'CAMPAIGN', name: 'Campaign Execution', description: 'Campaign Execution module approvals' },
  { id: 'BUDGET', name: 'Budget Approval', description: 'Budget Approval module approvals' },
  { id: 'REPORTING', name: 'Reporting', description: 'Reporting module approvals' },
];

const ApproversPageContent = () => {
  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Approver Management</h1>
        <div className="space-y-6">
          {MODULES.map(module => (
            <ModuleApproverEditor
              key={module.id}
              module={module.id}
              moduleName={module.name}
              moduleDescription={module.description}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
};

// Export the page with route protection
export default function ApproversPage() {
  return (
    <ProtectedRoute 
      requiredAuth={true}
      requiredRoles={['Super Administrator']} // Require admin role
      fallback="/unauthorized"
    >
      <ApproversPageContent />
    </ProtectedRoute>
  );
}

