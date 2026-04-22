'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, startOfWeek } from "date-fns";
import toast from "react-hot-toast";
import { CalendarAPI, extractNavigationMetadata } from "@/lib/api/calendarApi";
import type { CalendarDTO, CalendarViewType, EventDTO } from "@/lib/api/calendarApi";
import { googleCalendarApi } from "@/lib/api/googleCalendarApi";
import type { GoogleCalendarStatus } from "@/lib/api/googleCalendarApi";
import { GoogleCalendarConnectedBadge } from "@/components/google-calendar/GoogleCalendarConnectedBadge";
import { useCalendarView } from "@/hooks/useCalendarView";
import { CalendarToolbar } from "@/components/calendar-v2/CalendarToolbar";
import { CalendarSidebarContainer } from "@/components/calendar-v2/CalendarSidebarContainer";
import { CalendarViewRouter } from "@/components/calendar-v2/CalendarViews";
import { EventDialogContainer } from "@/components/calendar-v2/EventDialogContainer";
import type { CalendarDialogMode, EventPanelPosition } from "@/components/calendar-v2/types";
import { List, Loader2, RefreshCw } from "lucide-react";
import {
  CALENDAR_FILTER_STORAGE_KEY,
  VIEW_LABELS,
  extractCalendarIdFromStoredValue,
  sameCalendarIdList,
} from "@/components/calendar-v2/utils";

const ACTIVITY_FILTER_STORAGE_KEY = "calendar-v2:activity-filter";

function loadActivityFilter(): Set<string> {
  if (typeof window === "undefined") {
    return new Set(["decision", "task"]);
  }
  try {
    const raw = window.localStorage.getItem(ACTIVITY_FILTER_STORAGE_KEY);
    if (!raw) {
      return new Set(["decision", "task"]);
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v) => typeof v === "string"));
    }
  } catch {
    // Fall through to default.
  }
  return new Set(["decision", "task"]);
}

export default function CalendarPageContent() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<CalendarViewType>("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<string[] | undefined>(undefined);
  const [hasLoadedCalendarFilter, setHasLoadedCalendarFilter] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<CalendarDialogMode>("create");
  const [dialogStart, setDialogStart] = useState<Date | null>(null);
  const [dialogEnd, setDialogEnd] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventDTO | null>(null);
  const [panelPosition, setPanelPosition] = useState<EventPanelPosition | null>(null);
  const [viewSwitcherOpen, setViewSwitcherOpen] = useState(false);

  const [activeEventTypes, setActiveEventTypes] = useState<Set<string>>(() =>
    loadActivityFilter(),
  );
  const viewSwitcherRef = useRef<HTMLDivElement>(null);
  const [gcalStatus, setGcalStatus] = useState<GoogleCalendarStatus | null>(null);
  const [gcalSyncing, setGcalSyncing] = useState(false);
  const [primaryCalendar, setPrimaryCalendar] = useState<CalendarDTO | null>(null);

  const refreshGcalStatus = useCallback(() => {
    googleCalendarApi
      .getStatus()
      .then((s) => setGcalStatus(s))
      .catch(() => setGcalStatus(null));
  }, []);

  useEffect(() => {
    refreshGcalStatus();
  }, [refreshGcalStatus]);

  useEffect(() => {
    let cancelled = false;
    CalendarAPI.listCalendars()
      .then((res) => {
        const raw = res.data as CalendarDTO[] | { results?: CalendarDTO[] };
        const list = Array.isArray(raw) ? raw : raw.results ?? [];
        if (cancelled) {
          return;
        }
        setPrimaryCalendar(list.find((c) => c.is_primary) ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setPrimaryCalendar(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        refreshGcalStatus();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshGcalStatus]);

  const handleAskAgentFromCalendar = useCallback(() => {
    const ctx = {
      type: "calendar" as const,
      calendarIds: visibleCalendarIds ?? [],
      currentView,
      currentDate: format(currentDate, "yyyy-MM-dd"),
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    sessionStorage.setItem("agent-calendar-context", JSON.stringify(ctx));
    sessionStorage.removeItem("agent-session-id");
    router.push("/agent");
  }, [visibleCalendarIds, currentView, currentDate, router]);

  const handleAskAgentFromEvent = useCallback(
    (event: EventDTO) => {
      const ctx = {
        type: "event" as const,
        eventId: event.id,
        eventTitle: event.title || "(No title)",
        calendarId: event.calendar_id,
        startDatetime: event.start_datetime,
        endDatetime: event.end_datetime,
        description: event.description ?? "",
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      sessionStorage.setItem("agent-calendar-context", JSON.stringify(ctx));
      sessionStorage.removeItem("agent-session-id");
      router.push("/agent");
    },
    [router],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      ACTIVITY_FILTER_STORAGE_KEY,
      JSON.stringify(Array.from(activeEventTypes)),
    );
  }, [activeEventTypes]);

  const toggleActivityType = useCallback((type: string) => {
    setActiveEventTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const { events, calendars, isLoading, error, refetch } = useCalendarView({
    viewType: currentView,
    currentDate,
    calendarIds: visibleCalendarIds,
    activeEventTypes: Array.from(activeEventTypes),
  });

  const handleGcalSync = useCallback(async () => {
    setGcalSyncing(true);
    try {
      await googleCalendarApi.syncNow();
      toast.success("Synced with Google Calendar.");
      refetch();
      refreshGcalStatus();
    } catch {
      toast.error("Sync failed. Check your connection and try again.");
    } finally {
      setGcalSyncing(false);
    }
  }, [refetch, refreshGcalStatus]);

  useEffect(() => {
    const consumePending = () => {
      const pending = localStorage.getItem("calendar-events-updated");
      if (pending) {
        localStorage.removeItem("calendar-events-updated");
        refetch();
      }
    };

    consumePending();

    const handleRefresh = () => refetch();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "calendar-events-updated") {
        localStorage.removeItem("calendar-events-updated");
        refetch();
      }
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) consumePending();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        consumePending();
        refetch();
      }
    };

    window.addEventListener("agent:calendar-updated", handleRefresh);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("agent:calendar-updated", handleRefresh);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refetch]);

  useEffect(() => {
    refetch();
  }, []);

  const handleVisibleCalendarsChange = useCallback(
    (calendarIds: string[] | undefined) => {
      setVisibleCalendarIds((current) =>
        sameCalendarIdList(current, calendarIds) ? current : calendarIds,
      );
    },
    [],
  );

  const selectedCalendarId = useMemo(
    () =>
      visibleCalendarIds && visibleCalendarIds.length === 1
        ? visibleCalendarIds[0]
        : null,
    [visibleCalendarIds],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedValue = window.localStorage.getItem(
      CALENDAR_FILTER_STORAGE_KEY,
    );
    const storedCalendarId = extractCalendarIdFromStoredValue(storedValue);
    if (storedCalendarId) {
      setVisibleCalendarIds([storedCalendarId]);
    } else if (storedValue) {
      window.localStorage.removeItem(CALENDAR_FILTER_STORAGE_KEY);
    }
    setHasLoadedCalendarFilter(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedCalendarFilter || typeof window === "undefined") {
      return;
    }
    if (visibleCalendarIds && visibleCalendarIds.length === 1) {
      window.localStorage.setItem(
        CALENDAR_FILTER_STORAGE_KEY,
        visibleCalendarIds[0],
      );
      return;
    }
    window.localStorage.removeItem(CALENDAR_FILTER_STORAGE_KEY);
  }, [hasLoadedCalendarFilter, visibleCalendarIds]);

  const headerTitle = useMemo(() => {
    if (currentView === "year") {
      return format(currentDate, "yyyy");
    }
    if (currentView === "month" || currentView === "agenda") {
      return format(currentDate, "MMMM yyyy");
    }
    if (currentView === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = addDays(start, 6);
      const sameMonth = start.getMonth() === end.getMonth();
      const sameYear = start.getFullYear() === end.getFullYear();

      if (sameMonth && sameYear) {
        return `${format(start, "MMMM d")} - ${format(end, "d, yyyy")}`;
      }
      if (sameYear) {
        return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
      }
      return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
    }
    return format(currentDate, "EEEE, MMMM d, yyyy");
  }, [currentView, currentDate]);

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleOffset = useCallback((direction: "prev" | "next") => {
    const multiplier = direction === "next" ? 1 : -1;

    if (currentView === "day") {
      setCurrentDate((prev) => addDays(prev, 1 * multiplier));
    } else if (currentView === "week") {
      setCurrentDate((prev) => addDays(prev, 7 * multiplier));
    } else if (currentView === "month") {
      const next = new Date(currentDate);
      next.setMonth(next.getMonth() + 1 * multiplier);
      setCurrentDate(next);
    } else if (currentView === "year") {
      const next = new Date(currentDate);
      next.setFullYear(next.getFullYear() + 1 * multiplier);
      setCurrentDate(next);
    } else {
      setCurrentDate((prev) => addDays(prev, 7 * multiplier));
    }
  }, [currentDate, currentView]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const tag = target.tagName.toLowerCase();
      const isTypingElement =
        tag === "input" ||
        tag === "textarea" ||
        target.getAttribute("contenteditable") === "true";
      if (isTypingElement) return;

      if (event.key === "t" || event.key === "T") {
        event.preventDefault();
        handleToday();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleOffset("prev");
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleOffset("next");
        return;
      }
      if (event.key === "d" || event.key === "D") {
        event.preventDefault();
        setCurrentView("day");
        return;
      }
      if (event.key === "w" || event.key === "W") {
        event.preventDefault();
        setCurrentView("week");
        return;
      }
      if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        setCurrentView("month");
        return;
      }
      if (event.key === "y" || event.key === "Y") {
        event.preventDefault();
        setCurrentView("year");
        return;
      }
      if (event.key === "a" || event.key === "A") {
        event.preventDefault();
        setCurrentView("agenda");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOffset]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        viewSwitcherRef.current &&
        !viewSwitcherRef.current.contains(event.target as Node)
      ) {
        setViewSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden" data-testid="calendar-v2-root">
      <CalendarToolbar
        headerTitle={headerTitle}
        currentView={currentView}
        viewSwitcherOpen={viewSwitcherOpen}
        viewSwitcherRef={viewSwitcherRef}
        onToggleViewSwitcher={() => setViewSwitcherOpen((o) => !o)}
        onSelectView={(view) => {
          setCurrentView(view);
          setViewSwitcherOpen(false);
        }}
        onToday={handleToday}
        onOffset={handleOffset}
        onAskAgent={handleAskAgentFromCalendar}
      />

      {gcalStatus?.connected && (gcalStatus.needs_reconnect || gcalStatus.last_error_message) ? (
        <div className="mx-4 mt-2 flex shrink-0 items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          <span>
            {gcalStatus.last_error_message ||
              "Google Calendar authorization expired or was revoked. Reconnect in Settings."}
          </span>
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="shrink-0 rounded-md bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800"
          >
            Open Settings
          </button>
        </div>
      ) : null}

      {gcalStatus?.connected && !gcalStatus.needs_reconnect && !gcalStatus.last_error_message ? (
        <div className="mx-4 mt-2 flex shrink-0 flex-wrap items-center gap-2">
          <GoogleCalendarConnectedBadge googleEmail={gcalStatus.google_email} />
          <button
            type="button"
            onClick={handleGcalSync}
            disabled={gcalSyncing}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-400 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {gcalSyncing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Syncing…
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Sync with Google
              </>
            )}
          </button>
        </div>
      ) : null}

      <div className="flex flex-1 overflow-hidden">
        <CalendarSidebarContainer
          currentDate={currentDate}
          onVisibleCalendarsChange={handleVisibleCalendarsChange}
          onDateChange={setCurrentDate}
          selectedCalendarId={selectedCalendarId}
          activeEventTypes={activeEventTypes}
          onToggleActivityType={toggleActivityType}
        />

        <section className="flex-1 overflow-auto bg-white" data-testid="calendar-v2-canvas">
          <CalendarViewRouter
            currentView={currentView}
            currentDate={currentDate}
            events={events}
            calendars={calendars}
            isLoading={isLoading}
            error={error}
            onTimeSlotClick={(start, position) => {
              const end = new Date(start);
              end.setHours(start.getHours() + 1);
              setDialogMode("create");
              setEditingEvent(null);
              setDialogStart(start);
              setDialogEnd(end);
              setPanelPosition(position);
              setIsDialogOpen(true);
            }}
            onEventClick={(event, position) => {
              const meta = extractNavigationMetadata(event.description || "");
              if (meta && meta.isDerived) {
                if (meta.decision_id) {
                  const query = meta.project_id ? `?project_id=${meta.project_id}` : '';
                  router.push(`/decisions/${meta.decision_id}${query}`);
                  return;
                }
                if (meta.task_id) {
                  router.push(`/tasks/${meta.task_id}`);
                  return;
                }
              }
              setDialogMode("view");
              setEditingEvent(event);
              setDialogStart(new Date(event.start_datetime));
              setDialogEnd(new Date(event.end_datetime));
              setPanelPosition(position);
              setIsDialogOpen(true);
            }}
            onEventTimeChange={async (event, start, end) => {
              if (event.id.toString().startsWith("derived-")) {
                return;
              }
              try {
                await CalendarAPI.updateEvent(
                  event.id,
                  {
                    start_datetime: start.toISOString(),
                    end_datetime: end.toISOString(),
                    timezone: event.timezone,
                    calendar_id: event.calendar_id,
                  },
                  event.etag,
                );
                await refetch();
              } catch {
                toast.error("Failed to update event time");
              }
            }}
            onDaySelect={(day) => {
              setCurrentDate(day);
              setCurrentView("day");
            }}
          />

          {currentView !== "week" &&
            currentView !== "day" &&
            currentView !== "month" &&
            currentView !== "agenda" &&
            currentView !== "year" && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500">
              <List className="h-6 w-6" />
              <p className="text-sm">
                {VIEW_LABELS[currentView]} view layout will be implemented in
                later steps.
              </p>
            </div>
          )}
        </section>

        <EventDialogContainer
          key={editingEvent?.id ?? (isDialogOpen ? "create" : "closed")}
          open={isDialogOpen}
          mode={dialogMode}
          onModeChange={setDialogMode}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setPanelPosition(null);
            }
          }}
          start={dialogStart}
          end={dialogEnd}
          event={editingEvent}
          calendars={calendars}
          primaryCalendar={primaryCalendar}
          preferredCalendarId={selectedCalendarId}
          position={panelPosition}
          onAskAgent={handleAskAgentFromEvent}
          onSave={async (payload) => {
            try {
              await payload.action();
              await refetch();
              setIsDialogOpen(false);
            } catch (err: any) {
              toast.error("Failed to save event");
            }
          }}
          onDelete={async (eventToDelete) => {
            try {
              await CalendarAPI.deleteEvent(eventToDelete.id, eventToDelete.etag);
              await refetch();
              setIsDialogOpen(false);
            } catch (err: any) {
              toast.error("Failed to delete event");
            }
          }}
        />
      </div>
    </div>
  );
}
