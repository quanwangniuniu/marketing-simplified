"use client";

import React from "react";
import { BoardItem } from "@/lib/api/miroApi";

interface ShapeItemProps {
  item: BoardItem;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BoardItem>) => void;
}

export default function ShapeItem({
  item,
  isSelected,
}: ShapeItemProps) {
  const shapeType = item.style?.shapeType || "rect";
  const backgroundColor = item.style?.backgroundColor || "#ffffff";
  const borderColor = item.style?.borderColor || "#000000";
  const borderWidth = item.style?.borderWidth || 2;
  const content = item.content || "";

  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px",
  };

  const renderShape = () => {
    const baseStyle: React.CSSProperties = {
      width: "100%",
      height: "100%",
      backgroundColor,
      border: `${borderWidth}px solid ${borderColor}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    };

    if (shapeType === "rect") {
      return (
        <div data-hit-region="true" style={baseStyle}>
          {content && (
            <div style={{ padding: "4px", wordBreak: "break-word", textAlign: "center" }}>
              {content}
            </div>
          )}
        </div>
      );
    }

    if (shapeType === "roundRect") {
      return (
        <div data-hit-region="true" style={{ ...baseStyle, borderRadius: "8px" }}>
          {content && (
            <div style={{ padding: "4px", wordBreak: "break-word", textAlign: "center" }}>
              {content}
            </div>
          )}
        </div>
      );
    }

    if (shapeType === "ellipse") {
      return (
        <div data-hit-region="true" style={{ ...baseStyle, borderRadius: "50%" }}>
          {content && (
            <div style={{ padding: "4px", wordBreak: "break-word", textAlign: "center" }}>
              {content}
            </div>
          )}
        </div>
      );
    }

    if (shapeType === "diamond") {
      // Diamond using CSS clip-path
      return (
        <div
          data-hit-region="true"
          style={{
            ...baseStyle,
            clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
            WebkitClipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          }}
        >
          {content && (
            <div style={{ padding: "4px", wordBreak: "break-word", textAlign: "center" }}>
              {content}
            </div>
          )}
        </div>
      );
    }

    // Default to rect
    return (
      <div data-hit-region="true" style={baseStyle}>
        {content && (
          <div style={{ padding: "4px", wordBreak: "break-word", textAlign: "center" }}>
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: isSelected ? "2px solid #3b82f6" : "none",
        cursor: "inherit",
      }}
    >
      <div style={containerStyle}>{renderShape()}</div>
    </div>
  );
}

