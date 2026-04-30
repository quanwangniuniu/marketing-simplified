'use client';

import { useEffect, useState } from 'react';
import BrandDialog from '@/components/tasks/detail/BrandDialog';
import type { Platform } from './types';
import { PLATFORM_LABEL } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: Platform;
  busy?: boolean;
  onCreate: (payload: { subject: string; name?: string }) => Promise<void> | void;
}

export default function EmailDraftCreateDialog({
  open,
  onOpenChange,
  platform,
  busy = false,
  onCreate,
}: Props) {
  const [subject, setSubject] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSubject('');
      setName('');
      setError(null);
    }
  }, [open]);

  const canSubmit = subject.trim().length > 0 && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await onCreate({
        subject: subject.trim(),
        name: name.trim() ? name.trim() : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create draft');
    }
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Create ${PLATFORM_LABEL[platform]} draft`}
      subtitle="Fill in basic details. You can edit content in the next step."
    >
      <div className="space-y-4">
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
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            title={!subject.trim() ? 'Subject is required' : undefined}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </BrandDialog>
  );
}
