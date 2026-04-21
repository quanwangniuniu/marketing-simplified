"use client";

import { useState } from "react";
import type { AdVariation } from "@/types/adVariation";

interface Props {
  variations: AdVariation[];
  selectedIds: number[];
  groupNameMap: Map<number, string>;
  groupColorClass: (name: string, active?: boolean) => string;
  onChange: (ids: number[]) => void;
}

export default function VariationSelector({
  variations,
  selectedIds,
  groupNameMap,
  groupColorClass,
  onChange,
}: Props) {
  const [query, setQuery] = useState("");
  const filtered = variations.filter((variation) =>
    variation.name.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search variations"
        className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 focus:border-[#0E8A96] focus:outline-none"
      />
      <div className="space-y-1">
        {filtered.map((variation) => {
          const isSelected = selectedIds.includes(variation.id);
          const isAssigned = Boolean(variation.adGroupId);
          const groupName = variation.adGroupId
            ? groupNameMap.get(variation.adGroupId)
            : undefined;
          return (
            <label
              key={variation.id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition ${
                isSelected
                  ? "border-[#0E8A96]/30 bg-[#0E8A96]/10 text-[#0E8A96]"
                  : isAssigned && groupName
                  ? groupColorClass(groupName)
                  : "border-transparent bg-white text-gray-700 hover:border-gray-200"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {
                  if (isSelected) {
                    onChange(selectedIds.filter((id) => id !== variation.id));
                  } else {
                    onChange([...selectedIds, variation.id]);
                  }
                }}
                className="accent-[#0E8A96]"
              />
              <span className="flex-1 truncate">{variation.name}</span>
              {isAssigned && !isSelected && groupName && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${groupColorClass(
                    groupName
                  )}`}
                >
                  {groupName}
                </span>
              )}
            </label>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-3 text-center text-xs text-gray-400">
            No variations found.
          </p>
        )}
      </div>
    </div>
  );
}
