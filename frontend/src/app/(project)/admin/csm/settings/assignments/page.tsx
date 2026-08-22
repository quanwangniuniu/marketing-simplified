'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Link2, Users } from 'lucide-react';
import { TicketFormAPI } from '@/lib/api/ticketFormApi';
import type { TicketFormListItem } from '@/types/ticketForm';
import CsmSettingsPageRoot, { CsmSettingsProjectGuard } from '@/components/csm-settings/CsmSettingsPageRoot';
import { SECONDARY_BUTTON_CLASS } from '@/components/csm-settings/constants';
import { useProjectIdFromUrl } from '@/components/csm-settings/useProjectIdFromUrl';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useBuildUrl } from '@/lib/buildUrl';

export default function AssignmentsSettingsPage() {
  const { projectId, projectValid } = useProjectIdFromUrl();
  const buildUrl = useBuildUrl();
  const [forms, setForms] = useState<TicketFormListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectValid) return;
    setLoading(true);
    setError(null);
    try {
      setForms(await TicketFormAPI.list(projectId));
    } catch {
      setError('Failed to load ticket forms.');
    } finally {
      setLoading(false);
    }
  }, [projectId, projectValid]);

  useEffect(() => { load(); }, [load]);

  return (
    <CsmSettingsPageRoot>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Assign ticket forms to experience groups and support projects.
          </p>
        </div>
        {projectValid && (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={buildUrl(`/admin/experience-groups`)}
              className={SECONDARY_BUTTON_CLASS}
            >
              <Users className="h-4 w-4" aria-hidden />
              Experience Groups
            </Link>
          </div>
        )}
      </div>

      {!projectValid ? (
        <CsmSettingsProjectGuard />
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : loading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
          <LoadingSpinner />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Form</th>
                <th className="px-4 py-3">Default</th>
                <th className="px-4 py-3">Assignments</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => (
                <tr key={form.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{form.name}</td>
                  <td className="px-4 py-3">{form.is_default ? 'Yes' : '—'}</td>
                  <td className="px-4 py-3">{form.assignment_count}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={buildUrl(`/admin/ticket-forms/${form.slug}/assignments`)}
                      title="Manage assignments"
                      aria-label={`Manage assignments for ${form.name}`}
                      className="inline-flex rounded-md p-1.5 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <Link2 className="h-4 w-4" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
              {forms.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm italic text-gray-400">
                    No ticket forms yet. Create a form to configure assignments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </CsmSettingsPageRoot>
  );
}
