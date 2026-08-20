'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import { useActiveProjectForFlatRoute } from '@/lib/useActiveProjectForFlatRoute';
import { useBuildUrl } from '@/lib/buildUrl';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import AssignmentPanel from '@/components/ticket-form/AssignmentPanel';
import { TicketFormAPI } from '@/lib/api/ticketFormApi';
import type { TicketFormDetail } from '@/types/ticketForm';

const OUTLINE_BUTTON_CLASS =
  'inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50';

export default function TicketFormAssignmentsPage() {
  const params = useParams();
  const buildUrl = useBuildUrl();
  const { activeProject } = useActiveProjectForFlatRoute();
  const formId = String(params.id);
  const projectId = Number(activeProject?.id ?? 0);

  const [form, setForm] = useState<TicketFormDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await TicketFormAPI.retrieve(formId);
      setForm(res.data);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => { load(); }, [load]);

  return (
    <ProtectedRoute requiredAuth={true} fallback="/unauthorized">
      <DashboardLayout alerts={[]} upcomingMeetings={[]} mainClassName="!p-0 !space-y-0">
        <div className="flex min-h-full flex-1 flex-col gap-6 bg-white p-8 max-sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Form assignments</h1>
              {form && (
                <p className="mt-1 text-sm text-gray-500">
                  {form.name} — assign to experience groups and support projects.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={buildUrl(`/admin/experience-groups`)}
                className={OUTLINE_BUTTON_CLASS}
              >
                <Users className="h-4 w-4 shrink-0" aria-hidden />
                Experience Groups
              </Link>
              <Link
                href={buildUrl(`/admin/ticket-forms`)}
                className={OUTLINE_BUTTON_CLASS}
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                Ticket Forms
              </Link>
            </div>
          </div>

          {loading || !form ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <AssignmentPanel
              formId={formId}
              projectId={projectId}
              formName={form.name}
              isDefault={form.is_default}
              onDefaultChanged={load}
              onAssignmentsSaved={load}
            />
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
