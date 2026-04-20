"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, startOfWeek } from "date-fns";
import toast from "react-hot-toast";
import Layout from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CalendarAPI, extractNavigationMetadata } from "@/lib/api/calendarApi";
import type { CalendarViewType, EventDTO } from "@/lib/api/calendarApi";
import { useCalendarView } from "@/hooks/useCalendarView";
import { CalendarToolbar } from "@/components/calendar/CalendarToolbar";
import { CalendarSidebarContainer } from "@/components/calendar/CalendarSidebarContainer";
import { CalendarViewRouter } from "@/components/calendar/CalendarViews";
import { EventDialogContainer } from "@/components/calendar/EventDialogContainer";
import type { CalendarDialogMode, EventPanelPosition } from "@/components/calendar/types";
import { List } from "lucide-react";
import {
  CALENDAR_FILTER_STORAGE_KEY,
  VIEW_LABELS,
  extractCalendarIdFromStoredValue,
  sameCalendarIdList,
} from "@/components/calendar/utils";

function CalendarPageContent() {
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
  const [panelPosition, setPanelPosition] =
    useState<EventPanelPosition | null>(null);
  const [viewSwitcherOpen, setViewSwitcherOpen] = useState(false);

  // SMP-400: active event type filter state
  // Bug 2 fix: removed "decision_review" from default active types and filter bar
  const [activeEventTypes, setActiveEventTypes] = useState<Set<string>>(
    new Set(["decision", "task"])
  );
  const viewSwitcherRef = useRef<HTMLDivElement>(null);

  const { events, calendars, isLoading, error, refetch } = useCalendarView({
    viewType: currentView,
    currentDate,
    calendarIds: visibleCalendarIds,
    activeEventTypes: Array.from(activeEventTypes),
  });

  // Auto-refresh calendar data when:
  // 1. Agent creates/updates a calendar event (custom event + localStorage flag)
  // 2. User returns to this tab/page (visibilitychange, pageshow, focus)
  //
  // NOTE: Only ONE set of listeners is registered here to avoid duplicate refetch calls.
  // A previous version had an additional useEffect with duplicate visibilitychange/focus/pageshow
  // listeners and a 5-second interval — both have been removed.
  React.useEffect(() => {
    const consumePending = () => {
      const pending = localStorage.getItem("calendar-events-updated");
      if (pending) {
        localStorage.removeItem("calendar-events-updated");
        refetch();
      }
    };

    // On mount: consume any pending flag written before this page loaded (navigation case)
    consumePending();

    const handleRefresh = () => refetch();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "calendar-events-updated") {
        localStorage.removeItem("calendar-events-updated");
        refetch();
      }
    };

    // Handle bfcache restores (browser back button)
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) consumePending();
    };

    // Refetch when tab becomes visible again (e.g. returning from Decision/Task detail)
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

  // Refetch calendar events on mount so returning from detail pages shows fresh data
  React.useEffect(() => {
    refetch();
  }, []);

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

  const handleAskAgentFromEvent = useCallback((event: EventDTO) => {
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
  }, [router]);

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

  React.useEffect(() => {
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

  React.useEffect(() => {
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

  React.useEffect(() => {
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

  React.useEffect(() => {
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
    <Layout>
      <div className="flex min-h-screen flex-col bg-[#f8fafd]">
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

        {/* SMP-400: Derived event type filter bar
            Bug 2 fix: "Reviews" (decision_review) filter has been removed.
            Only Decision and Task filters are shown. Filtering is pure client-side
            via activeEventTypes passed to useCalendarView. */}
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-white">
          <span className="text-xs text-gray-500 font-medium">Show:</span>
          {[
            { type: "decision", label: "Decisions", color: "#8B5CF6" },
            { type: "task", label: "Tasks", color: "#10B981" },
          ].map(({ type, label, color }) => {
            const isActive = activeEventTypes.has(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setActiveEventTypes((prev) => {
                    const next = new Set(prev);
                    if (next.has(type)) {
                      next.delete(type);
                    } else {
                      next.add(type);
                    }
                    return next;
                  });
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  isActive
                    ? "text-white border-transparent"
                    : "text-gray-500 bg-white border-gray-300"
                }`}
                style={isActive ? { backgroundColor: color, borderColor: color } : {}}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: isActive ? "white" : color }}
                />
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 overflow-hidden">
          <CalendarSidebarContainer
            currentDate={currentDate}
            onVisibleCalendarsChange={handleVisibleCalendarsChange}
            onDateChange={setCurrentDate}
            selectedCalendarId={selectedCalendarId}
          />

          <section className="flex-1 overflow-auto bg-white rounded-3xl mb-4">
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
                // Check if this is a system-derived event (from Decision or Task)
                const meta = extractNavigationMetadata(event.description || "");
                if (meta && meta.isDerived) {
                  // Navigate to Decision detail page with project_id for permission
                  if (meta.decision_id) {
                    const query = meta.project_id ? `?project_id=${meta.project_id}` : '';
                    router.push(`/decisions-v2/${meta.decision_id}${query}`);
                    return;
                  }
                  // Navigate to Task detail page
                  if (meta.task_id) {
                    router.push(`/tasks/${meta.task_id}`);
                    return;
                  }
                }
                // Regular event: open the event detail dialog
                setDialogMode("view");
                setEditingEvent(event);
                setDialogStart(new Date(event.start_datetime));
                setDialogEnd(new Date(event.end_datetime));
                setPanelPosition(position);
                setIsDialogOpen(true);
              }}
              onEventTimeChange={async (event, start, end) => {
                // Derived events are read-only, do not allow time changes
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
            preferredCalendarId={selectedCalendarId}
            position={panelPosition}
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
            onAskAgent={handleAskAgentFromEvent}
          />
        </div>
      </div>
    </Layout>
  );
}

export default function CalendarPage() {
  return (
    <ProtectedRoute>
      <CalendarPageContent />
    </ProtectedRoute>
  );
}