"use client";

import React from "react";
import { BoardItem } from "@/lib/api/miroApi";

interface StickyNoteItemProps {
  item: BoardItem;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BoardItem>) => void;
}

export default function StickyNoteItem({
  item,
  isSelected,
}: StickyNoteItemProps) {
  const backgroundColor = item.style.backgroundColor || "#fef08a"; // Yellow sticky note

  return (
    <div
      data-hit-region="true"
      style={{
        width: "100%",
        height: "100%",
        border: isSelected ? "2px solid #3b82f6" : "1px solid #d1d5db",
        backgroundColor,
        padding: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        borderRadius: "4px",
      }}
    >
      <div
        style={{
          fontSize: item.style.fontSize || 14,
          color: item.style.color || "#000000",
          fontFamily: item.style.fontFamily || "Arial",
        }}
      >
        {item.content || "Sticky Note"}
      </div>
    </div>
  );
}

