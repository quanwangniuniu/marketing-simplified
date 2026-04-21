"use client";

import React from "react";
import { BoardItem } from "@/lib/api/miroApi";
import TextItem from "./TextItem";
import ShapeItem from "./ShapeItem";
import StickyNoteItem from "./StickyNoteItem";

interface BaseBoardItemProps {
  item: BoardItem;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BoardItem>) => void;
}

export default function BaseBoardItem({
  item,
  isSelected,
  onSelect,
  onUpdate,
}: BaseBoardItemProps) {
  const itemStyle: React.CSSProperties = {
    position: "absolute",
    left: `${item.x}px`,
    top: `${item.y}px`,
    width: `${item.width}px`,
    height: `${item.height}px`,
    transform: `rotate(${item.rotation || 0}deg)`,
    zIndex: item.z_index,
    cursor: "pointer",
  };

  const commonProps = {
    item,
    isSelected,
    onSelect,
    onUpdate,
    style: itemStyle,
  };

  switch (item.type) {
    case "text":
      return <TextItem {...commonProps} />;
    case "shape":
      return <ShapeItem {...commonProps} />;
    case "sticky_note":
      return <StickyNoteItem {...commonProps} />;
    case "frame":
      // TODO: Implement FrameItem
      return <div style={itemStyle} onClick={onSelect} className="border-2 border-blue-500 bg-blue-50" />;
    case "line":
      // TODO: Implement LineItem
      return <div style={itemStyle} onClick={onSelect} className="border border-gray-400" />;
    case "connector":
      // TODO: Implement ConnectorItem
      return <div style={itemStyle} onClick={onSelect} className="border border-gray-400" />;
    case "freehand":
      // TODO: Implement FreehandItem
      return <div style={itemStyle} onClick={onSelect} className="border border-gray-400" />;
    default:
      return <div style={itemStyle} onClick={onSelect} className="border border-gray-300 bg-white" />;
  }
}

