import type { CalendarDTO, EventDTO } from "@/lib/api/calendarApi";
import type { CalendarDialogMode, EventPanelPosition } from "@/components/calendar-v2/types";
import { EventPanelDialog } from "@/components/calendar-v2/EventPanelDialog";

type EventDialogContainerProps = {
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

export function EventDialogContainer(props: EventDialogContainerProps) {
  return <EventPanelDialog {...props} />;
}
