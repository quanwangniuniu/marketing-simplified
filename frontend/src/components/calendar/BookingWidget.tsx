'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Clock, Loader2, User } from 'lucide-react';
import {
  PublicBookingAPI,
  type BookingSlotDTO,
  type PublicBookingLinkDTO,
} from '@/lib/api/calendarApi';
import {
  detectTimezone,
  formatDayLabel,
  formatTime,
  groupSlotsByDay,
  timezoneLabel,
} from './bookingSlots';

interface BookingWidgetProps {
  orgSlug: string;
  linkSlug: string;
}

type Stage = 'loading' | 'picking' | 'confirming' | 'booked' | 'missing';

interface Confirmation {
  start: string;
  title: string;
}

/** Common zones offered alongside whatever the visitor's browser reports. */
const TIMEZONE_CHOICES = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Australia/Sydney',
];

function errorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    const first = Object.values(record)[0];
    if (typeof first === 'string') return first;
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  }
  return fallback;
}

export default function BookingWidget({ orgSlug, linkSlug }: BookingWidgetProps) {
  const [stage, setStage] = useState<Stage>('loading');
  const [link, setLink] = useState<PublicBookingLinkDTO | null>(null);
  const [timeZone, setTimeZone] = useState<string>('UTC');
  const [selected, setSelected] = useState<BookingSlotDTO | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', notes: '' });

  // Resolved after mount: the server has no idea what zone the visitor is in,
  // and reading it during render would differ between server and client HTML.
  useEffect(() => {
    setTimeZone(detectTimezone());
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await PublicBookingAPI.getAvailability(orgSlug, linkSlug);
      setLink(data);
      setStage('picking');
    } catch (err) {
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      if (statusCode === 404) {
        setStage('missing');
        return;
      }
      setError(errorMessage(err, 'Could not load availability. Please try again.'));
      setStage('picking');
    }
  }, [orgSlug, linkSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const dayGroups = useMemo(
    () => (link ? groupSlotsByDay(link.slots, timeZone) : []),
    [link, timeZone],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await PublicBookingAPI.createBooking(orgSlug, linkSlug, {
        name: form.name.trim(),
        email: form.email.trim(),
        start: selected.start,
        notes: form.notes.trim(),
      });
      setConfirmation({ start: result.start, title: result.title });
      setStage('booked');
    } catch (err) {
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      if (statusCode === 409) {
        // Someone took the slot while this page was open. Reload availability
        // so the visitor picks from what is actually free now.
        setError('That time was just taken. Please choose another slot.');
        setSelected(null);
        setStage('picking');
        void load();
      } else if (statusCode === 429) {
        setError('Too many booking attempts. Please try again later.');
      } else {
        setError(errorMessage(err, 'Could not complete the booking.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" data-testid="booking-loading">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (stage === 'missing') {
    return (
      <div
        className="mx-auto mt-24 max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center"
        data-testid="booking-missing"
      >
        <AlertCircle className="mx-auto h-8 w-8 text-gray-300" />
        <h1 className="mt-4 text-lg font-semibold text-gray-900">Link unavailable</h1>
        <p className="mt-2 text-sm text-gray-500">
          This booking link doesn&apos;t exist or is no longer accepting bookings.
        </p>
      </div>
    );
  }

  if (stage === 'booked' && confirmation) {
    return (
      <div
        className="mx-auto mt-24 max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center"
        data-testid="booking-confirmed"
      >
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <h1 className="mt-4 text-lg font-semibold text-gray-900">You&apos;re booked</h1>
        <p className="mt-2 text-sm text-gray-600">{confirmation.title}</p>
        <p className="mt-1 text-sm font-medium text-gray-900">
          {formatDayLabel(confirmation.start, timeZone)} at{' '}
          {formatTime(confirmation.start, timeZone)}
        </p>
        <p className="mt-1 text-xs text-gray-400">{timezoneLabel(timeZone)}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10" data-testid="booking-widget">
      <header className="mb-6 border-b border-gray-100 pb-6">
        <h1 className="text-xl font-semibold text-gray-900">{link?.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4 text-gray-400" />
            {link?.owner_name}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-gray-400" />
            {link?.duration_minutes} minutes
          </span>
        </div>
        {link?.description && (
          <p className="mt-3 text-sm text-gray-600">{link.description}</p>
        )}
      </header>

      {error && (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
          data-testid="booking-error"
        >
          {error}
        </div>
      )}

      <div className="mb-5 flex items-center gap-2">
        <label htmlFor="booking-timezone" className="text-xs font-medium text-gray-500">
          Times shown in
        </label>
        <select
          id="booking-timezone"
          value={timeZone}
          onChange={(e) => setTimeZone(e.target.value)}
          data-testid="booking-timezone"
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700"
        >
          {Array.from(new Set([timeZone, ...TIMEZONE_CHOICES])).map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </div>

      {stage === 'confirming' && selected ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-5"
          data-testid="booking-form"
        >
          <p className="mb-4 text-sm text-gray-600">
            Booking{' '}
            <span className="font-medium text-gray-900">
              {formatDayLabel(selected.start, timeZone)} at{' '}
              {formatTime(selected.start, timeZone)}
            </span>
          </p>

          <div className="space-y-3">
            <div>
              <label htmlFor="booking-name" className="block text-xs font-medium text-gray-600">
                Name
              </label>
              <input
                id="booking-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="booking-name"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="booking-email" className="block text-xs font-medium text-gray-600">
                Email
              </label>
              <input
                id="booking-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                data-testid="booking-email"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="booking-notes" className="block text-xs font-medium text-gray-600">
                Anything to share beforehand?
              </label>
              <textarea
                id="booking-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                data-testid="booking-notes"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setStage('picking');
              }}
              className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              data-testid="booking-submit"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {submitting ? 'Confirming…' : 'Confirm booking'}
            </button>
          </div>
        </form>
      ) : (
        <div data-testid="booking-slots">
          {dayGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">
                No times are available in the next couple of weeks.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {dayGroups.map((group) => (
                <section key={group.date}>
                  <h2 className="mb-2 text-sm font-medium text-gray-900">{group.label}</h2>
                  <div className="flex flex-wrap gap-2">
                    {group.slots.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => {
                          setSelected(slot);
                          setStage('confirming');
                          setError(null);
                        }}
                        data-testid="booking-slot"
                        data-slot-start={slot.start}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-gray-900 hover:text-gray-900"
                      >
                        {formatTime(slot.start, timeZone)}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
