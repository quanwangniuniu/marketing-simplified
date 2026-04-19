'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-v2/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import DecisionsPageCard from '@/components/decisions-v2/DecisionsPageCard';
import { useAuthStore } from '@/lib/authStore';
import { useProjectStore } from '@/lib/projectStore';

const ROLE_LEVELS: Record<string, number> = {
  owner: 1,
  'Super Administrator': 1,
  'Organization Admin': 2,
  'Team Leader': 3,
  'Campaign Manager': 4,
  'Budget Controller': 5,
  Approver: 6,
  Reviewer: 7,
  'Data Analyst': 8,
  member: 8,
  'Senior Media Buyer': 9,
  'Specialist Media Buyer': 10,
  'Junior Media Buyer': 11,
  Designer: 12,
  Copywriter: 13,
  viewer: 999,
};

const EDIT_MAX_LEVEL = 13;

function resolveRoleLevel(role?: string | null): number {
  if (!role) return EDIT_MAX_LEVEL;
  return ROLE_LEVELS[role.trim()] ?? EDIT_MAX_LEVEL;
}

function DecisionsV2Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams?.get('project_id');
  const activeProject = useProjectStore((s) => s.activeProject);
  const user = useAuthStore((s) => s.user);

  const projectId = projectIdParam ? Number(projectIdParam) : activeProject?.id ?? null;
  const projectName = activeProject?.name ?? null;

  const role = useMemo(() => {
    if (!user) return null;
    const rawRole =
      (user as any)?.role_in_active_project ??
      (user as any)?.active_project?.role ??
      (user as any)?.role ??
      null;
    return rawRole ? String(rawRole) : null;
  }, [user]);

  const roleLevel = resolveRoleLevel(role);
  const canCreate = roleLevel <= EDIT_MAX_LEVEL;
  const canDelete = roleLevel <= EDIT_MAX_LEVEL;

  const navigateToDecision = (id: number) => {
    const qs = projectId ? `?project_id=${projectId}` : '';
    router.push(`/decisions-v2/${id}${qs}`);
  };

  return (
    <DashboardLayout alerts={[]} upcomingMeetings={[]}>
      <div className="mx-auto w-full max-w-[1440px] px-6 py-4">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">Decisions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review, create, and connect decisions across your project.
          </p>
        </header>
        <DecisionsPageCard
          projectId={projectId}
          projectName={projectName}
          role={role}
          canCreate={canCreate}
          canDelete={canDelete}
          onNavigateToDecision={navigateToDecision}
        />
      </div>
    </DashboardLayout>
  );
}

export default function DecisionsV2Page() {
  return (
    <ProtectedRoute>
      <DecisionsV2Content />
    </ProtectedRoute>
  );
}
