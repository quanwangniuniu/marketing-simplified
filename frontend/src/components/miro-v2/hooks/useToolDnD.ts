import { useCallback } from 'react';

export type ToolType =
  | "select"
  | "multi_select"
  | "text"
  | "shape"
  | "sticky_note"
  | "frame"
  | "line"
  | "connect"
  | "freehand"
  | "emoji"
  | "eraser";

export type LineVariant =
  | "straight_solid"
  | "straight_dashed"
  | "straight_dotted"
  | "arrow_solid"
  | "arrow_dashed";

export type ToolOptions = {
  lineVariant?: LineVariant;
  /** Default emoji when dragging the emoji tool onto the canvas */
  emoji?: string;
};

export const TOOL_DND_MIME = "application/x-miro-tool";

export function useToolDnD() {
  const handleDragStart = useCallback((e: React.DragEvent, toolType: ToolType, options?: ToolOptions) => {
    if (toolType === "select" || toolType === "multi_select") {
      e.preventDefault();
      return;
    }
    const payload = { toolType, options: options ?? {} };
    e.dataTransfer.setData(TOOL_DND_MIME, JSON.stringify(payload));
    // Backward compatibility with existing handlers
    e.dataTransfer.setData("toolType", toolType);
    e.dataTransfer.setData("source", "toolbar");
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    // Optional: cleanup if needed
  }, []);

  return {
    handleDragStart,
    handleDragEnd,
  };
}

