"use client";

import React from "react";
import { Search } from "lucide-react";

// Reusable search input with icon positioning.
export type DraftSearchBarProps = {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  containerClassName?: string;
  inputClassName?: string;
  iconClassName?: string;
};

export function DraftSearchBar({
  value,
  defaultValue,
  placeholder = "Search email drafts",
  onChange,
  containerClassName = "",
  inputClassName = "",
  iconClassName = "",
}: DraftSearchBarProps) {
  return (
    <div className={`relative ${containerClassName}`}>
      <input
        type="text"
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className={`w-full border border-gray-300 rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7] ${inputClassName}`}
      />
      <Search
        className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none ${iconClassName}`}
      />
    </div>
  );
}

