'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  AlertTriangle,
  Check,
  Layout as LayoutIcon,
  Loader2,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { mailchimpApi, type MailchimpTemplate } from '@/lib/api/mailchimpApi';

export default function MailchimpNewPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<MailchimpTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [fromName, setFromName] = useState('');
  const [replyTo, setReplyTo] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setTemplateError(null);
    try {
      const list = await mailchimpApi.getTemplates();
      setTemplates(list);
      if (list.length === 1 && selectedTemplateId === null) {
        setSelectedTemplateId(list[0].id);
      }
    } catch (err: any) {
      setTemplateError(err?.message || 'Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const canSubmit = useMemo(
    () =>
      !submitting &&
      selectedTemplateId !== null &&
      subject.trim().length > 0 &&
      fromName.trim().length > 0 &&
      replyTo.trim().length > 0,
    [submitting, selectedTemplateId, subject, fromName, replyTo],
  );

  const missingReason = useMemo(() => {
    if (selectedTemplateId === null) return 'Pick a template first';
    if (!subject.trim()) return 'Subject is required';
    if (!fromName.trim()) return 'From name is required';
    if (!replyTo.trim()) return 'Reply-to email is required';
    return undefined;
  }, [selectedTemplateId, subject, fromName, replyTo]);

  const handleCancel = () => {
    router.push('/mailchimp');
  };

  const handleSubmit = async () => {
    if (!canSubmit || selectedTemplateId === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await mailchimpApi.createEmailDraft({
        subject: subject.trim(),
        preview_text: previewText.trim() || undefined,
        from_name: fromName.trim(),
        reply_to: replyTo.trim(),
        template_id: selectedTemplateId,
      });
      toast.success('Draft created');
      if (created?.id) {
        router.push(`/mailchimp/${created.id}`);
      } else {
        router.push('/mailchimp');
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to create draft',
      );
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-5">
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Mailchimp drafts
        </button>

        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            New Mailchimp draft
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Pick a starting template and set campaign details. You can edit
            content in the next step.
          </p>
        </div>

        <section className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              1 · Choose a template
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              The template will be cloned for this draft so edits stay isolated.
            </p>
          </div>

          {loadingTemplates ? (
            <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#3CCED7]" />
              Loading templates...
            </div>
          ) : templateError ? (
            <div className="flex items-start gap-2 rounded-md bg-rose-50 p-3 ring-1 ring-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-rose-700">
                  Failed to load templates
                </p>
                <p className="text-xs text-gray-600">{templateError}</p>
                <button
                  type="button"
                  onClick={() => void loadTemplates()}
                  className="mt-1 text-xs font-medium text-[#3CCED7] hover:underline"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-md bg-gray-50 p-4 text-sm text-gray-500">
              No templates available yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => {
                const selected = selectedTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`group relative overflow-hidden rounded-lg p-4 text-left transition ${
                      selected
                        ? 'bg-gradient-to-br from-[#3CCED7]/10 to-[#A6E661]/10 ring-2 ring-[#3CCED7]'
                        : 'bg-white ring-1 ring-gray-200 hover:ring-gray-300'
                    }`}
                  >
                    {selected && (
                      <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white shadow-sm">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <div className="mb-3 flex h-24 items-center justify-center rounded-md bg-gradient-to-br from-gray-50 to-gray-100">
                      <LayoutIcon className="h-8 w-8 text-gray-300" />
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {template.name}
                    </div>
                    {template.category && (
                      <div className="mt-0.5 text-xs text-gray-500">
                        {template.category}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              2 · Campaign details
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              These are required by Mailchimp before sending.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
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
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Preview text (optional)
              </label>
              <input
                type="text"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Shown in the inbox preview after the subject"
                maxLength={255}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                From name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="e.g. Marketing team"
                maxLength={255}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Reply-to email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="e.g. team@example.com"
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              />
            </div>
          </div>

          {submitError && (
            <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
              {submitError}
            </div>
          )}
        </section>

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
            title={missingReason}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? 'Creating...' : 'Create draft'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
