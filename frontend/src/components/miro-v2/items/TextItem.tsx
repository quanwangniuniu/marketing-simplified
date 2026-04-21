"use client";

import React from "react";
import { BoardItem } from "@/lib/api/miroApi";

interface TextItemProps {
  item: BoardItem;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BoardItem>) => void;
}

export default function TextItem({
  item,
  isSelected,
  onUpdate,
}: TextItemProps) {
  const textStyle = {
    ...item.style,
    fontSize: item.style.fontSize || 16,
    color: item.style.color || "#000000",
    fontFamily: item.style.fontFamily || "Arial",
    fontWeight: item.style.fontWeight || "normal",
    textAlign: item.style.textAlign || "left",
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: isSelected ? "2px solid #3b82f6" : "1px solid transparent",
        padding: "4px",
        backgroundColor: item.style.backgroundColor || "transparent",
      }}
    >
      <div data-hit-region="true" style={textStyle}>
        {item.content || "Text"}
      </div>
    </div>
  );
}

