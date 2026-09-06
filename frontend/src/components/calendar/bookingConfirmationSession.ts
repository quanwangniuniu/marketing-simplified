import type { CalendarEntry } from './calendarExport';

/**
 * The confirmation screen lives in React state on `/book/…`. Going to cancel
 * and then Back remounts the widget as a fresh picker unless we remember the
 * booking for this tab.
 */
export type StoredBookingConfirmation = {
  confirmation: CalendarEntry;
  feedUrl: string;
};

function storageKey(orgSlug: string, linkSlug: string): string {
  return `booking-confirmation:${orgSlug}:${linkSlug}`;
}

export function saveBookingConfirmation(
  orgSlug: string,
  linkSlug: string,
  value: StoredBookingConfirmation,
): void {
  try {
    sessionStorage.setItem(storageKey(orgSlug, linkSlug), JSON.stringify(value));
  } catch {
    // Private mode or a full store: the cancel page still works without this.
  }
}

export function readBookingConfirmation(
  orgSlug: string,
  linkSlug: string,
): StoredBookingConfirmation | null {
  try {
    const raw = sessionStorage.getItem(storageKey(orgSlug, linkSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBookingConfirmation;
    if (!parsed?.confirmation?.start || !parsed.confirmation.end || !parsed.confirmation.title) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearBookingConfirmation(orgSlug: string, linkSlug: string): void {
  try {
    sessionStorage.removeItem(storageKey(orgSlug, linkSlug));
  } catch {
    // ignore
  }
}
