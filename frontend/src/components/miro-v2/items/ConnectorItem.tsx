"use client";

import React from "react";
import { BoardItem } from "@/lib/api/miroApi";

interface ConnectorItemProps {
  item: BoardItem;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BoardItem>) => void;
}

export default function ConnectorItem({
  item,
  isSelected,
}: ConnectorItemProps) {
  const strokeColor = item.style?.strokeColor || "#111827";
  const strokeWidth = item.style?.strokeWidth || 4;
  const strokeDasharray = item.style?.strokeDasharray;
  const width = item.width || 200;
  const height = item.height || 20;
  const linkedPath = typeof item.style?.svgPath === "string" ? item.style.svgPath : null;
  const isLinked = Boolean(item.style?.connection && linkedPath);

  // Arrow marker ID (unique per item)
  const markerId = `connectorArrow-${item.id}`;

  // Line goes from left edge to right edge, centered vertically (free / arrow tool)
  const lineY = height / 2;

  const content = item.content || "";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: isSelected ? "2px solid #3b82f6" : "none",
        cursor: "inherit",
        position: "relative",
      }}
    >
      <svg width="100%" height="100%" style={{ display: "block" }}>
        {/* Arrow marker definition */}
        <defs>
          <marker
            id={markerId}
            markerWidth="20"
            markerHeight="12"
            refX="18"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
            viewBox="0 0 20 12"
          >
            <path d="M0,0 L0,12 L18,6 z" fill={strokeColor} />
          </marker>
        </defs>

        {/* Linked: curved path in local box coords; free: straight horizontal */}
        {/* Invisible thicker hit stroke for easier selection */}
        <path
          data-hit-region="true"
          d={isLinked ? linkedPath! : `M 0 ${lineY} L ${width} ${lineY}`}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(12, strokeWidth * 3)}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          pointerEvents="stroke"
        />
        <path
          d={isLinked ? linkedPath! : `M 0 ${lineY} L ${width} ${lineY}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          markerEnd={`url(#${markerId})`}
          pointerEvents="none"
        />
      </svg>
      {/* Content text above the line */}
      {content && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "0",
            transform: "translateX(-50%)",
            padding: "2px 4px",
            fontSize: "12px",
            color: strokeColor,
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            borderRadius: "2px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

