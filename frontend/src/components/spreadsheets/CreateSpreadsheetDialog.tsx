'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { SpreadsheetAPI } from '@/lib/api/spreadsheetApi';
import type { SpreadsheetData } from '@/types/spreadsheet';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  defaultName?: string;
  onCreated?: (spreadsheet: SpreadsheetData) => void | Promise<void>;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as {
    response?: { data?: Record<string, unknown> };
    message?: string;
  };
  const data = anyErr?.response?.data || {};
  const pick = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v;
    if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
    return undefined;
  };
  return pick(data.error) || pick(data.detail) || pick(data.name) || anyErr?.message || fallback;
}

export default function CreateSpreadsheetDialog({
  open,
  onOpenChange,
  projectId,
  defaultName = '',
  onCreated,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setError(null);
    setSubmitting(false);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, defaultName]);

  const trimmed = name.trim();
  const isValid = trimmed.length > 0 && trimmed.length <= 200;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await SpreadsheetAPI.createSpreadsheet(projectId, { name: trimmed });
      toast.success('Spreadsheet created');
      if (onCreated) await onCreated(created);
      onOpenChange(false);
    } catch (err) {
      const message = extractErrorMessage(err, 'Could not create spreadsheet.');
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-gray-100 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />
          <div className="flex items-start justify-between px-5 pt-4">
            <div className="min-w-0">
              <Dialog.Title className="text-[15px] font-semibold text-gray-900">
                New spreadsheet
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-gray-500">
                Give it a descriptive name so your team can find it later.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="-mr-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <form
            className="space-y-4 px-5 pb-5 pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="spreadsheet-name"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
              >
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                ref={inputRef}
                id="spreadsheet-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                placeholder="e.g. Q2 campaign plan"
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                {trimmed.length}/200 characters
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || submitting}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
