import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { EventPanelDialog } from "@/components/calendar/EventPanelDialog";
import { getSampleCalendars, getSampleEvents } from "@/stories/calendar/calendarData";

const meta: Meta<typeof EventPanelDialog> = {
  title: "Calendar/EventPanelDialog",
  component: EventPanelDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof EventPanelDialog>;

const events = getSampleEvents();
const calendars = getSampleCalendars();

export const ViewMode: Story = {
  render: () => (
    <div className="h-[500px] w-[400px]">
      <EventPanelDialog
        open
        mode="view"
        onModeChange={() => {}}
        onOpenChange={() => {}}
        start={new Date(events[0].start_datetime)}
        end={new Date(events[0].end_datetime)}
        event={events[0]}
        calendars={calendars}
        primaryCalendar={calendars.find((c) => c.is_primary) ?? null}
        preferredCalendarId={calendars[0].id}
        position={{ top: 24, left: 24 }}
        onSave={async () => {}}
        onDelete={async () => {}}
      />
    </div>
  ),
};

export const EditMode: Story = {
  render: () => (
    <div className="h-[500px] w-[400px]">
      <EventPanelDialog
        open
        mode="edit"
        onModeChange={() => {}}
        onOpenChange={() => {}}
        start={new Date(events[0].start_datetime)}
        end={new Date(events[0].end_datetime)}
        event={events[0]}
        calendars={calendars}
        primaryCalendar={calendars.find((c) => c.is_primary) ?? null}
        preferredCalendarId={calendars[0].id}
        position={{ top: 24, left: 24 }}
        onSave={async () => {}}
        onDelete={async () => {}}
      />
    </div>
  ),
};

