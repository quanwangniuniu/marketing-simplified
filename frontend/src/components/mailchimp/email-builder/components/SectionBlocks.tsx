"use client";
import React from "react";
import { X } from "lucide-react";
import CanvasBlockRenderer from "./CanvasBlockRenderer";
import {
  CanvasBlock,
  SelectedBlock,
  DragOverIndex,
  DeviceMode,
} from "../types";

interface SectionBlocksProps {
  section: string;
  blocks: CanvasBlock[];
  selectedBlock: SelectedBlock | null;
  setSelectedBlock: (block: SelectedBlock | null) => void;
  setSelectedSection: (section: string | null) => void;
  hoveredBlock: SelectedBlock | null;
  setHoveredBlock: (block: SelectedBlock | null) => void;
  dragOverIndex: DragOverIndex | null;
  handleDragOverDropZone: (
    e: React.DragEvent,
    section: string,
    index: number
  ) => void;
  handleDragLeaveDropZone: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, section: string, index: number) => void;
  handleBlockDragStart?: (
    e: React.DragEvent,
    blockId: string,
    blockType: string,
    section: string
  ) => void;
  handleDragEnd?: (e: React.DragEvent) => void;
  removeBlock: (section: string, blockId: string) => void;
  updateLayoutColumns: (
    section: string,
    blockId: string,
    columnIndex: number,
    delta: number
  ) => void;
  deviceMode: DeviceMode;
  updateBlockContent: (
    section: string,
    blockId: string,
    content: string
  ) => void;
}

const SectionBlocks: React.FC<SectionBlocksProps> = ({
  section,
  blocks,
  selectedBlock,
  setSelectedBlock,
  setSelectedSection,
  hoveredBlock,
  setHoveredBlock,
  dragOverIndex,
  handleDragOverDropZone,
  handleDragLeaveDropZone,
  handleDrop,
  handleBlockDragStart,
  handleDragEnd,
  removeBlock,
  updateLayoutColumns,
  deviceMode,
  updateBlockContent,
}) => {
  const renderDropZone = (section: string, index: number) => {
    const isActive =
      dragOverIndex?.section === section && dragOverIndex?.index === index;
    return (
      <div
        key={`dropzone-${section}-${index}`}
        className={`drop-zone transition-all ${
          isActive
            ? "h-8 bg-[#3CCED7] border-2 border-[#3CCED7]"
            : "h-0 bg-transparent hover:h-4 hover:bg-[#3CCED7]/15 border-2 border-transparent"
        } -mx-4`}
        onDragOver={(e) => handleDragOverDropZone(e, section, index)}
        onDragLeave={(e) => handleDragLeaveDropZone(e)}
        onDrop={(e) => handleDrop(e, section, index)}
      />
    );
  };

  if (blocks.length === 0) {
    return (
      <div
        className={`flex-1 flex justify-center drop-zone py-8 text-center text-sm transition-all ${
          dragOverIndex?.section === section && dragOverIndex?.index === 0
            ? "bg-[#3CCED7]/15 text-[#1a9ba3] border-2 border-dashed border-[#3CCED7] rounded"
            : "text-gray-400"
        }`}
        onDragOver={(e) => handleDragOverDropZone(e, section, 0)}
        onDragLeave={(e) => handleDragLeaveDropZone(e)}
        onDrop={(e) => handleDrop(e, section, 0)}
      >
        Drag content blocks here
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Drop zone before first block */}
      {renderDropZone(section, 0)}

      {blocks.map((block, index) => (
        <div key={block.id}>
          <div
            draggable={!!handleBlockDragStart}
            onDragStart={(e) => {
              if (handleBlockDragStart) {
                handleBlockDragStart(e, block.id, block.type, section);
              }
            }}
            onDragEnd={(e) => {
              if (handleDragEnd) {
                handleDragEnd(e);
              }
            }}
            className={`relative border transition-all ${
              selectedBlock?.section === section &&
              selectedBlock?.id === block.id
                ? "border-[#2AB5BD]"
                : "border-transparent hover:border-[#2AB5BD]"
            } ${handleBlockDragStart ? "cursor-move" : ""}`}
            onClick={(e) => {
              // Don't select if clicking on layout resize handle
              if ((e.target as HTMLElement).closest(".layout-resize-handle")) {
                return;
              }
              e.stopPropagation();
              setSelectedBlock({ section, id: block.id });
              // Keep section-level inspector hidden whenever a block is active.
              setSelectedSection(null);
            }}
            onMouseEnter={() => {
              setHoveredBlock({ section, id: block.id });
            }}
            onMouseLeave={() => {
              setHoveredBlock(null);
            }}
          >
            {/* label badge */}
            <div
              className={`absolute left-0 top-0 text-[10px] px-2 py-0.5 rounded-br bg-[#2AB5BD] text-white transition-opacity pointer-events-none ${
                (selectedBlock?.section === section &&
                  selectedBlock?.id === block.id) ||
                (hoveredBlock?.section === section &&
                  hoveredBlock?.id === block.id)
                  ? "opacity-100"
                  : "opacity-0"
              }`}
            >
              {block.label}
            </div>
            {/* actions */}
            <div
              className={`absolute top-1 right-1 flex items-center gap-1 transition-opacity z-30 ${
                (selectedBlock?.section === section &&
                  selectedBlock?.id === block.id) ||
                (hoveredBlock?.section === section &&
                  hoveredBlock?.id === block.id)
                  ? "opacity-100"
                  : "opacity-0"
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeBlock(section, block.id);
                }}
                className="bg-red-500 text-white rounded p-1 hover:bg-red-600 transition-colors"
                aria-label="Remove block"
                title="Delete layout"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            <CanvasBlockRenderer
              block={block}
              section={section}
              isSelected={
                selectedBlock?.section === section &&
                selectedBlock?.id === block.id
              }
              updateLayoutColumns={updateLayoutColumns}
              deviceMode={deviceMode}
              updateBlockContent={updateBlockContent}
            />
          </div>
          {/* Drop zone after each block */}
          {renderDropZone(section, index + 1)}
        </div>
      ))}
    </div>
  );
};

export default SectionBlocks;
