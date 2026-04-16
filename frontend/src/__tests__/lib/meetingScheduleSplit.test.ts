import {
  isMeetingScheduledDayFullyPast,
  splitMeetingRowsBySchedule,
} from '@/lib/meetings/meetingScheduleSplit';
import type { MeetingListItem } from '@/types/meeting';

function row(partial: Partial<MeetingListItem> & { id: number }): MeetingListItem {
  return {
    title: 'T',
    summary: '',
    scheduled_date: null,
    meeting_type: 'X',
    meeting_type_slug: 'x',
    participants: [],
    tags: [],
    
    decision_count: 0,
    task_count: 0,
    generated_decisions: [],
    generated_tasks: [],
    related_decisions: [],
    related_tasks: [],
    is_archived: false,
    status: 'draft',
    ...partial,
  };
}

describe('meetingScheduleSplit', () => {
  it('treats undated meetings as incoming', () => {
    const now = new Date('2026-04-04T12:00:00');
    const m = row({ id: 1, scheduled_date: null });
    expect(isMeetingScheduledDayFullyPast(m, now)).toBe(false);
    const { incoming, completed } = splitMeetingRowsBySchedule([m], now);
    expect(incoming).toHaveLength(1);
    expect(completed).toHaveLength(0);
  });

  it('past calendar day → completed', () => {
    const now = new Date('2026-04-04T12:00:00');
    const m = row({ id: 1, scheduled_date: '2026-04-03' });
    expect(isMeetingScheduledDayFullyPast(m, now)).toBe(true);
    const { incoming, completed } = splitMeetingRowsBySchedule([m], now);
    expect(incoming).toHaveLength(0);
    expect(completed).toHaveLength(1);
  });

  it('today (date only) stays incoming until end of local day', () => {
    const now = new Date('2026-04-04T12:00:00');
    const m = row({ id: 1, scheduled_date: '2026-04-04' });
    expect(isMeetingScheduledDayFullyPast(m, now)).toBe(false);
  });

  it('tomorrow → incoming', () => {
    const now = new Date('2026-04-04T23:00:00');
    const m = row({ id: 1, scheduled_date: '2026-04-05' });
    expect(isMeetingScheduledDayFullyPast(m, now)).toBe(false);
  });

  it('after local end of scheduled day → completed', () => {
    const now = new Date('2026-04-04T23:59:59.999');
    const m = row({ id: 1, scheduled_date: '2026-04-04' });
    expect(isMeetingScheduledDayFullyPast(m, now)).toBe(false);
    const pastMidnight = new Date('2026-04-05T00:00:00');
    expect(isMeetingScheduledDayFullyPast(m, pastMidnight)).toBe(true);
  });
});
