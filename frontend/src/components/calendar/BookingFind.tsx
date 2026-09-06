'use client';

import { useState } from 'react';
import { ArrowLeft, CalendarDays, Loader2 } from 'lucide-react';
import { PublicBookingAPI, type FoundBookingDTO } from '@/lib/api/calendarApi';
import { formatDayLabel, formatTime } from './bookingSlots';

type LookupKind = 'name' | 'email' | 'phone';

const KINDS: { id: LookupKind; label: string; type: string }[] = [
  { id: 'name', label: 'Name', type: 'text' },
  { id: 'email', label: 'Email', type: 'email' },
  { id: 'phone', label: 'Phone', type: 'tel' },
];

interface BookingFindProps {
  orgSlug: string;
  linkSlug: string;
  timeZone: string;
  onBack: () => void;
}

/**
 * Name, email, or phone — whichever they still remember — is enough to
 * find the booking if the confirmation mail never arrived.
 */
export default function BookingFind({
  orgSlug,
  linkSlug,
  timeZone,
  onBack,
}: BookingFindProps) {
  const [kind, setKind] = useState<LookupKind>('email');
  const [value, setValue] = useState('');
  const [bookings, setBookings] = useState<FoundBookingDTO[] | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (working) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    setWorking(true);
    setError(null);
    try {
      const result = await PublicBookingAPI.lookupBookings(orgSlug, linkSlug, {
        [kind]: trimmed,
      });
      setBookings(result.bookings);
    } catch {
      setError('Could not look that up. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      className="mx-auto mt-24 max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
      data-testid="booking-find"
    >
      <button
        type="button"
        onClick={onBack}
        data-testid="booking-find-back"
        className="mb-4 flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>
      <CalendarDays className="mx-auto h-8 w-8 text-gray-300" />
      <h1 className="mt-4 text-center text-lg font-semibold text-gray-900">
        Find your booking
      </h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        Use the name, email, or phone you booked with. One is enough.
      </p>
      <form onSubmit={search} className="mt-6 space-y-3">
        <div className="flex rounded-lg border border-gray-200 p-0.5" role="tablist">
          {KINDS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={kind === option.id}
              onClick={() => {
                setKind(option.id);
                setValue('');
                setBookings(null);
                setError(null);
              }}
              data-testid={`booking-find-kind-${option.id}`}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
                kind === option.id
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="block text-left text-xs font-medium text-gray-600">
          {KINDS.find((option) => option.id === kind)?.label}
          <input
            type={KINDS.find((option) => option.id === kind)?.type}
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
            data-testid="booking-find-value"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          />
        </label>
        {error && (
          <p className="text-sm text-amber-700" data-testid="booking-find-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={working}
          data-testid="booking-find-submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#3CCED7] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2AB5BD] disabled:opacity-60"
        >
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find booking'}
        </button>
      </form>
      {bookings && (
        <div className="mt-6 border-t border-gray-100 pt-5" data-testid="booking-find-results">
          {bookings.length === 0 ? (
            <p className="text-center text-sm text-gray-500">
              No upcoming booking matches that on this link.
            </p>
          ) : (
            <ul className="space-y-3">
              {bookings.map((booking) => (
                <li
                  key={booking.cancel_token}
                  className="rounded-lg border border-gray-100 px-3 py-3 text-left"
                >
                  <p className="text-sm font-medium text-gray-900">{booking.title}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatDayLabel(booking.start, timeZone)} at{' '}
                    {formatTime(booking.start, timeZone)}
                  </p>
                  <a
                    href={`/book/${encodeURIComponent(orgSlug)}/${encodeURIComponent(linkSlug)}/cancel?token=${encodeURIComponent(booking.cancel_token)}`}
                    data-testid="booking-find-cancel"
                    className="mt-2 inline-block text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-900"
                  >
                    Cancel this booking
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
