'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Link2, AlertCircle, Settings } from 'lucide-react';
import { useActiveProjectForFlatRoute } from '@/lib/useActiveProjectForFlatRoute';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import { TicketFormAPI } from '@/lib/api/ticketFormApi';
import type { TicketFormListItem } from '@/types/ticketForm';
import { PORTAL_SUBMIT_BUTTON_CLASS } from '@/components/ticket-form/constants';
import { useBuildUrl } from '@/lib/buildUrl';

export default function TicketFormsListPage() {
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const { activeProject } = useActiveProjectForFlatRoute();
  const projectId = Number(activeProject?.id ?? 0);
  const projectValid = projectId > 0;

  const [forms, setForms] = useState<TicketFormListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const res = await TicketFormAPI.create(projectId, { name: name.trim() });
      setCreateOpen(false);
      setName('');
      router.push(buildUrl(`/admin/ticket-forms/${res.data.slug}/edit`));
    } catch {
      setError('Could not create form.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <ProtectedRoute requiredAuth={true} fallback="/unauthorized">
      <DashboardLayout alerts={[]} upcomingMeetings={[]}>
        <div className="flex flex-col gap-6 p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ticket Forms</h1>
              <p className="mt-1 text-sm text-gray-500">Configure request forms for customer support.</p>
            </div>
            {projectValid && (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={buildUrl(`/admin/csm/settings`)}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="h-4 w-4" aria-hidden />
                  CSM Settings
                </Link>
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className={`gap-2 ${PORTAL_SUBMIT_BUTTON_CLASS}`}
                >
                  <Plus className="h-4 w-4" /> New form
                </button>
              </div>
            )}
          </div>

          {!projectValid ? (
            <p className="text-sm text-gray-600">Add ?project= to the URL from a project context.</p>
          ) : loading ? (
            <LoadingSpinner />
          ) : error ? (
            <div className="flex items-center gap-2 text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Default</th>
                    <th className="px-4 py-3">Assignments</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {forms.map((f) => (
                    <tr key={f.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900">{f.name}</td>
                      <td className="px-4 py-3">{f.is_default ? 'Yes' : '—'}</td>
                      <td className="px-4 py-3">{f.assignment_count}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={buildUrl(`/admin/ticket-forms/${f.slug}/edit`)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-gray-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                            Edit
                          </Link>
                          <Link
                            href={buildUrl(`/admin/ticket-forms/${f.slug}/assignments`)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-gray-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            <Link2 className="h-4 w-4" aria-hidden />
                            Assign
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {forms.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">
                        No ticket forms yet. Create one to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">New ticket form</h2>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-4 p-6">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Form name"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg border px-4 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
