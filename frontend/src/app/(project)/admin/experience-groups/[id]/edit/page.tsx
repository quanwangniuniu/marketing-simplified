'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ExperienceGroupAPI } from '@/lib/api/experienceGroupApi';
import { ExperienceGroup } from '@/types/experienceGroup';
import { AlertCircle, ArrowLeft, Eye, Send } from 'lucide-react';

const EditExperienceGroupPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(params.id);
  const projectId = searchParams.get('project');

  const [group, setGroup] = useState<ExperienceGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form state — tracks what the user is currently editing
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Derived: has the user changed anything since the last save?
  const isDirty = group !== null && (name !== group.name || description !== group.description);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const fetchGroup = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await ExperienceGroupAPI.retrieve(id);
      setGroup(res.data);
      setName(res.data.name);
      setDescription(res.data.description);
    } catch {
      setFetchError('Failed to load this experience group.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await ExperienceGroupAPI.update(id, { name, description });
      setGroup(res.data);
      setName(res.data.name);
      setDescription(res.data.description);
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
      const res = await ExperienceGroupAPI.publish(id);
      setGroup(res.data);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        'Could not publish this group.';
      setSaveError(detail);
    } finally {
      setPublishing(false);
    }
  };

  const handleBack = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
    const dest = projectId
      ? `/admin/experience-groups?project=${projectId}`
      : '/select-project';
    router.push(dest);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ProtectedRoute requiredAuth={true} fallback="/unauthorized">
        <DashboardLayout alerts={[]} upcomingMeetings={[]}>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
            <LoadingSpinner />
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (fetchError || !group) {
    return (
      <ProtectedRoute requiredAuth={true} fallback="/unauthorized">
        <DashboardLayout alerts={[]} upcomingMeetings={[]}>
          <div className="p-8">
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <p className="text-sm text-red-700">{fetchError || 'Group not found.'}</p>
              <button
                onClick={fetchGroup}
                className="ml-auto px-3 py-1.5 text-sm text-red-700 border border-red-300 rounded-lg hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredAuth={true} fallback="/unauthorized">
      <DashboardLayout alerts={[]} upcomingMeetings={[]}>
        <div className="p-8 max-w-2xl">

          {/* Back + title */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={handleBack}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Edit Experience Group</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Changes are saved as draft and won&apos;t affect the live portal until published.
              </p>
            </div>
          </div>

          {/* Draft notice */}
          {group.status === 'DRAFT' && (
            <div className="flex items-center justify-between p-3 mb-6 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <span>This group has unpublished changes.</span>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          )}

          {/* Error */}
          {saveError && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {saveError}
            </div>
          )}

          {/* Saved confirmation */}
          {savedMessage && (
            <div className="p-3 mb-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Changes saved as draft.
            </div>
          )}

          {/* Form */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-5">

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

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <a
                href={`/admin/experience-groups/${id}/preview`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
              >
                <Eye className="h-4 w-4" />
                Preview
              </a>

              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {isDirty ? 'Unsaved changes' : 'No changes'}
                </span>
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

          {/* Metadata */}
          <div className="mt-4 text-xs text-gray-400 flex gap-4">
            <span>Status: <strong className="text-gray-500">{group.status}</strong></span>
            {group.published_at && (
              <span>Last published: {new Date(group.published_at).toLocaleString()}</span>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default EditExperienceGroupPage;
