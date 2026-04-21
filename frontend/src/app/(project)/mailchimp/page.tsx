'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, Mail, Plus, AlertTriangle } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ConfirmDialog from '@/components/tasks-v2/detail/ConfirmDialog';
import {
  EmailDraftTableV2,
  type EmailDraftRow,
} from '@/components/email-draft-v2';
import { mailchimpApi } from '@/lib/api/mailchimpApi';
import type { EmailDraft } from '@/hooks/useMailchimpData';

function toRow(draft: EmailDraft): EmailDraftRow {
  const subject = draft.settings?.subject_line || draft.subject || 'Untitled draft';
  const fromName = draft.settings?.from_name || draft.from_name || '';
  return {
    id: draft.id,
    title: subject,
    subject,
    fromName,
    status: draft.status || 'draft',
    updatedAt: draft.updated_at,
    createdAt: draft.created_at,
  };
}

export default function MailchimpV2Page() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<EmailDraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EmailDraftRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await mailchimpApi.getEmailDrafts();
      setDrafts(result.map(toRow));
    } catch (err: any) {
      if (err?.status === 401) {
        if (typeof window !== 'undefined') window.location.href = '/login';
        return;
      }
      setError(err?.message || 'Failed to load email drafts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return drafts;
    return drafts.filter((row) =>
      [row.title, row.subject, row.fromName, row.status]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [drafts, searchQuery]);

  const handleOpen = (row: EmailDraftRow) => {
    router.push(`/mailchimp/${row.id}`);
  };
  const handleEdit = handleOpen;

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await mailchimpApi.deleteEmailDraft(deleteTarget.id);
      setDrafts((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast.success(`Deleted "${deleteTarget.title}"`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error('Failed to delete draft. Please try again.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleCreate = () => {
    router.push('/mailchimp/new');
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Mailchimp drafts
            </h1>
            <p className="mt-0.5 text-xs text-gray-500">
              Build and review email campaigns powered by Mailchimp templates.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
          >
            <Plus className="h-4 w-4" />
            New draft
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Mailchimp drafts"
            className="w-full max-w-lg rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-lg bg-white py-20 ring-1 ring-gray-200">
            <Loader2 className="h-5 w-5 animate-spin text-[#3CCED7]" />
            <span className="ml-2 text-sm text-gray-500">Loading drafts...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center rounded-lg bg-white py-20 ring-1 ring-rose-200">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-rose-700">
                Failed to load drafts
              </p>
              <p className="text-xs text-gray-500">{error}</p>
              <button
                type="button"
                onClick={() => void loadDrafts()}
                className="mt-2 text-xs font-medium text-[#3CCED7] hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg bg-white py-20 ring-1 ring-gray-200">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#3CCED7]/10 to-[#A6E661]/10">
              <Mail className="h-6 w-6 text-[#3CCED7]" />
            </div>
            <p className="mt-3 text-sm font-medium text-gray-900">
              {searchQuery
                ? 'No drafts match your search'
                : 'No Mailchimp drafts yet'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {searchQuery
                ? 'Try a different keyword or clear the search.'
                : 'Pick a template to start your first campaign.'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={handleCreate}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
              >
                <Plus className="h-4 w-4" />
                Create your first draft
              </button>
            )}
          </div>
        ) : (
          <EmailDraftTableV2
            platform="mailchimp"
            rows={filtered}
            onOpen={handleOpen}
            onEdit={handleEdit}
            onDelete={(row) => setDeleteTarget(row)}
          />
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this draft?"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" will be permanently deleted.`
            : undefined
        }
        confirmLabel={deleteBusy ? 'Deleting...' : 'Delete'}
        destructive
        busy={deleteBusy}
        onConfirm={handleConfirmDelete}
      />
    </DashboardLayout>
  );
}
