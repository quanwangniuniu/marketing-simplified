"use client";
import React, { useState } from "react";
import { CanvasBlock, SelectedBlock } from "@/components/mailchimp/email-builder/types";
import KlaviyoCanvasBlockRenderer from "./KlaviyoCanvasBlockRenderer";

// Extended CanvasBlock type for Klaviyo with nested blocks support
export interface KlaviyoCanvasBlock extends CanvasBlock {
  columnBlocks?: CanvasBlock[][]; // Nested blocks for each column in Layout blocks
}

interface KlaviyoLayoutBlockProps {
  block: KlaviyoCanvasBlock;
  section?: string;
  isSelected?: boolean;
  updateLayoutColumns: (
    section: string,
    blockId: string,
    columnIndex: number,
    delta: number
  ) => void;
  isMobile: boolean;
  handleDrop?: (e: React.DragEvent, section: string, index?: number) => void;
  handleDragOver?: (e: React.DragEvent, section: string, index: number) => void;
  handleDragLeave?: (e: React.DragEvent) => void;
  layoutBlockIndex?: number; // Index of this layout block in the section
  onColumnBlockDrop?: (e: React.DragEvent, layoutBlockId: string, columnIndex: number) => void;
  setCanvasBlocks?: React.Dispatch<React.SetStateAction<any>>;
  selectedBlock?: SelectedBlock | null;
  setSelectedBlock?: (block: SelectedBlock | null) => void;
  setSelectedSection?: (section: string | null) => void;
}

const KlaviyoLayoutBlock: React.FC<KlaviyoLayoutBlockProps> = ({
  block,
  section = "",
  isSelected = false,
  updateLayoutColumns,
  isMobile,
  handleDrop,
  handleDragOver,
  handleDragLeave,
  layoutBlockIndex,
  onColumnBlockDrop,
  setCanvasBlocks,
  selectedBlock,
  setSelectedBlock,
  setSelectedSection,
}) => {
  const columns = block.columns || 1;
  const columnsWidths =
    block.columnsWidths || Array(columns).fill(Math.floor(12 / columns));

  const [isDragging, setIsDragging] = useState(false);
  const [draggedOverColumn, setDraggedOverColumn] = useState<number | null>(null);
  const innerContainerRef = React.useRef<HTMLDivElement>(null);

  const dragStateRef = React.useRef<{
    startX: number;
    columnIndex: number;
    accumulatedDelta: number;
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent, columnIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStateRef.current = {
      startX: e.clientX,
      columnIndex,
      accumulatedDelta: 0,
    };
  };

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!dragStateRef.current || !innerContainerRef.current || !section)
        return;

      const deltaX = e.clientX - dragStateRef.current.startX;
      const containerWidth = innerContainerRef.current.offsetWidth;

      const pixelsPerUnit = containerWidth / 12;
      const totalDeltaGrid = Math.round(deltaX / pixelsPerUnit);

      const incrementalDelta =
        totalDeltaGrid - dragStateRef.current.accumulatedDelta;

      if (Math.abs(incrementalDelta) >= 1) {
        updateLayoutColumns(
          section,
          block.id,
          dragStateRef.current.columnIndex,
          incrementalDelta
        );
        dragStateRef.current.accumulatedDelta = totalDeltaGrid;
      }
    },
    [section, block.id, updateLayoutColumns]
  );

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
    dragStateRef.current = null;
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleColumnDragOver = (e: React.DragEvent, columnIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverColumn(columnIndex);
    if (handleDragOver && section && layoutBlockIndex !== undefined) {
      // Pass the index after the layout block
      handleDragOver(e, section, layoutBlockIndex + 1);
    }
    // Set dropEffect to allow drop
    e.dataTransfer.dropEffect = "move";
  };

  const handleColumnDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverColumn(null);
    if (handleDragLeave) {
      handleDragLeave(e);
    }
  };

  const handleColumnDrop = (e: React.DragEvent, columnIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverColumn(null);
    
    // Check if we should add to nested column blocks
    if (onColumnBlockDrop) {
      onColumnBlockDrop(e, block.id, columnIndex);
      return;
    }
    
    // Fallback: Add block after the layout block (old behavior)
    const blockType = e.dataTransfer.getData("blockType");
    const source = e.dataTransfer.getData("source");
    
    if (handleDrop && section && layoutBlockIndex !== undefined) {
      handleDrop(e, section, layoutBlockIndex + 1);
    } else {
      console.warn("KlaviyoLayoutBlock: handleDrop not available or missing params", {
        hasHandleDrop: !!handleDrop,
        section,
        layoutBlockIndex,
        blockType,
        source,
      });
    }
  };

  return (
    <div
      className="w-full relative layout-container"
      data-block-id={block.id}
    >
      <div
        ref={innerContainerRef}
        className={`relative w-full ${
          isMobile ? "flex flex-col gap-2" : "flex"
        }`}
      >
        {columnsWidths.map((width, idx) => {
          const previousColumnsWidth = columnsWidths
            .slice(0, idx + 1)
            .reduce((a, b) => a + b, 0);

          const isDraggedOver = draggedOverColumn === idx;
          const columnBlocks = block.columnBlocks?.[idx] || [];
          const hasBlocks = columnBlocks.length > 0;

          return (
            <React.Fragment key={idx}>
              <div
                className={`min-h-[240px] flex flex-col relative px-3 py-5 ${
                  isDraggedOver ? "bg-[#3CCED7]/10" : ""
                } transition-colors`}
                style={
                  isMobile
                    ? { width: "100%", minWidth: 0, overflow: "hidden" }
                    : {
                        flex: `0 0 ${(width / 12) * 100}%`,
                        minWidth: 0,
                        overflow: "hidden",
                      }
                }
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest(".layout-resize-handle")) {
                    e.stopPropagation();
                  }
                }}
                onDragOver={(e) => handleColumnDragOver(e, idx)}
                onDragLeave={handleColumnDragLeave}
                onDrop={(e) => handleColumnDrop(e, idx)}
              >
                {hasBlocks ? (
                  <div className="flex-1 w-full space-y-2">
                    {columnBlocks.map((nestedBlock) => {
                      const isNestedBlockSelected =
                        selectedBlock?.section === section &&
                        selectedBlock?.id === nestedBlock.id &&
                        selectedBlock?.layoutBlockId === block.id &&
                        selectedBlock?.columnIndex === idx;
                      
                      return (
                        <div
                          key={nestedBlock.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (setSelectedBlock && setSelectedSection) {
                              setSelectedBlock({
                                section,
                                id: nestedBlock.id,
                                layoutBlockId: block.id,
                                columnIndex: idx,
                              });
                              setSelectedSection(null);
                            }
                          }}
                          className={`relative border transition-all ${
                            isNestedBlockSelected
                              ? "border-[#2AB5BD]"
                              : "border-transparent hover:border-[#2AB5BD]"
                          }`}
                          style={{
                            maxWidth: "100%",
                            overflow: "hidden",
                          }}
                        >
                          <KlaviyoCanvasBlockRenderer
                            block={nestedBlock}
                            section={section}
                            isSelected={isNestedBlockSelected}
                            updateLayoutColumns={updateLayoutColumns}
                            deviceMode={isMobile ? "mobile" : "desktop"}
                            layoutBlockId={block.id}
                            columnIndex={idx}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className={`flex-1 w-full bg-gray-50 border border-dashed rounded flex flex-col items-center text-center justify-center ${
                      isDraggedOver
                        ? "border-[#3CCED7] bg-[#3CCED7]/15"
                        : "border-gray-300"
                    } transition-all`}
                  >
                    <div className="w-8 h-8 rounded-full border-2 border-[#3CCED7] flex items-center justify-center mb-2 pointer-events-none">
                      <span className="text-[#3CCED7] text-lg font-bold">
                        +
                      </span>
                    </div>
                    <span className="text-sm font-medium text-[#3CCED7] mb-1 pointer-events-none">
                      Add block
                    </span>
                    <span className="text-xs text-gray-500 pointer-events-none">
                      or drop content here
                    </span>
                  </div>
                )}
              </div>

              {!isMobile && idx < columnsWidths.length - 1 && isSelected && (
                <div
                  className="layout-resize-handle absolute flex items-center justify-center cursor-col-resize group z-20"
                  style={{
                    left: `${(previousColumnsWidth / 12) * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: "12px",
                    transform: "translateX(-50%)",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMouseDown(e, idx);
                  }}
                >
                  <div
                    className="absolute top-0 bottom-0 border-l border-dashed border-[#2AB5BD]"
                    style={{
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 0,
                    }}
                  ></div>

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white rounded-full p-1.5 shadow-md border border-[#3CCED7] group-hover:border-[#3CCED7] transition-all">
                      <div className="w-1 h-4 bg-[#3CCED7] group-hover:bg-[#3CCED7] rounded"></div>
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default KlaviyoLayoutBlock;

