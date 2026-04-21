"use client";
import React, { useState } from "react";
import { LayoutBlockProps } from "./types";

const LayoutBlock: React.FC<LayoutBlockProps> = ({
  block,
  section = "",
  isSelected = false,
  updateLayoutColumns,
  isMobile,
}) => {
  const columns = block.columns || 1;
  // Use block.columnsWidths directly, don't create new array each render
  const columnsWidths =
    block.columnsWidths || Array(columns).fill(Math.floor(12 / columns));

  const [isDragging, setIsDragging] = useState(false);
  const innerContainerRef = React.useRef<HTMLDivElement>(null);

  // Use refs to avoid closure issues
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

      // Calculate delta in grid units (12 units total)
      const pixelsPerUnit = containerWidth / 12;
      const totalDeltaGrid = Math.round(deltaX / pixelsPerUnit);

      // Calculate incremental delta since last update
      const incrementalDelta =
        totalDeltaGrid - dragStateRef.current.accumulatedDelta;

      // Only update if incremental delta is at least 1 unit
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

  return (
    <div 
      className="w-full relative layout-container" 
      data-block-id={block.id}
    >
      {/* Layout Content Area */}
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

          return (
            <React.Fragment key={idx}>
              {/* Column content */}
              <div
                className="min-h-[240px] flex flex-col items-center justify-center relative px-3 py-5"
                style={
                  isMobile
                    ? { width: "100%" }
                    : {
                        flex: `0 0 ${(width / 12) * 100}%`,
                      }
                }
                onClick={(e) => {
                  // Allow click to bubble up for block selection
                  // Only stop if clicking on resize handle
                  if ((e.target as HTMLElement).closest(".layout-resize-handle")) {
                    e.stopPropagation();
                  }
                }}
              >
                <div 
                  className="flex-1 w-full bg-gray-50 border border-dashed border-gray-300 rounded flex flex-col items-center text-center justify-center pointer-events-none"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-[#3CCED7] flex items-center justify-center mb-2">
                    <span className="text-[#3CCED7] text-lg font-bold">
                      +
                    </span>
                  </div>
                  <span className="text-sm font-medium text-[#3CCED7] mb-1">
                    Add block
                  </span>
                  <span className="text-xs text-gray-500">
                    or drop content here
                  </span>
                </div>
              </div>

              {/* Column divider with resize handle - only show when selected and desktop */}
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

export default LayoutBlock;

