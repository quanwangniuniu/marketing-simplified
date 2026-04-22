import type { CalendarViewType } from "@/lib/api/calendarApi";
import type { EventPanelPosition } from "@/components/calendar-v2/types";

export const VIEW_LABELS: Record<CalendarViewType, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
  agenda: "Agenda",
};

export const VIEW_SHORTCUTS: Record<CalendarViewType, string> = {
  day: "D",
  week: "W",
  month: "M",
  year: "Y",
  agenda: "A",
};

export const CALENDAR_FILTER_STORAGE_KEY = "calendar:selected_calendar_id";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function extractCalendarIdFromStoredValue(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const toValidId = (value: unknown): string | null => {
    if (typeof value !== "string") {
      return null;
    }
    const id = value.trim();
    if (!id) {
      return null;
    }
    return UUID_PATTERN.test(id) ? id : null;
  };

  const direct = toValidId(trimmed);
  if (direct) {
    return direct;
  }

  if (
    trimmed.startsWith("[") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith('"')
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return toValidId(parsed[0]);
      }
      if (typeof parsed === "object" && parsed) {
        const fromCalendarId = toValidId(
          (parsed as { calendarId?: unknown }).calendarId,
        );
        if (fromCalendarId) {
          return fromCalendarId;
        }
        return toValidId((parsed as { id?: unknown }).id);
      }
      return toValidId(parsed);
    } catch {
      return null;
    }
  }

  return null;
}

export function sameCalendarIdList(
  a: string[] | undefined,
  b: string[] | undefined,
): boolean {
  if (a === b) {
    return true;
  }
  if (!a && !b) {
    return true;
  }
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function computePanelPosition(
  rect: DOMRect | null,
  view?: CalendarViewType,
): EventPanelPosition {
  const panelWidth = 420;
  const panelHeight = 388;
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 768;

  if (view === "day" || !rect) {
    const top = Math.max(0, (viewportHeight - panelHeight) / 2);
    const left = Math.max(0, (viewportWidth - panelWidth) / 2);
    return { top, left };
  }

  const margin = 16;

  let left = rect.right + margin;
  if (left + panelWidth > viewportWidth - margin) {
    left = rect.left - panelWidth - margin;
  }
  left = Math.max(margin, Math.min(left, viewportWidth - panelWidth - margin));

  let top = rect.top;
  if (top < margin) {
    top = rect.bottom + margin;
  } else if (top + panelHeight > viewportHeight - margin) {
    top = rect.bottom - panelHeight - margin;
  }
  top = Math.max(margin, Math.min(top, viewportHeight - panelHeight - margin));

  return { top, left };
}
