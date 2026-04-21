import { useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { CalendarAPI, type CalendarSubscriptionDTO, type EventDTO } from '@/lib/api/calendarApi';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type DayGroup = { dayKey: string; label: string; events: EventDTO[] };

function normalizeListResponse<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload;
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { results?: unknown[] }).results)
  ) {
    return (payload as { results: T[] }).results;
  }
  return [];
}

function groupEventsByDay(events: EventDTO[]): DayGroup[] {
  const byKey = new Map<string, EventDTO[]>();
  for (const ev of events) {
    const dt = new Date(ev.start_datetime);
    const key = format(dt, 'yyyy-MM-dd');
    const arr = byKey.get(key) ?? [];
    arr.push(ev);
    byKey.set(key, arr);
  }

  const keys = Array.from(byKey.keys()).sort();
  return keys.map((key) => {
    const eventsForDay = (byKey.get(key) ?? []).slice().sort((a, b) => {
      return new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();
    });
    const label = format(new Date(`${key}T00:00:00`), 'PP');
    return { dayKey: key, label, events: eventsForDay };
  });
}

export default function ActivitySidebarView({ selectedProjectId }: { selectedProjectId: number }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [calendarNameById, setCalendarNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setIsLoading(true);
      setError(null);
      try {
        const [calendarsResp, subsResp] = await Promise.all([
          CalendarAPI.listCalendars(),
          CalendarAPI.listSubscriptions(),
        ]);

        const calendars = normalizeListResponse<{ id: string; project_id?: number | null; name?: string }>(
          calendarsResp.data
        );
        const subs = normalizeListResponse<CalendarSubscriptionDTO>(subsResp.data);
        const subscribedCalendars = subs.map((s) => s.calendar).filter(Boolean) as Array<{
          id: string;
          project_id?: number | null;
          name?: string;
        }>;

        const byId = new Map<string, { id: string; project_id?: number | null; name?: string }>();
        for (const cal of [...calendars, ...subscribedCalendars]) {
          if (cal?.id) byId.set(cal.id, cal);
        }

        const projectCalendars = Array.from(byId.values()).filter(
          (c) => Number(c.project_id) === selectedProjectId
        );
        const calendarIds = projectCalendars.map((c) => c.id);
        const calNameMap: Record<string, string> = {};
        for (const c of projectCalendars) {
          if (c?.id) calNameMap[c.id] = c.name ?? c.id;
        }

        if (calendarIds.length === 0) {
          if (!cancelled) setEvents([]);
          return;
        }

        const start = startOfDay(new Date());
        const end = addDays(startOfDay(new Date()), 90);
        const agendaResp = await CalendarAPI.getAgendaView({
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          calendar_ids: calendarIds,
        });

        const now = new Date();
        const upcoming = (agendaResp.data?.events ?? []).filter((ev) => {
          const startAt = new Date(ev.start_datetime);
          return !Number.isNaN(startAt.getTime()) && startAt >= now;
        });
        if (!cancelled) {
          setEvents(upcoming);
          const namesFromAgenda: Record<string, string> = {};
          for (const cal of agendaResp.data?.calendars ?? []) {
            if (cal?.id) namesFromAgenda[cal.id] = cal.name ?? cal.id;
          }
          // Prefer names from the agenda response (authoritative), fall back to ids.
          setCalendarNameById({ ...calNameMap, ...namesFromAgenda });
        }
      } catch {
        if (!cancelled) setError('Could not load activity');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const groups = useMemo(() => groupEventsByDay(events), [events]);

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3CCED7]" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-sm text-gray-500">{error}</div>;
  }

  if (groups.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Activity
        </div>
        <div className="p-4 text-sm text-gray-500">No future activity</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
        Activity
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-gray-100">
          {groups.map((g) => (
            <div key={g.dayKey} className="px-3 py-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
                <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                {g.label}
              </div>
              <div className="mt-2 space-y-2">
                {g.events.map((ev) => {
                  const start = new Date(ev.start_datetime);
                  const timeLabel = ev.is_all_day ? 'All day' : format(start, 'p');
                  const dateLabel = format(start, 'PPpp');
                  const calendarLabel = ev.calendar_id ? calendarNameById[ev.calendar_id] : undefined;
                  const description = (ev.description ?? '').trim();
                  return (
                    <Popover key={ev.id}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={[
                            'w-full text-left rounded-lg border border-gray-200 bg-white px-3 py-2',
                            'hover:bg-gray-50 hover:border-gray-300',
                            'focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/40',
                          ].join(' ')}
                          aria-label={`View details for ${ev.title || 'activity'}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="text-[11px] text-gray-500 whitespace-nowrap pt-0.5">
                              {timeLabel}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {ev.title || '(Untitled)'}
                              </div>
                              {description ? (
                                <div className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                                  {description}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[320px]">
                        <div className="text-sm font-semibold text-gray-900">
                          {ev.title || '(Untitled)'}
                        </div>
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex gap-2">
                            <div className="w-20 text-gray-500">Date</div>
                            <div className="flex-1 text-gray-900">{dateLabel}</div>
                          </div>
                          <div className="flex gap-2">
                            <div className="w-20 text-gray-500">Project</div>
                            <div className="flex-1 text-gray-900">
                              {calendarLabel ? `${calendarLabel} (ID: ${selectedProjectId})` : `ID: ${selectedProjectId}`}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <div className="w-20 text-gray-500">Description</div>
                            <div className="flex-1 text-gray-900 whitespace-pre-wrap">
                              {description || '—'}
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

