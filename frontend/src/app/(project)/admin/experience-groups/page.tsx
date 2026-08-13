'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import { ExperienceGroupAPI } from '@/lib/api/experienceGroupApi';
import { ExperienceGroup, ExperienceGroupListItem, CreateExperienceGroupData } from '@/types/experienceGroup';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Send, Eye, AlertCircle, X, Users, FileText, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActiveProjectForFlatRoute } from '@/lib/useActiveProjectForFlatRoute';
import { useBuildUrl } from '@/lib/buildUrl';
import { PORTAL_SUBMIT_BUTTON_CLASS } from '@/components/ticket-form/constants';

// ── Create Form ───────────────────────────────────────────────────────────────

interface CreateFormProps {
  projectId: number;
  onSuccess: (group: ExperienceGroupListItem) => void;
  onCancel: () => void;
}

const CreateForm: React.FC<CreateFormProps> = ({ projectId, onSuccess, onCancel }) => {
  const [form, setForm] = useState<CreateExperienceGroupData>({ name: '', description: '' });
  const [errors, setErrors] = useState<Partial<CreateExperienceGroupData>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const validate = (): boolean => {
    const next: Partial<CreateExperienceGroupData> = {};
    if (!form.name.trim()) next.name = 'Group name is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await ExperienceGroupAPI.create(form, projectId);
      onSuccess(res.data);
    } catch (err: any) {
      const detail =
        err?.response?.data?.name?.[0] ||
        err?.response?.data?.detail ||
        'Failed to create group. Please try again.';
      setServerError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
      {serverError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {serverError}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Enterprise Customers"
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={submitting}
        />
        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Describe this experience group..."
          rows={3}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          disabled={submitting}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Group'}
        </button>
      </div>
    </form>
  );
};

// ── Edit Form ─────────────────────────────────────────────────────────────────

interface EditFormProps {
  groupId: string;
  projectId: number;
  onSaved: (group: ExperienceGroup) => void;
  onClose: () => void;
}

const EditForm: React.FC<EditFormProps> = ({ groupId, projectId, onSaved, onClose }) => {
  const buildUrl = useBuildUrl();
  const [group, setGroup] = useState<ExperienceGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  const isDirty = group !== null && (name !== group.name || description !== group.description);

  const fetchGroup = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await ExperienceGroupAPI.retrieve(groupId);
      setGroup(res.data);
      setName(res.data.name);
      setDescription(res.data.description);
    } catch {
      setFetchError('Failed to load group details.');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await ExperienceGroupAPI.update(groupId, { name, description });
      setGroup(res.data);
      setName(res.data.name);
      setDescription(res.data.description);
      onSaved(res.data);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2500);
    } catch (err: any) {
      const detail =
        err?.response?.data?.name?.[0] ||
        err?.response?.data?.detail ||
        'Failed to save changes.';
      setSaveError(detail);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!window.confirm('Publishing will update the live customer portal for this group. Continue?')) return;
    setPublishing(true);
    setSaveError(null);
    try {
      const res = await ExperienceGroupAPI.publish(groupId);
      setGroup(res.data);
      onSaved(res.data);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        'Could not publish this group.';
      setSaveError(detail);
    } finally {
      setPublishing(false);
    }
  };

  const handleClose = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Close anyway?')) return;
    onClose();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <LoadingSpinner />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (fetchError || !group) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{fetchError || 'Group not found.'}</p>
          <button
            onClick={fetchGroup}
            className="px-3 py-1.5 text-sm text-red-700 border border-red-300 rounded-lg hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Draft notice */}
      {group.status === 'DRAFT' && (
        <div className="flex items-center justify-between px-6 py-3 bg-yellow-50 border-b border-yellow-200 text-sm text-yellow-800">
          <span>This group has unpublished changes.</span>
          <button
            onClick={handlePublish}
            disabled={publishing || isDirty}
            title={isDirty ? 'Save your changes first before publishing' : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-5 p-6">
        {/* Error */}
        {saveError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {saveError}
          </div>
        )}

        {/* Saved confirmation */}
        {savedMessage && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Changes saved.
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={saving || publishing}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            disabled={saving || publishing}
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-400 flex gap-4 items-center">
            <span>Status: <strong className="text-gray-500">{group.status}</strong></span>
            {group.published_at && (
              <span>Published: {new Date(group.published_at).toLocaleDateString()}</span>
            )}
            <a
              href={buildUrl(`/admin/customers?group=${group.slug}`)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700 transition-colors"
            >
              <Users className="h-3.5 w-3.5" />
              {group.customer_count ?? 0} customer{group.customer_count !== 1 ? 's' : ''}
            </a>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {isDirty ? 'Unsaved changes' : 'No changes'}
            </span>
            <button
              onClick={handleClose}
              disabled={saving || publishing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || saving || publishing}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Status Badge ──────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: ExperienceGroupListItem['status'] }> = ({ status }) => {
  const styles =
    status === 'PUBLISHED'
      ? 'bg-green-100 text-green-700'
      : 'bg-yellow-100 text-yellow-700';
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles}`}>
      {status === 'PUBLISHED' ? 'Published' : 'Draft'}
    </span>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const ExperienceGroupsPage: React.FC = () => {
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const { activeProject } = useActiveProjectForFlatRoute();
  const projectId = Number(activeProject?.id ?? 0);
  const projectValid = projectId > 0;

  const [groups, setGroups] = useState<ExperienceGroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!projectValid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await ExperienceGroupAPI.list({ project: projectId });
      const data = res.data;
      setGroups(Array.isArray(data) ? data : (data as any).results ?? []);
    } catch {
      setError('Failed to load experience groups. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [projectId, projectValid]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreated = (newGroup: ExperienceGroupListItem) => {
    setGroups((prev) => [newGroup, ...prev]);
    setIsCreateModalOpen(false);
  };

  // Called by EditForm on every save or publish — updates the matching row in the table
  const handleEdited = (updated: ExperienceGroup) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === updated.id
          ? { ...g, name: updated.name, description: updated.description, status: updated.status, updated_at: updated.updated_at }
          : g
      )
    );
  };

  const handleDelete = async (slug: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    setDeletingId(slug);
    setActionError(null);
    try {
      await ExperienceGroupAPI.destroy(slug);
      setGroups((prev) => prev.filter((g) => g.slug !== slug));
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        'Could not delete this group. It may be referenced by an active channel or routing rule.';
      setActionError(detail);
    } finally {
      setDeletingId(null);
    }
  };

  const handlePublish = async (slug: string) => {
    setPublishingId(slug);
    setActionError(null);
    try {
      const res = await ExperienceGroupAPI.publish(slug);
      setGroups((prev) =>
        prev.map((g) => (g.slug === slug ? { ...g, status: res.data.status } : g))
      );
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        'Could not publish this group.';
      setActionError(detail);
    } finally {
      setPublishingId(null);
    }
  };

  const handlePreview = (slug: string) => {
    window.open(`/admin/experience-groups/${slug}/preview`, '_blank');
  };

  return (
    <ProtectedRoute requiredAuth={true} fallback="/unauthorized">
      <DashboardLayout alerts={[]} upcomingMeetings={[]}>
        <div className="p-8 flex flex-col gap-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Experience Groups</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage distinct support configurations for different customer segments.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {projectValid && (
                <>
                  <Link
                    href={buildUrl(`/admin/csm/settings`)}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Settings className="h-4 w-4" aria-hidden />
                    CSM Settings
                  </Link>
                  <Link
                    href={buildUrl(`/admin/ticket-forms`)}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <FileText className="h-4 w-4" />
                    Ticket Forms
                  </Link>
                </>
              )}
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className={`gap-2 ${PORTAL_SUBMIT_BUTTON_CLASS}`}
              >
                <Plus className="h-4 w-4" aria-hidden />
                New Group
              </button>
            </div>
          </div>

          {/* Action-level error */}
          {actionError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
              <button
                onClick={() => setActionError(null)}
                className="ml-auto text-red-500 hover:text-red-700 text-xs underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Content */}
          {!projectValid ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-center">
              <p className="text-sm text-gray-600">
                Open this page from a project card to manage experience groups for that project.
              </p>
              <button
                type="button"
                onClick={() => router.push('/select-project')}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                Go to projects
              </button>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
              <LoadingSpinner />
              <p className="text-sm text-gray-500">Loading experience groups...</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={fetchGroups}
                className="px-3 py-1.5 text-sm text-red-700 border border-red-300 rounded-lg hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-gray-400 text-sm">No experience groups yet.</p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50"
              >
                <Plus className="h-4 w-4" />
                Create your first group
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Last Updated</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groups.map((group) => (
                    <tr key={group.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-medium text-gray-900">{group.name}</td>
                      <td className="px-5 py-4 text-gray-500 max-w-xs truncate">
                        {group.description || <span className="italic text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={group.status} />
                      </td>
                      <td className="px-5 py-4 text-gray-400">
                        {new Date(group.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Preview */}
                          <button
                            onClick={() => handlePreview(group.slug)}
                            title="Preview"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Edit — opens modal */}
                          <button
                            onClick={() => setEditingGroupId(group.slug)}
                            title="Edit"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          {/* Publish (only if DRAFT) */}
                          {group.status === 'DRAFT' && (
                            <button
                              onClick={() => handlePublish(group.slug)}
                              disabled={publishingId === group.slug}
                              title="Publish"
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-40"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(group.slug, group.name)}
                            disabled={deletingId === group.slug}
                            title="Delete"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Modal */}
        <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">New Experience Group</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Configure a distinct support experience for a customer segment.
              </p>
            </div>
            <CreateForm
              projectId={projectId}
              onSuccess={handleCreated}
              onCancel={() => setIsCreateModalOpen(false)}
            />
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={editingGroupId !== null}
          onClose={() => setEditingGroupId(null)}
          disableBackdropClose={true}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Experience Group</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Changes are saved as draft until published.
                </p>
              </div>
              <button
                onClick={() => setEditingGroupId(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {editingGroupId !== null && (
              <EditForm
                groupId={editingGroupId}
                projectId={projectId}
                onSaved={handleEdited}
                onClose={() => setEditingGroupId(null)}
              />
            )}
          </div>
        </Modal>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default ExperienceGroupsPage;
