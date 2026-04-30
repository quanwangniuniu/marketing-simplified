import React, { useCallback, useMemo } from "react";
import { format } from "date-fns";
import {
  AlignLeft,
  Calendar as CalendarIcon,
  Clock,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { CalendarAPI, extractUserDescription } from "@/lib/api/calendarApi";
import type { CalendarDTO, EventDTO } from "@/lib/api/calendarApi";
import type { CalendarDialogMode, EventPanelPosition } from "@/components/calendar/types";

type EventPanelDialogProps = {
  open: boolean;
  mode: CalendarDialogMode;
  onModeChange: (mode: CalendarDialogMode) => void;
  onOpenChange: (open: boolean) => void;
  start: Date | null;
  end: Date | null;
  event: EventDTO | null;
  calendars: CalendarDTO[];
  primaryCalendar?: CalendarDTO | null;
  preferredCalendarId?: string | null;
  onSave: (payload: { action: () => Promise<void> }) => Promise<void>;
  onDelete?: (event: EventDTO) => Promise<void>;
  onAskAgent?: (event: EventDTO) => void;
  position: EventPanelPosition | null;
};

export function EventPanelDialog({
  open,
  mode,
  onModeChange,
  onOpenChange,
  start,
  end,
  event,
  calendars,
  primaryCalendar = null,
  preferredCalendarId,
  onSave,
  onDelete,
  onAskAgent,
  position,
}: EventPanelDialogProps) {
  const mergedCalendars = useMemo(() => {
    if (!primaryCalendar) {
      return calendars;
    }
    if (calendars.some((c) => c.id === primaryCalendar.id)) {
      return calendars;
    }
    return [primaryCalendar, ...calendars];
  }, [calendars, primaryCalendar]);

  const resolveDefaultCalendarId = useCallback(
    (eventCalendarId?: string | null) => {
      const availableIds = new Set(mergedCalendars.map((cal) => cal.id));
      if (eventCalendarId && availableIds.has(eventCalendarId)) {
        return eventCalendarId;
      }
      if (
        mode === "create" &&
        primaryCalendar?.id &&
        availableIds.has(primaryCalendar.id)
      ) {
        return primaryCalendar.id;
      }
      if (preferredCalendarId && availableIds.has(preferredCalendarId)) {
        return preferredCalendarId;
      }
      return mergedCalendars[0]?.id || "";
    },
    [mergedCalendars, mode, preferredCalendarId, primaryCalendar],
  );

  const [title, setTitle] = React.useState(event?.title ?? "");
  const [description, setDescription] = React.useState(event?.description ?? "");
  const [localStart, setLocalStart] = React.useState<Date | null>(start);
  const [localEnd, setLocalEnd] = React.useState<Date | null>(end);
  const [calendarId, setCalendarId] = React.useState<string>(
    resolveDefaultCalendarId(event?.calendar_id),
  );
  const formSeedRef = React.useRef<string | null>(null);
  const formSeedKey = [
    mode,
    event?.id ?? "create",
    start?.toISOString() ?? "",
    end?.toISOString() ?? "",
  ].join("|");

  React.useEffect(() => {
    const defaultCalendarId = resolveDefaultCalendarId(event?.calendar_id);

    // Reset only when the dialog target changes; preserve user input during
    // late calendar hydration.
    if (formSeedRef.current !== formSeedKey) {
      formSeedRef.current = formSeedKey;
      setTitle(event?.title ?? "");
      setDescription(event?.description ?? "");
      setCalendarId(defaultCalendarId);
      setLocalStart(start);
      setLocalEnd(end);
      return;
    }

    setCalendarId((currentCalendarId) => {
      if (currentCalendarId && mergedCalendars.some((cal) => cal.id === currentCalendarId)) {
        return currentCalendarId;
      }
      return defaultCalendarId;
    });
  }, [
    mergedCalendars,
    end,
    event,
    formSeedKey,
    mode,
    resolveDefaultCalendarId,
    start,
  ]);

  if (!open || !localStart || !localEnd || !position) {
    return null;
  }

  const backdrop = (
    <div
      className="fixed inset-0 z-40"
      aria-hidden
      onClick={() => onOpenChange(false)}
    />
  );

  if (mode === "view" && event) {
    const calendarName =
      mergedCalendars.find((c) => c.id === event.calendar_id)?.name || "Calendar";
    const color =
      event.color ||
      mergedCalendars.find((c) => c.id === event.calendar_id)?.color ||
      "#1E88E5";

    return (
      <>
        {backdrop}
        <div
          role="dialog"
          aria-label="View event"
          data-testid="calendar-event-dialog"
          className="fixed z-50 w-[360px] rounded-3xl border bg-white shadow-xl animate-in slide-in-from-bottom-8 fade-in duration-300"
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 pt-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-semibold text-gray-900">
                {event.title || "(No title)"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              {!event.is_recurring && onDelete && (
                <button
                  type="button"
                  className="rounded-full p-1 hover:bg-gray-100"
                  onClick={() => onModeChange("edit")}
                  aria-label="Edit event"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {!event.is_recurring && onDelete && (
                <button
                  type="button"
                  className="rounded-full p-1 hover:bg-gray-100"
                  onClick={async () => {
                    await onDelete(event);
                  }}
                  aria-label="Delete event"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                className="rounded-full p-1 hover:bg-gray-100"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="px-4 pb-4 pt-2 text-sm">
            <div className="mb-2 flex items-start gap-3 text-gray-700">
              <Clock className="mt-0.5 h-4 w-4 text-gray-500" />
              <div>
                <div>
                  {format(localStart, "EEEE, MMMM d")} •{" "}
                  {format(localStart, "h:mm a")} – {format(localEnd, "h:mm a")}
                </div>
              </div>
            </div>
            {(() => {
              const userDescription = extractUserDescription(event.description || "");
              return userDescription && (
                <div className="mb-2 flex items-start gap-3 text-gray-700">
                  <AlignLeft className="mt-0.5 h-4 w-4 text-gray-500" />
                  <p className="whitespace-pre-line text-sm">{userDescription}</p>
                </div>
              );
            })()}
            <div className="flex items-start gap-3 text-gray-700">
              <CalendarIcon className="mt-0.5 h-4 w-4 text-gray-500" />
              <span className="text-sm">{calendarName}</span>
            </div>
            {event.is_recurring && (
              <p className="mt-2 text-xs text-gray-500">
                This is a recurring event. Editing applies to the entire series.
              </p>
            )}
            {onAskAgent && (
              <div className="mt-3 border-t border-gray-200 pt-3">
                <button
                  type="button"
                  onClick={() => onAskAgent(event)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Ask Agent about this event
                </button>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  const formatForInput = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm");

  const handleSubmit = async () => {
    if (!calendarId) {
      toast.error("Please select a calendar");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    const timezone =
      typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC";

    if (mode === "create") {
      await onSave({
        action: async () => {
          await CalendarAPI.createEvent({
            calendar_id: calendarId,
            title: title.trim(),
            description: description || "",
            start_datetime: localStart.toISOString(),
            end_datetime: localEnd.toISOString(),
            timezone,
            is_all_day: false,
          });
        },
      });
    } else if (mode === "edit" && event) {
      await onSave({
        action: async () => {
          await CalendarAPI.updateEvent(
            event.id,
            {
              calendar_id: calendarId || event.calendar_id,
              title: title.trim(),
              description: description || "",
              start_datetime: localStart.toISOString(),
              end_datetime: localEnd.toISOString(),
              timezone: event.timezone || timezone,
            },
            event.etag,
          );
        },
      });
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) {
      return;
    }
    await onDelete(event);
  };

  return (
    <>
      {backdrop}
      <div
        role="dialog"
        aria-label={mode === "edit" ? "Edit event" : "Create event"}
        data-testid="calendar-event-dialog"
        className="fixed z-50 w-[420px] rounded-3xl border bg-white shadow-xl animate-in slide-in-from-bottom-8 fade-in duration-300"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          <div className="px-6 pt-4 pb-2">
            <input
              autoFocus
              className="w-full border-b border-gray-200 bg-inherit pb-1 text-xl font-semibold text-gray-900 outline-none focus:border-[#3CCED7]"
              placeholder="Add title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="px-6 pb-4">
            <div className="mb-3 flex gap-2 text-sm">
              <button
                type="button"
                className="rounded-full bg-[#3CCED7]/10 px-3 py-1 text-xs font-medium text-[#3CCED7]"
              >
                Event
              </button>
              <button
                type="button"
                disabled
                className="cursor-default rounded-full px-3 py-1 text-xs font-medium text-gray-400"
              >
                Task
              </button>
              <button
                type="button"
                disabled
                className="cursor-default rounded-full px-3 py-1 text-xs font-medium text-gray-400"
              >
                Appointment schedule
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-4">
                <Clock className="mt-1 h-4 w-4 text-gray-500" />
                <div className="flex-1 space-y-1">
                  <p className="bg-inherit text-gray-900">
                    {format(localStart, "EEEE, MMMM d")}{" "}
                    <span className="text-gray-500">
                      • {format(localStart, "HH:mm")} - {format(localEnd, "HH:mm")}
                    </span>
                  </p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input
                      type="datetime-local"
                      className="w-full rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-sm text-gray-900 outline-none focus:border-[#3CCED7]"
                      value={formatForInput(localStart)}
                      onChange={(e) => {
                        const next = new Date(e.target.value);
                        if (!Number.isNaN(next.getTime())) {
                          setLocalStart(next);
                        }
                      }}
                    />
                    <input
                      type="datetime-local"
                      className="w-full rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-sm text-gray-900 outline-none focus:border-[#3CCED7]"
                      value={formatForInput(localEnd)}
                      onChange={(e) => {
                        const next = new Date(e.target.value);
                        if (!Number.isNaN(next.getTime())) {
                          setLocalEnd(next);
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">Time zone • Does not repeat</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <AlignLeft className="mt-1 h-4 w-4 text-gray-500" />
                <textarea
                  className="min-h-[72px] w-full resize-none rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-sm text-gray-900 outline-none focus:border-[#3CCED7]"
                  placeholder="Add description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {mode === "create" ? (
                <div className="flex items-center gap-4">
                  <CalendarIcon className="h-4 w-4 text-gray-500" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Calendar</p>
                    <select
                      className="mt-1 w-full rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-sm text-gray-900 outline-none focus:border-[#3CCED7]"
                      value={calendarId}
                      onChange={(e) => setCalendarId(e.target.value)}
                    >
                      {mergedCalendars.map((cal) => (
                        <option key={cal.id} value={cal.id}>
                          {cal.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                event && (
                  <div className="flex items-center gap-4">
                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                    <div className="flex items-center gap-2 text-sm text-gray-900">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            mergedCalendars.find((c) => c.id === event.calendar_id)?.color ||
                            "#1E88E5",
                        }}
                      />
                      <span>
                        {mergedCalendars.find((c) => c.id === event.calendar_id)?.name}
                      </span>
                    </div>
                  </div>
                )
              )}

              {event?.is_recurring && (
                <p className="text-xs text-gray-500">
                  This is a recurring event. Editing is currently applied to the
                  entire series. Per-instance editing will be added later.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t bg-inherit px-6 py-3">
            <button
              type="button"
              className="text-sm font-medium text-[#3CCED7] hover:opacity-80"
              onClick={() => {}}
            >
              More options
            </button>
            <div className="flex items-center gap-2">
              {mode === "edit" && event && !event.is_recurring && (
                <button
                  type="button"
                  className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  onClick={handleDelete}
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-5 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-95"
                onClick={handleSubmit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
