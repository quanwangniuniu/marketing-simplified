'use client';

import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-v2/DashboardLayout';
import ChatFAB from '@/components/global-chat/ChatFAB';
import { useProjectStore } from '@/lib/projectStore';
import AdVariationManagementV2 from '@/components/ad-variations-v2/AdVariationManagementV2';

export default function VariationsV2Page() {
  const searchParams = useSearchParams();
  const projectIdParam = searchParams?.get('project_id');
  const activeProject = useProjectStore((s) => s.activeProject);
  const projectId = projectIdParam ? Number(projectIdParam) : activeProject?.id ?? null;

  return (
    <DashboardLayout alerts={[]} upcomingMeetings={[]}>
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        {projectId ? (
          <AdVariationManagementV2 campaignId={projectId} />
        ) : (
          <div className="flex min-h-[400px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
            <div className="text-center">
              <p className="mb-2 text-lg text-gray-500">No project selected</p>
              <p className="text-sm text-gray-400">
                Select a project from the sidebar to view ad variations.
              </p>
            </div>
          </div>
        )}
      </div>
      <ChatFAB />
    </DashboardLayout>
  );
}
