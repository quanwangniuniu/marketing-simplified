"use client";

import React, { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { BoardItem } from "@/lib/api/miroApi";
import { Viewport } from "./hooks/useBoardViewport";
import { useItemDrag } from "./hooks/useItemDrag";
import { useItemResize } from "./hooks/useItemResize";
import { useLineEndpointDrag } from "./hooks/useLineEndpointDrag";
import { useFreehandDrawing } from "./hooks/useFreehandDrawing";
import BoardItemContainer from "./items/BoardItemContainer";
import InlineContentEditor from "./InlineContentEditor";
import { TOOL_DND_MIME, ToolOptions, ToolType } from "./hooks/useToolDnD";
import { getSelectionBounds } from "./utils/selectionBounds";
import {
  anchorWorldPoint,
  itemSupportsConnectAnchors,
  type AnchorSide,
} from "./utils/connectorLayout";

interface BoardCanvasProps {
  viewport: Viewport;
  items: BoardItem[];
  selectedItemIds: string[];
  activeTool: ToolType;
  onItemSelect: (itemId: string | null, options?: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) => void;
  onItemUpdate: (itemId: string, updates: Partial<BoardItem>) => void;
  onItemUpdateOptimistic: (itemId: string, updates: Partial<BoardItem>) => () => void;
  onItemUpdateAsync: (itemId: string, updates: Partial<BoardItem>, rollback: () => void) => Promise<BoardItem>;
  onPanStart: (x: number, y: number) => void;
  onPanUpdate: (x: number, y: number) => void;
  onPanEnd: () => void;
  onZoom: (mouseX: number, mouseY: number, delta: number) => void;
  onPanBy: (dx: number, dy: number) => void;
  onItemCreate?: (toolType: ToolType, worldX: number, worldY: number, options?: ToolOptions) => void;
  onFreehandCreate?: (data: { x: number; y: number; width: number; height: number; style: { svgPath: string; strokeColor: string; strokeWidth: number } }) => void;
  onLinkedConnectorCreate?: (payload: {
    fromItemId: string;
    toItemId: string;
    fromAnchor: AnchorSide;
    toAnchor: AnchorSide;
  }) => void;
  onItemsBatchUpdate?: (updates: Array<{ id: string } & Partial<BoardItem>>) => void;
  onEraseItem?: (itemId: string) => void;
  width: number;
  height: number;
  canvasRef: React.RefObject<HTMLDivElement>;
  brushSettings?: {
    strokeColor: string;
    strokeWidth: number;
  };
}

export default function BoardCanvas({
  viewport,
  items,
  selectedItemIds,
  activeTool,
  onItemSelect,
  onItemUpdate,
  onItemUpdateOptimistic,
  onItemUpdateAsync,
  onPanStart,
  onPanUpdate,
  onPanEnd,
  onZoom,
  onPanBy,
  onItemCreate,
  onFreehandCreate,
  onLinkedConnectorCreate,
  onItemsBatchUpdate,
  onEraseItem,
  width,
  height,
  canvasRef,
  brushSettings,
}: BoardCanvasProps) {
  const isPanningRef = useRef(false);
  const [marqueeRect, setMarqueeRect] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const groupDragStartRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const [connectionDraft, setConnectionDraft] = useState<{
    fromItemId: string;
    fromAnchor: AnchorSide;
    fromWorld: { x: number; y: number };
  } | null>(null);
  const [draftPointerWorld, setDraftPointerWorld] = useState<{ x: number; y: number } | null>(null);
  const connectionDraftRef = useRef<{
    fromItemId: string;
    fromAnchor: AnchorSide;
    fromWorld: { x: number; y: number };
  } | null>(null);

  const cancelConnectionDraft = useCallback(() => {
    connectionDraftRef.current = null;
    setConnectionDraft(null);
    setDraftPointerWorld(null);
  }, []);
  
  // Inline editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState<string>("");

  // Start editing an item
  const startEditing = useCallback((item: BoardItem) => {
    setEditingItemId(item.id);
    setDraftContent(item.content || "");
  }, []);

  // Commit editing (save changes)
  const commitEditing = useCallback(() => {
    if (!editingItemId) return;

    const originalContent = items.find((i) => i.id === editingItemId)?.content || "";
    if (draftContent === originalContent) {
      // No changes, just close
      setEditingItemId(null);
      setDraftContent("");
      return;
    }

    onItemUpdate(editingItemId, { content: draftContent });

    setEditingItemId(null);
    setDraftContent("");
  }, [editingItemId, draftContent, items, onItemUpdate]);

  // Cancel editing (discard changes)
  const cancelEditing = useCallback(() => {
    setEditingItemId(null);
    setDraftContent("");
  }, []);
  
  const {
    startDrag,
    updateDrag,
    endDrag,
    getOverridePosition,
    isDragging,
    draggingItemId,
    dragTick,
  } = useItemDrag();

  const {
    startResize,
    updateResize,
    endResize,
    getOverrideSize,
    isResizing,
  } = useItemResize();

  const {
    startDrag: startLineEndpointDrag,
    updateDrag: updateLineEndpointDrag,
    endDrag: endLineEndpointDrag,
    getOverride: getLineEndpointOverride,
    lineEndpointDragTick,
  } = useLineEndpointDrag();

  const handleLineEndpointDragEnd = useCallback(() => {
    const result = endLineEndpointDrag();
    if (!result) return;
    const { id, x, y, width, height, rotation } = result;
    onItemUpdate(id, { x, y, width, height, rotation });
  }, [endLineEndpointDrag, onItemUpdate]);

  // Compute editor screen position for editing item
  const editorRect = useMemo(() => {
    if (!editingItemId || !canvasRef.current) return null;

    const editingItem = items.find((i) => i.id === editingItemId);
    if (!editingItem) return null;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const lineOv = getLineEndpointOverride(editingItemId);
    const overridePosition = lineOv
      ? { x: lineOv.x as number, y: lineOv.y as number }
      : getOverridePosition(editingItemId);
    const overrideSize = lineOv
      ? {
          x: lineOv.x as number,
          y: lineOv.y as number,
          width: lineOv.width as number,
          height: lineOv.height as number,
        }
      : getOverrideSize(editingItemId, viewport.zoom, editingItem.type);

    const itemX = overrideSize?.x ?? overridePosition?.x ?? editingItem.x;
    const itemY = overrideSize?.y ?? overridePosition?.y ?? editingItem.y;
    const itemWidth = overrideSize?.width ?? editingItem.width;
    const itemHeight = overrideSize?.height ?? editingItem.height;

    // Convert world coordinates to screen coordinates
    const screenX = itemX * viewport.zoom + viewport.x;
    const screenY = itemY * viewport.zoom + viewport.y;
    const screenWidth = itemWidth * viewport.zoom;
    const screenHeight = itemHeight * viewport.zoom;

    // Convert to fixed position relative to viewport
    return {
      left: canvasRect.left + screenX,
      top: canvasRect.top + screenY,
      width: screenWidth,
      height: screenHeight,
    };
  }, [
    editingItemId,
    items,
    viewport,
    canvasRef,
    getOverridePosition,
    getOverrideSize,
    getLineEndpointOverride,
    lineEndpointDragTick,
  ]);

  // Viewport culling: only render visible items
  // Sort items so that frames render first, then their children render on top
  const visibleItems = useMemo(() => {
    // If we don't know the canvas size yet, skip culling so items can still mount.
    // This avoids "items appear only after Inspect/DevTools resize" glitches.
    if (width <= 0 || height <= 0) {
      const filtered = items.filter((item) => !item.is_deleted);
      return filtered.sort((a, b) => {
        const aIsFrame = a.type === 'frame';
        const bIsFrame = b.type === 'frame';
        const aHasParent = !!a.parent_item_id;
        const bHasParent = !!b.parent_item_id;

        if (aIsFrame && !bIsFrame) return -1;
        if (!aIsFrame && bIsFrame) return 1;

        if (aHasParent && !bHasParent && !aIsFrame && !bIsFrame) return 1;
        if (!aHasParent && bHasParent && !aIsFrame && !bIsFrame) return -1;

        if (a.z_index !== b.z_index) {
          return a.z_index - b.z_index;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    }

    const buffer = 100; // pixels
    const bufferWorld = buffer / viewport.zoom;

    // Calculate visible world bounds
    const topLeft = {
      x: (0 - viewport.x) / viewport.zoom,
      y: (0 - viewport.y) / viewport.zoom,
    };
    const bottomRight = {
      x: (width - viewport.x) / viewport.zoom,
      y: (height - viewport.y) / viewport.zoom,
    };

    const filtered = items.filter((item) => {
      if (item.is_deleted) return false;
      return (
        item.x + item.width >= topLeft.x - bufferWorld &&
        item.x <= bottomRight.x + bufferWorld &&
        item.y + item.height >= topLeft.y - bufferWorld &&
        item.y <= bottomRight.y + bufferWorld
      );
    });

    // Sort: frames first, then items without parent, then items with parent (children on top)
    // Within each group, sort by z_index
    return filtered.sort((a, b) => {
      const aIsFrame = a.type === 'frame';
      const bIsFrame = b.type === 'frame';
      const aHasParent = !!a.parent_item_id;
      const bHasParent = !!b.parent_item_id;

      // Frames render first (lowest z-order)
      if (aIsFrame && !bIsFrame) return -1;
      if (!aIsFrame && bIsFrame) return 1;

      // Items with parent (children) render last (highest z-order, on top of frames)
      if (aHasParent && !bHasParent && !aIsFrame && !bIsFrame) return 1;
      if (!aHasParent && bHasParent && !aIsFrame && !bIsFrame) return -1;

      // Within same group (both frames, both with parent, or both without parent), sort by z_index
      if (a.z_index !== b.z_index) {
        return a.z_index - b.z_index;
      }
      // Fallback to creation time for stable ordering
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [items, viewport, width, height]);

  // Trackpad: two-finger scroll pans via deltaX/deltaY; pinch-zoom (e.g. macOS) often sends
  // ctrlKey+wheel, which we treat as zoom-at-cursor. Brush/freehand is unaffected (separate handlers).
  // Handle mouse wheel zoom (native listener, non-passive so preventDefault works)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const wheelHandler = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], input[type='range'], [data-radix-scroll-area-viewport], [data-radix-popover-content], [role='dialog']"
        )
      ) {
        return;
      }
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (e.ctrlKey) {
        const zoomDelta = -e.deltaY * 0.001;
        onZoom(mouseX, mouseY, zoomDelta);
        return;
      }
      onPanBy(e.deltaX, e.deltaY);
    };

    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => el.removeEventListener("wheel", wheelHandler as any);
  }, [onZoom, onPanBy]);

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      return {
        x: (screenX - viewport.x) / viewport.zoom,
        y: (screenY - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  // Convert world coordinates to screen coordinates
  const worldToScreen = useCallback(
    (worldX: number, worldY: number) => {
      return {
        x: worldX * viewport.zoom + viewport.x,
        y: worldY * viewport.zoom + viewport.y,
      };
    },
    [viewport]
  );

  // screenToWorld expects coordinates relative to the canvas element (same space as viewport.x/y).
  // e.clientX/Y are viewport coordinates — offset by the canvas bounding rect first.
  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const el = canvasRef.current;
      if (!el) {
        return screenToWorld(clientX, clientY);
      }
      const rect = el.getBoundingClientRect();
      return screenToWorld(clientX - rect.left, clientY - rect.top);
    },
    [canvasRef, screenToWorld]
  );

  const handleConnectAnchorPointerDown = useCallback(
    (itemId: string, anchor: AnchorSide, e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      const fromWorld = anchorWorldPoint(item, anchor);
      const draft = { fromItemId: itemId, fromAnchor: anchor, fromWorld };
      connectionDraftRef.current = draft;
      setConnectionDraft(draft);
      const w = clientToWorld(e.clientX, e.clientY);
      setDraftPointerWorld(w);

      const move = (ev: PointerEvent) => {
        const p = clientToWorld(ev.clientX, ev.clientY);
        setDraftPointerWorld(p);
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        const d = connectionDraftRef.current;
        cancelConnectionDraft();
        if (!d || !onLinkedConnectorCreate) return;
        // Use elementsFromPoint so we can "see through" connector strokes/overlays
        // and still hit the anchor underneath.
        const els = typeof document.elementsFromPoint === "function"
          ? document.elementsFromPoint(ev.clientX, ev.clientY)
          : [document.elementFromPoint(ev.clientX, ev.clientY)].filter(Boolean) as Element[];
        const h =
          (els
            .map((el) => (el as HTMLElement | null)?.closest?.("[data-connect-anchor]") as HTMLElement | null)
            .find(Boolean) as HTMLElement | undefined) ?? null;
        if (h) {
          const toId = h.getAttribute("data-item-id");
          const toAnchor = h.getAttribute("data-anchor") as AnchorSide | null;
          if (toId && toAnchor && toId !== d.fromItemId) {
            onLinkedConnectorCreate({
              fromItemId: d.fromItemId,
              fromAnchor: d.fromAnchor,
              toItemId: toId,
              toAnchor,
            });
          }
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [items, clientToWorld, onLinkedConnectorCreate, cancelConnectionDraft]
  );

  useEffect(() => {
    if (activeTool !== "connect" && connectionDraftRef.current) {
      cancelConnectionDraft();
    }
  }, [activeTool, cancelConnectionDraft]);

  // Freehand drawing hook
  const {
    freehandDraft,
    isDrawingFreehand,
    svgPathRef,
    handleFreehandMouseDown,
    handleFreehandMouseMove,
    handleFreehandMouseUp,
  } = useFreehandDrawing({
    activeTool,
    canvasRef,
    screenToWorld,
    worldToScreen,
    brushSettings,
    onFreehandCreate,
  });

  // Ref to SVG element for viewBox updates
  const svgOverlayRef = useRef<SVGSVGElement | null>(null);

  // Update SVG viewBox when width/height changes
  useEffect(() => {
    if (svgOverlayRef.current && width > 0 && height > 0) {
      const expectedViewBox = `0 0 ${width} ${height}`;
      const currentViewBox = svgOverlayRef.current.getAttribute('viewBox');
      if (currentViewBox !== expectedViewBox) {
        svgOverlayRef.current.setAttribute('viewBox', expectedViewBox);
      }
    }
  }, [width, height]);

  // Handle pan (click and drag on background)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const targetEl = e.target as HTMLElement | null;
      const isItemInteractionTarget = Boolean(
        targetEl?.closest?.(
          '.resize-handle, .connect-anchor-handle, .line-endpoint-handle, [data-hit-region="true"]'
        )
      );
      const isBackground = !isItemInteractionTarget;

      // If we're editing content, only clicking the canvas background should commit.
      // Clicking inside the editor (or on items) should NOT immediately commit.
      if (editingItemId) {
        if (isBackground) {
          commitEditing();
        }
        return;
      }

      // Don't start panning if we're dragging an item
      if (isDragging) return;
      
      // Connector tool handles events in capture phase, so we don't need to handle it here
      
      // If freehand tool is active, start drawing instead of panning
      // Allow drawing on both background and items
      if (activeTool === "freehand") {
        // Always pass true for isBackground since we removed the check in handleFreehandMouseDown
        // This allows drawing on both background and items
        handleFreehandMouseDown(e, true);
        e.preventDefault();
        return;
      }

      if (activeTool === "connect" && isBackground) {
        onItemSelect(null);
        e.preventDefault();
        return;
      }

      if (isBackground) {
        // Background interaction: in select mode, clicking empty space should not affect selection.
        // Multi-select uses background drag to start marquee.
        if (activeTool === "multi_select") {
          const world = clientToWorld(e.clientX, e.clientY);
          setMarqueeRect({ startX: world.x, startY: world.y, currentX: world.x, currentY: world.y });
          return;
        }
        isPanningRef.current = true;
        onPanStart(e.clientX, e.clientY);
        e.preventDefault();
      }
    },
    [editingItemId, commitEditing, isDragging, activeTool, onItemSelect, onPanStart, handleFreehandMouseDown, clientToWorld]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Connector tool handles events in capture phase, so we don't need to handle it here
      
      // Freehand drawing is handled by global mouse event listeners for better tracking
      handleFreehandMouseMove(e);
      
      if (isPanningRef.current) {
        onPanUpdate(e.clientX, e.clientY);
      }
      if (marqueeRect) {
        const world = clientToWorld(e.clientX, e.clientY);
        setMarqueeRect((prev) => (prev ? { ...prev, currentX: world.x, currentY: world.y } : prev));
      }
    },
    [onPanUpdate, handleFreehandMouseMove, marqueeRect, clientToWorld]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Connector tool handles events in capture phase, so we don't need to handle it here
      
      // Handle freehand drawing mouse up
      handleFreehandMouseUp(e);
      
      if (isPanningRef.current) {
        isPanningRef.current = false;
        onPanEnd();
      }
      if (marqueeRect) {
        const end = clientToWorld(e.clientX, e.clientY);
        const minX = Math.min(marqueeRect.startX, end.x);
        const maxX = Math.max(marqueeRect.startX, end.x);
        const minY = Math.min(marqueeRect.startY, end.y);
        const maxY = Math.max(marqueeRect.startY, end.y);
        const selected = items
          .filter((item) => !item.is_deleted)
          .filter((item) => {
            const itemRight = item.x + item.width;
            const itemBottom = item.y + item.height;
            return itemRight >= minX && item.x <= maxX && itemBottom >= minY && item.y <= maxY;
          })
          .map((item) => item.id);
        if (selected.length > 0) {
          onItemSelect(selected[0]);
          selected.slice(1).forEach((id) => onItemSelect(id, { shiftKey: true }));
        } else {
          onItemSelect(null);
        }
        setMarqueeRect(null);
      }
    },
    [onPanEnd, handleFreehandMouseUp, marqueeRect, items, onItemSelect, clientToWorld]
  );

  // Handle canvas click (deselect)
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const targetEl = e.target as HTMLElement | null;
      const isBackground = !targetEl?.closest?.('[data-board-item="true"]');
      if (isBackground && activeTool !== "multi_select") onItemSelect(null);
    },
    [onItemSelect, activeTool]
  );

  // Handle drop to create item
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      
      let toolType = "";
      let source = e.dataTransfer.getData("source");
      let options: ToolOptions | undefined;

      const jsonPayload = e.dataTransfer.getData(TOOL_DND_MIME);
      if (jsonPayload) {
        try {
          const parsed = JSON.parse(jsonPayload);
          toolType = String(parsed?.toolType ?? "");
          options = (parsed?.options ?? {}) as ToolOptions;
          source = "toolbar";
        } catch {
          // Fall back to legacy payload below
        }
      }

      if (!toolType) {
        toolType = e.dataTransfer.getData("toolType");
      }

      if (source !== "toolbar" || !toolType || !onItemCreate || !canvasRef.current) return;

          const rect = canvasRef.current.getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
      const worldPoint = screenToWorld(screenX, screenY);

      onItemCreate(toolType as ToolType, worldPoint.x, worldPoint.y, options);
    },
    [onItemCreate, screenToWorld]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const source = e.dataTransfer.getData("source");
    if (source === "toolbar") {
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  // Helper: check if item is inside frame bounds
  const isItemInsideFrame = useCallback((item: BoardItem, frame: BoardItem): boolean => {
    const itemLeft = item.x;
    const itemRight = item.x + item.width;
    const itemTop = item.y;
    const itemBottom = item.y + item.height;
    
    const frameLeft = frame.x;
    const frameRight = frame.x + frame.width;
    const frameTop = frame.y;
    const frameBottom = frame.y + frame.height;
    
    // Check if item is fully inside frame
    return (
      itemLeft >= frameLeft &&
      itemRight <= frameRight &&
      itemTop >= frameTop &&
      itemBottom <= frameBottom
    );
  }, []);

  // Helper: find frame that contains the item
  const findContainingFrame = useCallback((item: BoardItem): BoardItem | null => {
    // Find all frames
    const frames = items.filter((i) => i.type === 'frame' && !i.is_deleted);
    
    // Find the frame that contains this item (item must be fully inside)
    for (const frame of frames) {
      if (frame.id !== item.id && isItemInsideFrame(item, frame)) {
        return frame;
      }
    }
    
    return null;
  }, [items, isItemInsideFrame]);

  // Handle item resize commit (optimistic update + async PATCH)
  const handleItemResizeEnd = useCallback(() => {
    const result = endResize(viewport.zoom);
    if (!result) return;

    const resizedItem = items.find((i) => i.id === result.itemId);
    if (!resizedItem) return;

    // For connector/line, only update width (keep height fixed)
    const updates: Partial<BoardItem> = {
      x: result.newX,
      y: result.newY,
      width: result.newWidth,
      height: resizedItem.type === 'connector' || resizedItem.type === 'line' 
        ? resizedItem.height 
        : result.newHeight,
          };

    onItemUpdate(result.itemId, updates);
  }, [endResize, items, onItemUpdate]);

  // Handle item drag commit (optimistic update + async PATCH)
  const handleItemDragEnd = useCallback(() => {
    const result = endDrag();
    if (!result) return;

    const movedItem = items.find((i) => i.id === result.itemId);
    if (!movedItem) return;

    // Compute new position
    const newItemData = {
      ...movedItem,
      x: result.newX,
      y: result.newY,
    };

    // If item is a frame, move all its children with it
    if (selectedItemIds.length > 1 && selectedItemIds.includes(result.itemId) && onItemsBatchUpdate) {
      const selectedSet = new Set(selectedItemIds);
      const original = groupDragStartRef.current;
      const baseStart = original.get(result.itemId) ?? { x: movedItem.x, y: movedItem.y };
      const deltaX = result.newX - baseStart.x;
      const deltaY = result.newY - baseStart.y;
      const updates = items
        .filter((i) => selectedSet.has(i.id))
        .map((i) => {
          const start = original.get(i.id) ?? { x: i.x, y: i.y };
          return { id: i.id, x: start.x + deltaX, y: start.y + deltaY };
        });
      onItemsBatchUpdate(updates);
      groupDragStartRef.current.clear();
      return;
    }

    if (movedItem.type === 'frame') {
      const deltaX = result.newX - movedItem.x;
      const deltaY = result.newY - movedItem.y;
      
      // Find all child items
      const childItems = items.filter(
        (i) => i.parent_item_id === movedItem.id && !i.is_deleted
      );

      const updates = [
        { id: movedItem.id, x: result.newX, y: result.newY },
        ...childItems.map((child) => ({
          id: child.id,
          x: child.x + deltaX,
          y: child.y + deltaY,
        })),
      ];
      if (onItemsBatchUpdate) {
        onItemsBatchUpdate(updates);
      } else {
        updates.forEach(({ id, ...update }) => onItemUpdate(id, update));
      }
    } else {
      // For non-frame items, check if they're inside a frame
      const containingFrame = findContainingFrame(newItemData);
      const newParentId = containingFrame ? containingFrame.id : null;
      
      // Only update parent if it changed
      const needsParentUpdate = movedItem.parent_item_id !== newParentId;
      
      onItemUpdate(result.itemId, {
        x: result.newX,
        y: result.newY,
        ...(needsParentUpdate && { parent_item_id: newParentId }),
      });
    }
  }, [endDrag, items, findContainingFrame, selectedItemIds, onItemsBatchUpdate, onItemUpdate]);

  const handleItemSelectFromContainer = useCallback(
    (itemId: string, event?: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) => {
      const additive = Boolean(event?.shiftKey || event?.metaKey || event?.ctrlKey);
      // If we already have a multi-selection and the user clicks any selected item without modifiers,
      // keep the selection intact so they can drag the whole group.
      if (!additive && selectedItemIds.length > 1 && selectedItemIds.includes(itemId)) {
        return;
      }
      groupDragStartRef.current.clear();
      onItemSelect(itemId, event);
    },
    [onItemSelect, selectedItemIds]
  );

  const handleItemDragStart = useCallback(
    (itemId: string, itemX: number, itemY: number, worldX: number, worldY: number) => {
      if (selectedItemIds.length > 1 && selectedItemIds.includes(itemId)) {
        const selectedSet = new Set(selectedItemIds);
        groupDragStartRef.current = new Map(
          items
            .filter((i) => selectedSet.has(i.id))
            .map((i) => [i.id, { x: i.x, y: i.y }] as const)
        );
      } else {
        groupDragStartRef.current.clear();
      }
      startDrag(itemId, itemX, itemY, worldX, worldY);
    },
    [items, selectedItemIds, startDrag]
  );

  const selectionBounds = useMemo(() => getSelectionBounds(items, selectedItemIds), [items, selectedItemIds]);

  const canvasStyle: React.CSSProperties = {
    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    transformOrigin: "0 0",
    willChange: "transform",
  };

  const gridStyle = useMemo(() => {
    const BASE_CELL_WORLD = 20;
    const MIN_CELL_PX = 16;
    const MAX_CELL_PX = 40;

    let cellWorld = BASE_CELL_WORLD;
    let cellPx = cellWorld * viewport.zoom;

    while (cellPx > MAX_CELL_PX) {
      cellWorld /= 2;
      cellPx /= 2;
    }
    while (cellPx < MIN_CELL_PX) {
      cellWorld *= 2;
      cellPx *= 2;
    }

    return {
      backgroundImage: `
        linear-gradient(to right, #e5e7eb 1px, transparent 1px),
        linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
      `,
      backgroundSize: `${cellPx}px ${cellPx}px`,
      backgroundPosition: `${viewport.x}px ${viewport.y}px`,
    } satisfies React.CSSProperties;
  }, [viewport.x, viewport.y, viewport.zoom]);

  return (
    <div
      ref={canvasRef}
      className={`relative w-full h-full overflow-hidden bg-gray-50 ${
        activeTool === "eraser" || activeTool === "connect"
          ? "cursor-crosshair"
          : "cursor-grab active:cursor-grabbing"
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Grid background */}
      <div
        className="canvas-background absolute inset-0"
        style={gridStyle}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      />

      {/* Canvas content */}
      <div
        className="absolute inset-0"
        style={canvasStyle}
      >
        {/* Render visible items */}
        {visibleItems.map((item) => {
          const lineOv = getLineEndpointOverride(item.id);
          const posOv = getOverridePosition(item.id);
          const sizeOv = getOverrideSize(item.id, viewport.zoom, item.type);
          const overridePosition = lineOv
            ? { x: lineOv.x as number, y: lineOv.y as number }
            : posOv;
          const overrideSize = lineOv
            ? {
                x: lineOv.x as number,
                y: lineOv.y as number,
                width: lineOv.width as number,
                height: lineOv.height as number,
              }
            : sizeOv;
          const overrideRotation =
            lineOv?.rotation !== undefined && lineOv.rotation !== null
              ? lineOv.rotation
              : undefined;
          const isEditing = editingItemId === item.id;
          const canLineEndpoints =
            (item.type === "line" || (item.type === "connector" && !item.style?.connection)) &&
            selectedItemIds.length === 1 &&
            selectedItemIds.includes(item.id);

          // If we're dragging one of multiple selected items, apply the same delta to all selected items
          // so they move together during the drag (not only on commit).
          const groupDragOverride = (() => {
            if (!isDragging) return null;
            if (selectedItemIds.length <= 1) return null;
            if (!draggingItemId) return null;
            if (!selectedItemIds.includes(draggingItemId)) return null;
            if (!selectedItemIds.includes(item.id)) return null;

            // dragTick is intentionally referenced so this re-evaluates during the rAF loop.
            void dragTick;

            const original = groupDragStartRef.current;
            if (original.size === 0) return null;
            const baseStart = original.get(draggingItemId);
            const draggedPos = getOverridePosition(draggingItemId);
            if (!baseStart || !draggedPos) return null;

            const deltaX = draggedPos.x - baseStart.x;
            const deltaY = draggedPos.y - baseStart.y;

            const start = original.get(item.id);
            if (!start) return null;
            return { x: start.x + deltaX, y: start.y + deltaY };
          })();

          const finalOverridePosition = groupDragOverride ?? overridePosition;
          return (
            <BoardItemContainer
            key={item.id}
            item={item}
              viewport={viewport}
              canvasRef={canvasRef}
            isSelected={selectedItemIds.includes(item.id)}
              selectionCount={selectedItemIds.length}
              overridePosition={finalOverridePosition}
              overrideSize={overrideSize}
              overrideRotation={overrideRotation}
              activeTool={activeTool}
              onEraseItem={onEraseItem}
              onLineEndpointDragStart={
                canLineEndpoints
                  ? (endpoint) => startLineEndpointDrag(item, endpoint)
                  : undefined
              }
              onLineEndpointDragMove={canLineEndpoints ? updateLineEndpointDrag : undefined}
              onLineEndpointDragEnd={canLineEndpoints ? handleLineEndpointDragEnd : undefined}
              // Allow dragging items with any tool (freehand tool handles background drawing separately)
              // Only disable dragging when editing item content
              disableDrag={
                isEditing || (item.type === "connector" && Boolean(item.style?.connection))
              }
              disableResize={
                isEditing || (item.type === "connector" && Boolean(item.style?.connection))
              }
              showConnectAnchors={
                (activeTool === "connect" || connectionDraft !== null) &&
                itemSupportsConnectAnchors(item.type)
              }
              showLinkedConnectorEndpoints={
                (activeTool === "connect" || connectionDraft !== null) &&
                item.type === "connector" &&
                Boolean(item.style?.connection)
              }
              onConnectAnchorPointerDown={
                activeTool === "connect" || connectionDraft !== null
                  ? handleConnectAnchorPointerDown
                  : undefined
              }
            onSelect={(event) => handleItemSelectFromContainer(item.id, event)}
            onUpdate={(updates) => onItemUpdate(item.id, updates)}
              onRequestEdit={() => startEditing(item)}
              onDragStart={handleItemDragStart}
              onDragMove={updateDrag}
              onDragEnd={handleItemDragEnd}
              onResizeStart={startResize}
              onResizeMove={updateResize}
              onResizeEnd={handleItemResizeEnd}
          />
          );
        })}
        {connectionDraft && draftPointerWorld && (() => {
          const x1 = connectionDraft.fromWorld.x;
          const y1 = connectionDraft.fromWorld.y;
          const x2 = draftPointerWorld.x;
          const y2 = draftPointerWorld.y;
          const minX = Math.min(x1, x2) - 4;
          const minY = Math.min(y1, y2) - 4;
          const maxX = Math.max(x1, x2) + 4;
          const maxY = Math.max(y1, y2) + 4;
          const w = Math.max(maxX - minX, 8);
          const h = Math.max(maxY - minY, 8);
          return (
            <svg
              style={{
                position: "absolute",
                left: minX,
                top: minY,
                width: w,
                height: h,
                pointerEvents: "none",
                zIndex: 50,
                overflow: "visible",
              }}
            >
              <line
                x1={x1 - minX}
                y1={y1 - minY}
                x2={x2 - minX}
                y2={y2 - minY}
                stroke="#3b82f6"
                strokeWidth={2 / viewport.zoom}
              />
            </svg>
          );
        })()}
      </div>

      {selectionBounds && selectedItemIds.length > 1 && (
        <div
          className="absolute border-2 border-[#3CCED7]/80 pointer-events-none"
          style={{
            left: selectionBounds.x * viewport.zoom + viewport.x,
            top: selectionBounds.y * viewport.zoom + viewport.y,
            width: selectionBounds.width * viewport.zoom,
            height: selectionBounds.height * viewport.zoom,
            zIndex: 60,
          }}
        />
      )}

      {marqueeRect && (
        <div
          className="absolute border border-[#3CCED7] bg-[#3CCED7]/15/20 pointer-events-none"
          style={{
            left: Math.min(marqueeRect.startX, marqueeRect.currentX) * viewport.zoom + viewport.x,
            top: Math.min(marqueeRect.startY, marqueeRect.currentY) * viewport.zoom + viewport.y,
            width: Math.abs(marqueeRect.currentX - marqueeRect.startX) * viewport.zoom,
            height: Math.abs(marqueeRect.currentY - marqueeRect.startY) * viewport.zoom,
            zIndex: 70,
          }}
        />
      )}

      {/* Freehand draft overlay (in screen coordinates, not world) */}
      {freehandDraft.length > 0 && brushSettings && (
        <svg
          ref={svgOverlayRef}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 10 }}
          viewBox={width > 0 && height > 0 ? `0 0 ${width} ${height}` : "0 0 1 1"}
          preserveAspectRatio="none"
        >
          <path
            ref={svgPathRef}
            fill="none"
            stroke={brushSettings.strokeColor}
            strokeWidth={brushSettings.strokeWidth * viewport.zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
            shapeRendering="geometricPrecision"
          />
        </svg>
      )}

      {/* Inline content editor overlay */}
      {editingItemId && editorRect && (
        <InlineContentEditor
          rect={editorRect}
          value={draftContent}
          onChange={setDraftContent}
          onCommit={commitEditing}
          onCancel={cancelEditing}
          multiline={
            items.find((i) => i.id === editingItemId)?.type === "sticky_note" ||
            items.find((i) => i.id === editingItemId)?.type === "shape"
          }
        />
      )}
    </div>
  );
}

