import type { CalendarDTO, EventDTO } from "@/lib/api/calendarApi";

export type { CalendarDTO, EventDTO };

export type CalendarDialogMode = "create" | "edit" | "view";

export type EventPanelPosition = {
  top: number;
  left: number;
};
