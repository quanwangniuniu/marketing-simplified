'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/dashboard-v2/DashboardLayout';
import { klaviyoApi } from '@/lib/api/klaviyoApi';

export default function KlaviyoNewPage() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = subject.trim().length > 0 && !submitting;

  const handleCancel = () => {
    router.push('/klaviyo');
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await klaviyoApi.createEmailDraft({
        subject: subject.trim(),
        name: name.trim() ? name.trim() : undefined,
        status: 'draft',
      });
      toast.success('Template created');
      if (created?.id) {
        router.push(`/klaviyo/${created.id}`);
      } else {
        router.push('/klaviyo');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-5">
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Klaviyo templates
        </button>

        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            New Klaviyo template
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Fill in basic details. You can edit content blocks in the next step.
          </p>
        </div>

        <div className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-gray-200">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Subject <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Spring promotion launch"
              maxLength={255}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Internal name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2026-04 spring campaign"
              maxLength={255}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
            />
          </div>
          {error && (
            <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            title={!subject.trim() ? 'Subject is required' : undefined}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? 'Creating...' : 'Create template'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
