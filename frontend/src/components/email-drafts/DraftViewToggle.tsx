"use client";

import React from "react";
import { LayoutGrid, List } from "lucide-react";

// Toggle between list and card views.
export type DraftView = "list" | "card";
export type DraftViewToggleVariant = "tabs" | "icon";

export type DraftViewToggleProps = {
  view: DraftView;
  onChange: (view: DraftView) => void;
  variant?: DraftViewToggleVariant;
  listLabel?: string;
  cardLabel?: string;
  className?: string;
  tabWrapperClassName?: string;
  activeTabWrapperClassName?: string;
  inactiveTabWrapperClassName?: string;
  activeTabClassName?: string;
  inactiveTabClassName?: string;
};

export function DraftViewToggle({
  view,
  onChange,
  variant = "tabs",
  listLabel = "List",
  cardLabel = "Card",
  className = "",
  tabWrapperClassName = "p-1",
  activeTabWrapperClassName = "border-b-2 border-[#3CCED7]",
  inactiveTabWrapperClassName = "",
  activeTabClassName = "text-black",
  inactiveTabClassName = "text-gray-500 hover:text-gray-700",
}: DraftViewToggleProps) {
  if (variant === "icon") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          type="button"
          onClick={() => onChange("card")}
          className={`p-2 border border-gray-300 rounded-md transition-colors ${
            view === "card"
              ? "bg-gray-100 border-gray-400 shadow-[0_0_0_2px_rgba(59,130,246,0.35)]"
              : "hover:bg-gray-50"
          }`}
          title={cardLabel}
          aria-pressed={view === "card"}
        >
          <LayoutGrid
            className={`w-4 h-4 ${
              view === "card" ? "text-gray-900" : "text-gray-600"
            }`}
          />
        </button>
        <button
          type="button"
          onClick={() => onChange("list")}
          className={`p-2 border border-gray-300 rounded-md transition-colors ${
            view === "list"
              ? "bg-gray-100 border-gray-400 shadow-[0_0_0_2px_rgba(59,130,246,0.35)]"
              : "hover:bg-gray-50"
          }`}
          title={listLabel}
          aria-pressed={view === "list"}
        >
          <List
            className={`w-4 h-4 ${
              view === "list" ? "text-gray-900" : "text-gray-600"
            }`}
          />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex space-x-6 text-sm font-medium ${className}`}>
      <div
        className={`${tabWrapperClassName} ${
          view === "list"
            ? `${activeTabWrapperClassName} shadow-[0_2px_0_0_rgba(59,130,246,0.35)]`
            : inactiveTabWrapperClassName
        }`}
      >
        <button
          type="button"
          onClick={() => onChange("list")}
          className={`flex items-center gap-2 rounded-md p-2 ${
            view === "list" ? activeTabClassName : inactiveTabClassName
          }`}
          aria-pressed={view === "list"}
        >
          <List className="h-4" />
          {listLabel}
        </button>
      </div>
      <div
        className={`${tabWrapperClassName} ${
          view === "card"
            ? `${activeTabWrapperClassName} shadow-[0_2px_0_0_rgba(59,130,246,0.35)]`
            : inactiveTabWrapperClassName
        }`}
      >
        <button
          type="button"
          onClick={() => onChange("card")}
          className={`flex items-center gap-2 rounded-md p-2 ${
            view === "card" ? activeTabClassName : inactiveTabClassName
          }`}
          aria-pressed={view === "card"}
        >
          <LayoutGrid className="h-4" />
          {cardLabel}
        </button>
      </div>
    </div>
  );
}


