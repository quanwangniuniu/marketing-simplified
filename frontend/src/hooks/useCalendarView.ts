import { useEffect, useState } from "react";
import { derivedEventToEventDTO, extractNavigationMetadata } from "@/lib/api/calendarApi";
import {
  CalendarAPI,
  CalendarDTO,
  CalendarViewType,
  EventDTO,
} from "@/lib/api/calendarApi";
import { addDays, startOfDay, startOfWeek } from "date-fns";

interface UseCalendarViewOptions {
  viewType: CalendarViewType;
  currentDate: Date;
  calendarIds?: string[];
  activeEventTypes?: string[];
}

interface UseCalendarViewResult {
  events: EventDTO[];
  calendars: CalendarDTO[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Cache stores all merged events (regular + derived) keyed by view/date/calendar.
const cache = new Map<string, { events: EventDTO[]; calendars: CalendarDTO[] }>();

// Build cache key from view type, date, and calendar IDs only.
// activeEventTypes is intentionally excluded so toggling filters
// does not trigger a new network request.
function buildCacheKey(opts: UseCalendarViewOptions): string {
  const { viewType, currentDate, calendarIds } = opts;
  const baseDate = startOfDay(currentDate).toISOString();
  const ids = (calendarIds || []).slice().sort().join(",");
  return `${viewType}:${baseDate}:${ids}`;
}

// Compute the [start, end) date range for a given view type and date.
function getDateRange(viewType: CalendarViewType, currentDate: Date): { start: string; end: string } {
  if (viewType === "day") {
    const start = startOfDay(currentDate);
    return {
      start: start.toISOString(),
      end: addDays(start, 1).toISOString(),
    };
  }
  if (viewType === "week") {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return {
      start: start.toISOString(),
      end: addDays(start, 7).toISOString(),
    };
  }
  if (viewType === "month") {
    return {
      start: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString(),
      end: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1).toISOString(),
    };
  }
  // agenda & year views
  const start = startOfDay(currentDate);
  return {
    start: start.toISOString(),
    end: addDays(start, viewType === "year" ? 365 : 7).toISOString(),
  };
}

export function useCalendarView(
  options: UseCalendarViewOptions,
): UseCalendarViewResult {
  // allEvents holds all unfiltered events (regular + derived).
  // Filtering by activeEventTypes is applied at return time, not stored here,
  // so toggling filters is instant and requires no network request.
  const [allEvents, setAllEvents] = useState<EventDTO[]>([]);
  const [calendars, setCalendars] = useState<CalendarDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Separate counter to force a refetch even when key hasn't changed.
  const [fetchTick, setFetchTick] = useState(0);

  const { viewType, currentDate, calendarIds } = options;
  const key = buildCacheKey(options);

  useEffect(() => {
    // ── Cancellation flag ──────────────────────────────────────────────────────
    // Prevents a slow in-flight request from overwriting state after the user
    // has already navigated to a different date/view (race condition fix).
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    // Return cached data immediately if available (cache cleared on refetch).
    const existing = cache.get(key);
    if (existing) {
      setAllEvents(existing.events);
      setCalendars(existing.calendars);
      setIsLoading(false);
      return () => { cancelled = true; };
    }

    // Build the primary calendar view request.
    const { start, end } = getDateRange(viewType, currentDate);

    let primaryRequest;
    if (viewType === "month") {
      primaryRequest = CalendarAPI.getMonthView({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
        calendar_ids: calendarIds,
      });
    } else {
      primaryRequest = CalendarAPI.getAgendaView({
        start_date: start,
        end_date: end,
        calendar_ids: calendarIds,
      });
    }

    primaryRequest
      .then(async (response) => {
        // Fetch system-derived events (auto-generated from Decisions and Tasks).
        let derivedEvents: EventDTO[] = [];
        try {
          const derivedResponse = await CalendarAPI.getDerivedEvents({ start, end });
          derivedEvents = derivedResponse.data.results.map(derivedEventToEventDTO);
        } catch {
          // Derived event fetch failure should not block the main calendar display.
          console.warn("Failed to load derived calendar events");
        }

        // Guard: discard result if the hook has already moved to a different view/date.
        if (cancelled) return;

        // Merge regular and derived events; cache without filtering so that
        // toggling activeEventTypes is instant (no re-fetch needed).
        const merged = [...response.data.events, ...derivedEvents];
        cache.set(key, { events: merged, calendars: response.data.calendars });
        setAllEvents(merged);
        setCalendars(response.data.calendars);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err : new Error("Failed to load calendar view"),
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    // Cleanup: mark this request as cancelled when the effect re-runs or unmounts.
    return () => {
      cancelled = true;
    };
    // fetchTick is included so that refetch() (which increments it) triggers a reload
    // even when the key hasn't changed (e.g. same date/view after a Decision is deleted).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fetchTick]);

  const refetch = () => {
    // Clear entire cache so the next load always fetches fresh data from the server.
    cache.clear();
    // Increment tick to force the useEffect to re-run even if key is unchanged.
    setFetchTick((t) => t + 1);
  };

  // ── Client-side filtering ──────────────────────────────────────────────────
  // Filter events by activeEventTypes at return time (pure client-side, no network request).
  // Regular (non-derived) events are always shown regardless of filter state.
  // Derived events are shown only if their event_type is in activeEventTypes.
  const activeEventTypes = options.activeEventTypes;
  const filteredEvents = allEvents.filter((e) => {
    const meta = extractNavigationMetadata(e.description || "");
    if (meta && meta.isDerived) {
      if (!activeEventTypes || activeEventTypes.length === 0) return false;
      return activeEventTypes.includes(meta.event_type);
    }
    // Non-derived (regular) events are always visible.
    return true;
  });

  return { events: filteredEvents, calendars, isLoading, error, refetch };
}