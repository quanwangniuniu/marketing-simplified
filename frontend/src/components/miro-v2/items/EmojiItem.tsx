"use client";

import React from "react";
import { BoardItem } from "@/lib/api/miroApi";

interface EmojiItemProps {
  item: BoardItem;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BoardItem>) => void;
}

export default function EmojiItem({ item, isSelected }: EmojiItemProps) {
  const emoji = item.content?.trim() || "🙂";
  const fontSize =
    typeof item.style?.fontSize === "number"
      ? item.style.fontSize
      : Math.max(16, Math.min(item.height * 0.72, item.width * 0.72));

  return (
    <div
      role="img"
      aria-label={emoji}
      data-hit-region="true"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: isSelected ? "2px solid #3b82f6" : "none",
        borderRadius: "4px",
        cursor: "inherit",
        userSelect: "none",
        fontSize: `${fontSize}px`,
        lineHeight: 1,
      }}
    >
      {emoji}
    </div>
  );
}
