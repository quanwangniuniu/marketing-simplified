'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Link2, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  BookingLinkAPI,
  bookingLinkUrl,
  type BookingLinkDTO,
  type BookingLinkWritePayload,
} from '@/lib/api/calendarApi';
import { CalendarAPI, type CalendarDTO } from '@/lib/api/calendarApi';
import { detectTimezone } from './bookingSlots';

/**
 * MED-284: owner-side management for booking links.
 *
 * The public page is useless until someone can generate a link, which is what
 * this covers. Rules map one-to-one onto the availability layer, so anything
 * saved here is what the public page will offer.
 */

const DEFAULT_FORM = {
  title: '',
  slug: '',
  description: '',
  calendar_id: '',
  duration_minutes: 30,
  slot_increment_minutes: 15,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  min_notice_minutes: 60,
  max_advance_days: 60,
  timezone: 'UTC',
};

/** Mirrors the backend: blank windows fall back to working hours, then Mon–Fri 9–5. */
const WINDOW_HINT =
  'Leave blank to use your calendar working hours, or Monday–Friday 09:00–17:00.';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function errorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    // calendars uses a custom error envelope: {error, message, details:[{field, message}]}
    const details = record.details;
    if (Array.isArray(details) && details.length > 0) {
      const first = details[0] as { field?: string; message?: string };
      if (first?.message) {
        return first.field ? `${first.field}: ${first.message}` : first.message;
      }
    }
    if (typeof record.message === 'string' && record.message !== 'VALIDATION_ERROR') {
      return record.message;
    }
  }
  return fallback;
}

interface BookingLinkManagerProps {
  /** Needed to build the shareable URL, which is org-scoped by design. */
  orgSlug: string;
}

export default function BookingLinkManager({ orgSlug }: BookingLinkManagerProps) {
  const [links, setLinks] = useState<BookingLinkDTO[]>([]);
  const [calendars, setCalendars] = useState<CalendarDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [linkList, calendarList] = await Promise.all([
        BookingLinkAPI.list(),
        CalendarAPI.listCalendars().then((res) => res.data).catch(() => []),
      ]);
      setLinks(linkList);
      setCalendars(Array.isArray(calendarList) ? calendarList : []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your booking links.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startCreating = () => {
    setForm({
      ...DEFAULT_FORM,
      timezone: detectTimezone(),
      calendar_id: calendars[0]?.id ?? '',
    });
    setCreating(true);
    setError(null);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload: BookingLinkWritePayload = {
        ...form,
        slug: form.slug.trim() || slugify(form.title),
        description: form.description.trim() || null,
      };
      const created = await BookingLinkAPI.create(payload);
      setLinks((prev) =>
        [...prev, created.data].sort((a, b) => a.title.localeCompare(b.title)),
      );
      setCreating(false);
    } catch (err) {
      setError(errorMessage(err, 'Could not create the booking link.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (link: BookingLinkDTO) => {
    setError(null);
    // Optimistic: the toggle is trivially reversible and the list shouldn't
    // flicker for a boolean.
    setLinks((prev) =>
      prev.map((l) => (l.id === link.id ? { ...l, is_active: !l.is_active } : l)),
    );
    try {
      await BookingLinkAPI.update(link.id, { is_active: !link.is_active });
    } catch (err) {
      setLinks((prev) =>
        prev.map((l) => (l.id === link.id ? { ...l, is_active: link.is_active } : l)),
      );
      setError(errorMessage(err, 'Could not update the link.'));
    }
  };

  const handleDelete = async (link: BookingLinkDTO) => {
    setError(null);
    try {
      await BookingLinkAPI.destroy(link.id);
      setLinks((prev) => prev.filter((l) => l.id !== link.id));
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the link.'));
    }
  };

  const copyUrl = async (link: BookingLinkDTO) => {
    const url = bookingLinkUrl(orgSlug, link.slug);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(link.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Could not copy to the clipboard. The URL is shown below the title.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8" data-testid="booking-link-manager">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Booking links</h1>
          <p className="mt-1 text-sm text-gray-500">
            Share a link and let people book time from your available slots.
          </p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={startCreating}
            data-testid="booking-link-new"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            New link
          </button>
        )}
      </header>

      {error && (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
          data-testid="booking-link-error"
        >
          {error}
        </div>
      )}

      {creating && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-5"
          data-testid="booking-link-form"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="bl-title" className="block text-xs font-medium text-gray-600">
                Title
              </label>
              <input
                id="bl-title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Intro call"
                data-testid="booking-link-title"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="bl-slug" className="block text-xs font-medium text-gray-600">
                URL
              </label>
              <div className="mt-1 flex items-center gap-1 text-sm">
                <span className="shrink-0 text-gray-400">/book/{orgSlug}/</span>
                <input
                  id="bl-slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder={slugify(form.title) || 'intro-call'}
                  data-testid="booking-link-slug"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="bl-calendar" className="block text-xs font-medium text-gray-600">
                Book into
              </label>
              <select
                id="bl-calendar"
                required
                value={form.calendar_id}
                onChange={(e) => setForm({ ...form, calendar_id: e.target.value })}
                data-testid="booking-link-calendar"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              >
                <option value="">Select a calendar…</option>
                {calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="bl-timezone" className="block text-xs font-medium text-gray-600">
                Timezone
              </label>
              <input
                id="bl-timezone"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                data-testid="booking-link-timezone"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>

            {(
              [
                ['duration_minutes', 'Duration (min)'],
                ['slot_increment_minutes', 'Slot every (min)'],
                ['buffer_before_minutes', 'Buffer before (min)'],
                ['buffer_after_minutes', 'Buffer after (min)'],
                ['min_notice_minutes', 'Minimum notice (min)'],
                ['max_advance_days', 'Bookable ahead (days)'],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label htmlFor={`bl-${field}`} className="block text-xs font-medium text-gray-600">
                  {label}
                </label>
                <input
                  id={`bl-${field}`}
                  type="number"
                  min={field.startsWith('buffer') || field === 'min_notice_minutes' ? 0 : 1}
                  value={form[field]}
                  onChange={(e) =>
                    setForm({ ...form, [field]: Number(e.target.value) })
                  }
                  data-testid={`booking-link-${field}`}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                />
              </div>
            ))}

            <div className="sm:col-span-2">
              <label htmlFor="bl-description" className="block text-xs font-medium text-gray-600">
                Description
              </label>
              <textarea
                id="bl-description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                data-testid="booking-link-description"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
              <p className="mt-2 text-xs text-gray-400">{WINDOW_HINT}</p>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="booking-link-save"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {saving ? 'Creating…' : 'Create link'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
        </div>
      ) : links.length === 0 ? (
        <div
          className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center"
          data-testid="booking-link-empty"
        >
          <Link2 className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            No booking links yet. Create one to start sharing your availability.
          </p>
        </div>
      ) : (
        <ul className="space-y-2" data-testid="booking-link-list">
          {links.map((link) => (
            <li
              key={link.id}
              data-testid="booking-link-item"
              className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <span className="truncate">{link.title}</span>
                  {!link.is_active && (
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                      Inactive
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs text-gray-400">
                  /book/{orgSlug}/{link.slug} · {link.duration_minutes} min
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => copyUrl(link)}
                  aria-label={`Copy link for ${link.title}`}
                  data-testid="booking-link-copy"
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                >
                  {copied === link.id ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(link)}
                  data-testid="booking-link-toggle"
                  className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                >
                  {link.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(link)}
                  aria-label={`Delete ${link.title}`}
                  data-testid="booking-link-delete"
                  className="rounded-lg p-2 text-gray-300 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
