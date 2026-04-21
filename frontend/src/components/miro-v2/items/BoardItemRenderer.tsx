"use client";

import React from "react";
import { BoardItem } from "@/lib/api/miroApi";
import TextItem from "./TextItem";
import ShapeItem from "./ShapeItem";
import StickyNoteItem from "./StickyNoteItem";
import FreehandItem from "./FreehandItem";
import FrameItem from "./FrameItem";
import ConnectorItem from "./ConnectorItem";
import LineItem from "./LineItem";
import EmojiItem from "./EmojiItem";

interface BoardItemRendererProps {
  item: BoardItem;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BoardItem>) => void;
}

export default function BoardItemRenderer({
  item,
  isSelected,
  onSelect,
  onUpdate,
}: BoardItemRendererProps) {
  const commonProps = {
    item,
    isSelected,
    onSelect,
    onUpdate,
  };

  switch (item.type) {
    case "text":
      return <TextItem {...commonProps} />;
    case "shape":
      return <ShapeItem {...commonProps} />;
    case "sticky_note":
      return <StickyNoteItem {...commonProps} />;
    case "frame":
      return <FrameItem {...commonProps} />;
    case "line":
      return <LineItem {...commonProps} />;
    case "connector":
      return <ConnectorItem {...commonProps} />;
    case "freehand":
      return <FreehandItem {...commonProps} />;
    case "emoji":
      return <EmojiItem {...commonProps} />;
    default:
      return (
        <div
          onClick={onSelect}
          className="border border-gray-300 bg-white w-full h-full"
        />
      );
  }
}

