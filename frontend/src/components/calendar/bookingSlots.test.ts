import {
  dayKey,
  formatTime,
  groupSlotsByDay,
} from '@/components/calendar/bookingSlots';
import type { BookingSlotDTO } from '@/lib/api/calendarApi';

function slot(start: string, end: string): BookingSlotDTO {
  return { start, end };
}

describe('bookingSlots grouping', () => {
  it('groups slots into calendar days', () => {
    const groups = groupSlotsByDay(
      [
        slot('2026-09-01T09:00:00Z', '2026-09-01T10:00:00Z'),
        slot('2026-09-01T11:00:00Z', '2026-09-01T12:00:00Z'),
        slot('2026-09-02T09:00:00Z', '2026-09-02T10:00:00Z'),
      ],
      'UTC',
    );
    expect(groups.map((g) => g.date)).toEqual(['2026-09-01', '2026-09-02']);
    expect(groups[0].slots).toHaveLength(2);
  });

  it('orders slots chronologically regardless of input order', () => {
    const groups = groupSlotsByDay(
      [
        slot('2026-09-01T15:00:00Z', '2026-09-01T16:00:00Z'),
        slot('2026-09-01T09:00:00Z', '2026-09-01T10:00:00Z'),
      ],
      'UTC',
    );
    expect(groups[0].slots.map((s) => s.start)).toEqual([
      '2026-09-01T09:00:00Z',
      '2026-09-01T15:00:00Z',
    ]);
  });

  it('groups by the display timezone, not UTC', () => {
    // 22:00Z on 1 Sept is already 08:00 on 2 Sept in Sydney. Grouping in UTC
    // would file this slot under the wrong day heading for the visitor.
    const groups = groupSlotsByDay(
      [slot('2026-09-01T22:00:00Z', '2026-09-01T23:00:00Z')],
      'Australia/Sydney',
    );
    expect(groups[0].date).toBe('2026-09-02');
  });

  it('returns an empty list for no slots', () => {
    expect(groupSlotsByDay([], 'UTC')).toEqual([]);
  });
});

describe('bookingSlots formatting', () => {
  it('dayKey resolves the date in the given zone', () => {
    expect(dayKey('2026-09-01T22:00:00Z', 'UTC')).toBe('2026-09-01');
    expect(dayKey('2026-09-01T22:00:00Z', 'Australia/Sydney')).toBe('2026-09-02');
    // Los Angeles is behind UTC, so an early-morning UTC instant is the day before.
    expect(dayKey('2026-09-01T02:00:00Z', 'America/Los_Angeles')).toBe('2026-08-31');
  });

  it('formatTime renders the local wall-clock time', () => {
    // 09:00Z is 19:00 in Sydney (UTC+10 in September).
    expect(formatTime('2026-09-01T09:00:00Z', 'Australia/Sydney')).toMatch(/7:00/);
    expect(formatTime('2026-09-01T09:00:00Z', 'UTC')).toMatch(/9:00/);
  });
});
