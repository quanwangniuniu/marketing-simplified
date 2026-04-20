'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import type { Meeting, MeetingCreateRequest } from '@/types/meeting';
import MeetingTypeCombobox from './MeetingTypeCombobox';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  typeSuggestions: string[];
  onCreated?: (meeting: Meeting) => void | Promise<void>;
}

interface FormState {
  title: string;
  meeting_type: string;
  objective: string;
  scheduled_date: string;
  scheduled_time: string;
}

const initialForm: FormState = {
  title: '',
  meeting_type: '',
  objective: '',
  scheduled_date: '',
  scheduled_time: '',
};

function getErrorMessage(err: unknown): string {
  const anyErr = err as {
    response?: { data?: Record<string, unknown> };
    message?: string;
  };
  const data = anyErr?.response?.data || {};
  const pickString = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v;
    if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
    return undefined;
  };
  return (
    pickString(data.detail) ||
    pickString(data.title) ||
    pickString(data.meeting_type) ||
    pickString(data.objective) ||
    pickString(data.non_field_errors) ||
    anyErr?.message ||
    'Could not create meeting.'
  );
}

export default function CreateMeetingDialog({
  open,
  onOpenChange,
  projectId,
  typeSuggestions,
  onCreated,
}: Props) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm);
    setSubmitting(false);
    setError(null);
    const raf = requestAnimationFrame(() => titleRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isValid =
    form.title.trim().length > 0 &&
    form.meeting_type.trim().length > 0 &&
    form.objective.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    const payload: MeetingCreateRequest = {
      title: form.title.trim(),
      meeting_type: form.meeting_type.trim(),
      objective: form.objective.trim(),
    };
    const date = form.scheduled_date.trim();
    if (date) payload.scheduled_date = date;
    const time = form.scheduled_time.trim();
    if (time) {
      payload.scheduled_time = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
    }

    setSubmitting(true);
    setError(null);
    try {
      const meeting = await MeetingsAPI.createMeeting(projectId, payload);
      toast.success('Meeting created');
      if (onCreated) await onCreated(meeting);
      onOpenChange(false);
    } catch (err) {
      const message = getErrorMessage(err);
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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-gray-100 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />
          <div className="flex items-start justify-between px-5 pt-4">
            <div className="min-w-0">
              <Dialog.Title className="text-[15px] font-semibold text-gray-900">
                New meeting
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-gray-500">
                Required fields are marked <span className="text-rose-500">*</span>.
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

          <div className="space-y-4 px-5 pb-5 pt-4">
            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="meeting-title"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
              >
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                ref={titleRef}
                id="meeting-title"
                type="text"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="e.g. Weekly planning"
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              />
            </div>

            <div>
              <label
                htmlFor="meeting-type"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
              >
                Meeting type <span className="text-rose-500">*</span>
              </label>
              <MeetingTypeCombobox
                id="meeting-type"
                ariaLabel="Meeting type"
                value={form.meeting_type}
                onChange={(label) => updateField('meeting_type', label)}
                suggestions={typeSuggestions}
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Type a new name and press enter to create a new type for this project.
              </p>
            </div>

            <div>
              <label
                htmlFor="meeting-objective"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
              >
                Objective <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="meeting-objective"
                rows={3}
                value={form.objective}
                onChange={(e) => updateField('objective', e.target.value)}
                placeholder="What do you want to achieve in this meeting?"
                className="w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="meeting-date"
                  className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                >
                  Date
                </label>
                <input
                  id="meeting-date"
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => updateField('scheduled_date', e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
                />
              </div>
              <div>
                <label
                  htmlFor="meeting-time"
                  className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                >
                  Time
                </label>
                <input
                  id="meeting-time"
                  type="time"
                  value={form.scheduled_time}
                  onChange={(e) => updateField('scheduled_time', e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isValid || submitting}
                title={
                  !isValid
                    ? 'Title, meeting type and objective are required.'
                    : undefined
                }
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {submitting ? 'Creating…' : 'Create meeting'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
