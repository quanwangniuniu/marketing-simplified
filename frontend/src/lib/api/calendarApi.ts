import api from "../api";

export type CalendarViewType = "day" | "week" | "month" | "year" | "agenda";

export interface UserSummaryDTO {
  id: number;
  email: string;
  username: string;
  full_name: string;
}

export interface CalendarDTO {
  id: string;
  organization_id: string;
  project_id?: number | null;
  owner: UserSummaryDTO;
  name: string;
  description?: string | null;
  color: string;
  visibility: string;
  timezone: string;
  is_primary: boolean;
  location?: string | null;
}

export interface EventDTO {
  id: string;
  calendar_id?: string;
  title: string;
  description?: string;
  start_datetime: string;
  end_datetime: string;
  timezone?: string;
  is_all_day: boolean;
  is_recurring: boolean;
  color?: string;
  etag?: string;
}

export interface CalendarViewResponse {
  view_type: CalendarViewType;
  start_date: string;
  end_date: string;
  events: EventDTO[];
  calendars: CalendarDTO[];
}

export interface CalendarSubscriptionDTO {
  id: string;
  calendar: CalendarDTO | null;
  source_url: string | null;
  color_override: string | null;
  is_hidden: boolean;
}

export interface CreateCalendarPayload {
  name: string;
  color?: string;
  visibility?: string;
  timezone?: string;
  is_primary?: boolean;
  description?: string;
}

export const CalendarAPI = {
  listCalendars: () => api.get<CalendarDTO[]>("/api/calendars/"),

  createCalendar: (payload: CreateCalendarPayload) =>
    api.post<CalendarDTO>("/api/calendars/", payload),

  listSubscriptions: () =>
    api.get<CalendarSubscriptionDTO[]>("/api/subscriptions/"),

  updateSubscription: (
    subscriptionId: string,
    data: Partial<Pick<CalendarSubscriptionDTO, "color_override" | "is_hidden">>,
  ) =>
    api.patch<CalendarSubscriptionDTO>(
      `/api/subscriptions/${subscriptionId}/`,
      data,
    ),

  getDayView: (params: { date: string; calendar_ids?: string[] }) =>
    api.get<CalendarViewResponse>("/api/views/day/", {
      params: {
        date: params.date,
        calendar_ids: params.calendar_ids?.join(","),
      },
    }),

  getWeekView: (params: { start_date: string; calendar_ids?: string[] }) =>
    api.get<CalendarViewResponse>("/api/views/week/", {
      params: {
        start_date: params.start_date,
        calendar_ids: params.calendar_ids?.join(","),
      },
    }),

  getMonthView: (params: {
    year: number;
    month: number;
    calendar_ids?: string[];
  }) =>
    api.get<CalendarViewResponse>("/api/views/month/", {
      params: {
        year: params.year,
        month: params.month,
        calendar_ids: params.calendar_ids?.join(","),
      },
    }),

  getAgendaView: (params: {
    start_date: string;
    end_date?: string;
    calendar_ids?: string[];
  }) =>
    api.get<CalendarViewResponse>("/api/views/agenda/", {
      params: {
        start_date: params.start_date,
        end_date: params.end_date,
        calendar_ids: params.calendar_ids?.join(","),
      },
    }),

  createEvent: (payload: Partial<EventDTO>) =>
    api.post<EventDTO>("/api/events/", payload),

  // For now we do not send If-Match headers to avoid 412 conflicts
  // when the same user updates an event multiple times quickly.
  updateEvent: (eventId: string, payload: Partial<EventDTO>, _etag?: string) =>
    api.patch<EventDTO>(`/api/events/${eventId}/`, payload),

  deleteEvent: (eventId: string, _etag?: string) =>
    api.delete<void>(`/api/events/${eventId}/`),

  // Fetch system-derived calendar events (from Decisions and Tasks, read-only)
  getDerivedEvents: (params: { start: string; end: string }) =>
    api.get<{ count: number; results: DerivedCalendarEventDTO[] }>("/api/derived-events/", {
      params: {
        start: params.start,
        end: params.end,
      },
    }),
};

// Derived CalendarEvent from Decision/Task (read-only, system-generated)
export interface DerivedCalendarEventDTO {
  id: number;
  event_type: "decision" | "task" | "decision_review";
  title: string;
  description: string;  // User-friendly description with source entity details
  start_time: string;
  end_time: string | null;
  decision_id: number | null;
  task_id: number | null;
  review_id: number | null;
  project_id: number | null;  // For permission header on navigation
}

// Convert a DerivedCalendarEvent to EventDTO format for display in calendar
export function derivedEventToEventDTO(event: DerivedCalendarEventDTO): EventDTO {
  // Create a combined description that includes both user-friendly content and navigation metadata
  const userDescription = event.description || "";
  const navigationMetadata = JSON.stringify({
    isDerived: true,
    event_type: event.event_type,
    decision_id: event.decision_id,
    task_id: event.task_id,
    review_id: event.review_id,
    project_id: event.project_id,  // Used to build correct navigation URL with permission
  });
  
  // Combine user description with metadata, separated by a delimiter
  const combinedDescription = userDescription + "\n\n__METADATA__\n" + navigationMetadata;
  
  // Determine if this is an all-day event
  // An event is all-day if:
  // 1. It starts at 00:00:00 and ends at 23:59:59 (or similar end-of-day time)
  // 2. Or it spans multiple days with start at 00:00:00
  const startDate = new Date(event.start_time);
  const endDate = event.end_time ? new Date(event.end_time) : startDate;
  const isAllDay = startDate.getUTCHours() === 0 && startDate.getUTCMinutes() === 0 && startDate.getUTCSeconds() === 0 &&
    ((endDate.getUTCHours() === 23 && endDate.getUTCMinutes() === 59) || 
     (startDate.toDateString() !== endDate.toDateString())); // Multi-day event

  // For all-day events, convert to local date format to avoid timezone issues
  let startDateTime = event.start_time;
  let endDateTime = event.end_time;
  
  // If no end_time provided, set a default duration for point-in-time events
  if (!endDateTime) {
    const startTime = new Date(event.start_time);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Add 1 hour
    endDateTime = endTime.toISOString();
  }
  
  if (isAllDay) {
    // Convert UTC dates to local date strings to avoid timezone shifts
    const startLocalDate = startDate.getUTCFullYear() + '-' + 
      String(startDate.getUTCMonth() + 1).padStart(2, '0') + '-' + 
      String(startDate.getUTCDate()).padStart(2, '0');
    const endLocalDate = endDate.getUTCFullYear() + '-' + 
      String(endDate.getUTCMonth() + 1).padStart(2, '0') + '-' + 
      String(endDate.getUTCDate()).padStart(2, '0');
    
    startDateTime = startLocalDate + 'T00:00:00';
    endDateTime = endLocalDate + 'T23:59:59';
  }

  return {
    id: `derived-${event.id}`,  // Prefix to prevent ID conflicts with regular events
    title: event.title,
    start_datetime: startDateTime,
    end_datetime: endDateTime,
    is_all_day: isAllDay,
    is_recurring: false,
    color: eventTypeToColor(event.event_type),
    description: combinedDescription,
  };
}

// Map event type to display color
function eventTypeToColor(eventType: string): string {
  switch (eventType) {
    case "decision": return "#8B5CF6";        // Purple - Decision
    case "decision_review": return "#F59E0B"; // Orange - Review
    case "task": return "#10B981";            // Green - Task
    default: return "#6B7280";
  }
}

// Helper functions to extract information from derived event descriptions
export function extractUserDescription(eventDescription: string): string {
  if (!eventDescription) return "";
  
  const metadataDelimiter = "\n\n__METADATA__\n";
  const parts = eventDescription.split(metadataDelimiter);
  return parts[0] || "";
}

export function extractNavigationMetadata(eventDescription: string): any {
  if (!eventDescription) return null;
  
  const metadataDelimiter = "\n\n__METADATA__\n";
  const parts = eventDescription.split(metadataDelimiter);
  
  if (parts.length < 2) {
    // Fallback: try to parse the entire description as JSON (for backward compatibility)
    try {
      return JSON.parse(eventDescription);
    } catch {
      return null;
    }
  }
  
  try {
    return JSON.parse(parts[1]);
  } catch {
    return null;
  }
}