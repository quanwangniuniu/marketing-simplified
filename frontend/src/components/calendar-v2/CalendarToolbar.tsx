import React from "react";
import type { CalendarViewType } from "@/lib/api/calendarApi";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VIEW_LABELS } from "@/components/calendar-v2/utils";

type CalendarToolbarProps = {
  headerTitle: string;
  currentView: CalendarViewType;
  viewSwitcherOpen: boolean;
  viewSwitcherRef: React.RefObject<HTMLDivElement>;
  onToggleViewSwitcher: () => void;
  onSelectView: (view: CalendarViewType) => void;
  onToday: () => void;
  onOffset: (direction: "prev" | "next") => void;
  onAskAgent?: () => void;
};

const VIEW_ORDER: CalendarViewType[] = ["day", "week", "month", "year", "agenda"];

export function CalendarToolbar({
  headerTitle,
  currentView,
  viewSwitcherRef,
  onSelectView,
  onToday,
  onOffset,
  onAskAgent,
}: CalendarToolbarProps) {
  return (
    <header
      className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5"
      data-testid="calendar-v2-toolbar"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToday}
          className="inline-flex items-center rounded-md border border-[#3CCED7] px-3 py-1.5 text-sm font-medium text-[#3CCED7] transition-colors hover:bg-[#3CCED7]/10"
          data-testid="calendar-v2-today"
        >
          Today
        </button>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onOffset("prev")}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onOffset("next")}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <span
          data-testid="calendar-header-title"
          className="text-base font-semibold text-gray-900"
        >
          {headerTitle}
        </span>
      </div>

      <div className="flex items-center gap-3" ref={viewSwitcherRef}>
        {onAskAgent && (
          <button
            type="button"
            onClick={onAskAgent}
            className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-800 transition-colors hover:bg-violet-100"
            data-testid="calendar-v2-ask-agent"
          >
            Ask Agent
          </button>
        )}
        <nav
          className="flex items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 p-0.5"
          data-testid="calendar-v2-view-tabs"
          role="tablist"
        >
          {VIEW_ORDER.map((view) => {
            const isActive = currentView === view;
            return (
              <button
                key={view}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectView(view)}
                data-testid={`calendar-v2-view-${view}`}
                data-active={isActive ? "true" : "false"}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-white text-[#3CCED7] shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {VIEW_LABELS[view]}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
