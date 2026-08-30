'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import BookingLinkManager from '@/components/calendar/BookingLinkManager';
import { useProjectStore } from '@/lib/projectStore';

/**
 * MED-284: owner-side booking link management.
 *
 * The public booking page needs a link to exist; this is where one is
 * generated. The org slug comes from the active project because the shareable
 * URL is org-scoped — the public endpoint has no authenticated user to resolve
 * the tenant from, so the org travels in the path.
 */

function BookingLinksContent() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const orgSlug = activeProject?.organization?.slug ?? '';

  return (
    <DashboardLayout hideRightPanel>
      {orgSlug ? (
        <BookingLinkManager orgSlug={orgSlug} />
      ) : (
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Select a project first — booking links are scoped to an organisation.
        </div>
      )}
    </DashboardLayout>
  );
}

export default function BookingLinksPage() {
  return (
    <ProtectedRoute>
      <BookingLinksContent />
    </ProtectedRoute>
  );
}
