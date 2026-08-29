import type { BookingSlotDTO } from '@/lib/api/calendarApi';

/**
 * Slot presentation helpers for the public booking widget (MED-284).
 *
 * The API returns UTC instants. A prospect thinks in their own timezone, and
 * the owner's day boundaries are in theirs, so grouping and labelling are done
 * explicitly in a chosen zone rather than relying on the runtime default.
 *
 * Pure functions, so the date arithmetic is testable without rendering.
 */

export interface DayGroup {
  /** Calendar day in the display timezone, as YYYY-MM-DD. */
  date: string;
  /** e.g. "Tuesday, 1 September" */
  label: string;
  slots: BookingSlotDTO[];
}

/** The visitor's timezone, falling back to UTC where unavailable. */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** YYYY-MM-DD for an instant, as seen in `timeZone`. */
export function dayKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));

  const lookup = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${lookup('year')}-${lookup('month')}-${lookup('day')}`;
}

/** e.g. "2:30 PM" */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** e.g. "Tuesday, 1 September" */
export function formatDayLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}

/**
 * Group slots into calendar days in `timeZone`, preserving chronological order.
 *
 * Grouping has to happen in the display zone: the same instant can fall on
 * different dates for the prospect and the owner, and slots near midnight would
 * otherwise land under the wrong heading.
 */
export function groupSlotsByDay(
  slots: BookingSlotDTO[],
  timeZone: string,
): DayGroup[] {
  const ordered = [...slots].sort((a, b) => a.start.localeCompare(b.start));
  const groups = new Map<string, DayGroup>();

  for (const slot of ordered) {
    const key = dayKey(slot.start, timeZone);
    const existing = groups.get(key);
    if (existing) {
      existing.slots.push(slot);
    } else {
      groups.set(key, {
        date: key,
        label: formatDayLabel(slot.start, timeZone),
        slots: [slot],
      });
    }
  }

  return Array.from(groups.values());
}

/** Short offset label for the timezone note, e.g. "GMT+10". */
export function timezoneLabel(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}
