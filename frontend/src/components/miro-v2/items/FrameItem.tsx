"use client";

import React from "react";
import { BoardItem } from "@/lib/api/miroApi";

interface FrameItemProps {
  item: BoardItem;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BoardItem>) => void;
}

export default function FrameItem({
  item,
  isSelected,
}: FrameItemProps) {
  const backgroundColor = item.style?.backgroundColor || "#f3f4f6";
  const borderColor = item.style?.borderColor || isSelected ? "#3b82f6" : "#9ca3af";
  const borderWidth = item.style?.borderWidth || isSelected ? 2 : 1;
  const label = item.content || item.style?.label || "";

  return (
    <div
      data-hit-region="true"
      style={{
        width: "100%",
        height: "100%",
        border: `${borderWidth}px solid ${borderColor}`,
        backgroundColor: backgroundColor,
        borderRadius: "4px",
        cursor: "inherit",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Frame label/title */}
      {label && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "12px",
            fontSize: "14px",
            fontWeight: 600,
            color: borderColor,
            backgroundColor: backgroundColor,
            padding: "2px 8px",
            borderRadius: "4px",
            pointerEvents: "none",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

