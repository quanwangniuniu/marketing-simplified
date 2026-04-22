"use client";

import React, { useCallback, memo } from "react";
import { BoardItem } from "@/lib/api/miroApi";
import { Viewport } from "../hooks/useBoardViewport";
import { ToolType } from "../hooks/useToolDnD";
import BoardItemRenderer from "./BoardItemRenderer";
import { usesLinePivotTransform } from "../utils/lineEndpointMath";
import type { LineEndpoint } from "../hooks/useLineEndpointDrag";
import type { AnchorSide, ConnectionStyle } from "../utils/connectorLayout";
import { itemSupportsConnectAnchors } from "../utils/connectorLayout";

type ResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface BoardItemContainerProps {
  item: BoardItem;
  viewport: Viewport;
  canvasRef: React.RefObject<HTMLDivElement>;
  isSelected: boolean;
  selectionCount?: number;
  overridePosition: { x: number; y: number } | null;
  overrideSize?: { x: number; y: number; width: number; height: number } | null;
  overrideRotation?: number | null;
  activeTool?: ToolType;
  disableDrag?: boolean;
  disableResize?: boolean;
  onLineEndpointDragStart?: (endpoint: LineEndpoint) => void;
  onLineEndpointDragMove?: (worldX: number, worldY: number) => void;
  onLineEndpointDragEnd?: () => void;
  onEraseItem?: (itemId: string) => void;
  onSelect: (event?: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => void;
  onUpdate: (updates: Partial<BoardItem>) => void;
  onRequestEdit?: () => void;
  onDragStart: (itemId: string, itemX: number, itemY: number, worldX: number, worldY: number) => void;
  onDragMove: (worldX: number, worldY: number) => void;
  onDragEnd: () => void;
  onResizeStart: (itemId: string, corner: ResizeCorner, itemX: number, itemY: number, itemWidth: number, itemHeight: number, clientX: number, clientY: number) => void;
  onResizeMove: (clientX: number, clientY: number) => void;
  onResizeEnd: () => void;
  showConnectAnchors?: boolean;
  showLinkedConnectorEndpoints?: boolean;
  onConnectAnchorPointerDown?: (itemId: string, anchor: AnchorSide, e: React.PointerEvent) => void;
}

const BoardItemContainer = memo(function BoardItemContainer({
  item,
  viewport,
  canvasRef,
  isSelected,
  selectionCount = 1,
  overridePosition,
  overrideSize,
  overrideRotation,
  activeTool,
  disableDrag = false,
  disableResize = false,
  onLineEndpointDragStart,
  onLineEndpointDragMove,
  onLineEndpointDragEnd,
  onEraseItem,
  onSelect,
  onUpdate,
  onRequestEdit,
  onDragStart,
  onDragMove,
  onDragEnd,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  showConnectAnchors = false,
  showLinkedConnectorEndpoints = false,
  onConnectAnchorPointerDown,
}: BoardItemContainerProps) {
  // Treat pointer interaction as click by default; only become a drag after moving past a small threshold.
  const isDraggingRef = React.useRef(false);
  const dragActivatedRef = React.useRef(false);
  const startClientRef = React.useRef<{ x: number; y: number } | null>(null);
  const DRAG_THRESHOLD_PX = 3;

  // Resize state
  const isResizingRef = React.useRef(false);
  const resizeCornerRef = React.useRef<ResizeCorner | null>(null);
  const isLineEndpointDraggingRef = React.useRef(false);

  const cleanupPointerInteraction = useCallback((target: Element, pointerId?: number) => {
    isDraggingRef.current = false;
    dragActivatedRef.current = false;
    startClientRef.current = null;

    if (typeof pointerId === "number") {
      try {
        if ((target as any).hasPointerCapture?.(pointerId)) {
          (target as any).releasePointerCapture?.(pointerId);
        }
      } catch {
        // no-op: avoid blocking UI if browser throws
      }
    }
  }, []);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      return {
        x: (screenX - viewport.x) / viewport.zoom,
        y: (screenY - viewport.y) / viewport.zoom,
      };
    },
    [viewport, canvasRef]
  );

  const handleResizeHandleDown = useCallback(
    (e: React.PointerEvent, corner: ResizeCorner) => {
      e.stopPropagation();
      e.preventDefault();

      isResizingRef.current = true;
      resizeCornerRef.current = corner;

      const currentX = overrideSize?.x ?? overridePosition?.x ?? item.x;
      const currentY = overrideSize?.y ?? overridePosition?.y ?? item.y;
      const currentWidth = overrideSize?.width ?? item.width;
      const currentHeight = overrideSize?.height ?? item.height;

      onResizeStart(
        item.id,
        corner,
        currentX,
        currentY,
        currentWidth,
        currentHeight,
        e.clientX,
        e.clientY
      );

      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [item, overridePosition, overrideSize, onResizeStart]
  );

  const handleLineEndpointPointerDown = useCallback(
    (e: React.PointerEvent, endpoint: LineEndpoint) => {
      e.stopPropagation();
      e.preventDefault();
      if (!onLineEndpointDragStart || !onLineEndpointDragMove || !onLineEndpointDragEnd) return;
      isLineEndpointDraggingRef.current = true;
      onLineEndpointDragStart(endpoint);
      const w = screenToWorld(e.clientX, e.clientY);
      onLineEndpointDragMove(w.x, w.y);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [onLineEndpointDragStart, onLineEndpointDragMove, onLineEndpointDragEnd, screenToWorld]
  );

  const handleLineEndpointPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isLineEndpointDraggingRef.current || !onLineEndpointDragMove) return;
      const w = screenToWorld(e.clientX, e.clientY);
      onLineEndpointDragMove(w.x, w.y);
    },
    [onLineEndpointDragMove, screenToWorld]
  );

  const handleLineEndpointPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isLineEndpointDraggingRef.current) return;
      isLineEndpointDraggingRef.current = false;
      onLineEndpointDragEnd?.();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    },
    [onLineEndpointDragEnd]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest(".connect-anchor-handle")) {
        return;
      }
      if ((e.target as HTMLElement).classList.contains("line-endpoint-handle")) {
        return;
      }
      // Don't start drag if clicking on a resize handle
      if ((e.target as HTMLElement).classList.contains('resize-handle')) {
        return;
      }

      // In freehand tool mode, don't interfere with drawing by stopping propagation or capturing pointer
      // Allow events to bubble to BoardCanvas for freehand drawing handling
      if (activeTool === "freehand") {
        // Still allow selection on click
        onSelect({ shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey });
        return;
      }

      // In connect tool mode, avoid selecting/dragging items; user should only interact with connect anchors.
      if (activeTool === "connect") {
        return;
      }

      // Only allow selecting/dragging when clicking an actual hit region inside the item renderer.
      // This prevents selecting by clicking empty space inside the item's bounding box.
      const targetEl = e.target as HTMLElement | null;
      const hitRegion = targetEl?.closest?.('[data-hit-region="true"]');
      if (!hitRegion) {
        return;
      }

      if (activeTool === "eraser") {
        e.stopPropagation();
        onEraseItem?.(item.id);
        return;
      }

      e.stopPropagation();
      // Select immediately so properties panel opens without waiting for click.
      onSelect({ shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey });

      if (disableDrag) {
        return;
      }

      startClientRef.current = { x: e.clientX, y: e.clientY };
      dragActivatedRef.current = false;
      isDraggingRef.current = true;

      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [onSelect, disableDrag, activeTool, onEraseItem, item.id]
  );

  const handleResizeHandleMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizingRef.current) return;
      onResizeMove(e.clientX, e.clientY);
    },
    [onResizeMove]
  );

  const handleResizeHandleUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      resizeCornerRef.current = null;
      onResizeEnd();
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
    [onResizeEnd]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Handle resize if active
      if (isResizingRef.current) {
        handleResizeHandleMove(e);
        return;
      }

      if (disableDrag) return;
      if (!isDraggingRef.current) return;
      const start = startClientRef.current;
      if (!start) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const movedFarEnough = Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX;

      // Activate drag only after threshold so clicks don't trigger drag + PATCH.
      if (!dragActivatedRef.current) {
        if (!movedFarEnough) return;
        dragActivatedRef.current = true;

        const world = screenToWorld(start.x, start.y);
        const currentX = overridePosition?.x ?? item.x;
        const currentY = overridePosition?.y ?? item.y;
        onDragStart(item.id, currentX, currentY, world.x, world.y);
      }

      const world = screenToWorld(e.clientX, e.clientY);
      onDragMove(world.x, world.y);
    },
    [screenToWorld, onDragMove, onDragStart, item, overridePosition, disableDrag, handleResizeHandleMove]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      // Handle resize end if active
      if (isResizingRef.current) {
        handleResizeHandleUp(e);
        return;
      }

      if (disableDrag) return;
      if (!isDraggingRef.current) return;

      const wasDrag = dragActivatedRef.current;
      cleanupPointerInteraction(e.currentTarget, e.pointerId);
      if (wasDrag) onDragEnd();
    },
    [onDragEnd, disableDrag, cleanupPointerInteraction, handleResizeHandleUp]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (disableDrag) return;
      cleanupPointerInteraction(e.currentTarget, e.pointerId);
    },
    [disableDrag, cleanupPointerInteraction]
  );

  const handleLostPointerCapture = useCallback(
    (e: React.PointerEvent) => {
      if (disableDrag) return;
      cleanupPointerInteraction(e.currentTarget, e.pointerId);
    },
    [disableDrag, cleanupPointerInteraction]
  );

  const currentX = overrideSize?.x ?? overridePosition?.x ?? item.x;
  const currentY = overrideSize?.y ?? overridePosition?.y ?? item.y;
  const currentWidth = overrideSize?.width ?? item.width;
  const currentHeight = overrideSize?.height ?? item.height;

  const rotationDeg = overrideRotation ?? item.rotation ?? 0;

  const itemStyle: React.CSSProperties = {
    position: "absolute",
    left: `${currentX}px`,
    top: `${currentY}px`,
    width: `${currentWidth}px`,
    height: `${currentHeight}px`,
    transform: `rotate(${rotationDeg}deg)`,
    transformOrigin: usesLinePivotTransform(item) ? "0 50%" : "50% 50%",
    zIndex: item.z_index,
    cursor: activeTool === "connect" ? "crosshair" : "move",
  };

  const HANDLE_SIZE = 8;
  const HANDLE_OFFSET = -HANDLE_SIZE / 2;

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // Only allow editing for items that support content
      const editableTypes: Array<BoardItem["type"]> = [
        "text",
        "sticky_note",
        "shape",
        "line",
        "connector",
      ];
      if (editableTypes.includes(item.type) && onRequestEdit) {
        onRequestEdit();
      }
    },
    [item.type, onRequestEdit]
  );

  const showLineEndpoints =
    isSelected &&
    !disableResize &&
    selectionCount === 1 &&
    onLineEndpointDragStart &&
    onLineEndpointDragMove &&
    onLineEndpointDragEnd &&
    (item.type === "line" || (item.type === "connector" && !item.style?.connection));

  const renderLineEndpointHandles = () => {
    if (!showLineEndpoints) return null;
    const midY = "50%";
    return (
      <>
        <div
          className="line-endpoint-handle"
          style={{
            position: "absolute",
            left: `${HANDLE_OFFSET}px`,
            top: midY,
            width: `${HANDLE_SIZE}px`,
            height: `${HANDLE_SIZE}px`,
            marginTop: `${HANDLE_OFFSET}px`,
            backgroundColor: "#3b82f6",
            border: "1px solid white",
            borderRadius: "50%",
            cursor: "grab",
            zIndex: 1000,
          }}
          onPointerDown={(e) => handleLineEndpointPointerDown(e, "start")}
          onPointerMove={handleLineEndpointPointerMove}
          onPointerUp={handleLineEndpointPointerUp}
          onPointerCancel={handleLineEndpointPointerUp}
          onLostPointerCapture={handleLineEndpointPointerUp}
        />
        <div
          className="line-endpoint-handle"
          style={{
            position: "absolute",
            left: `calc(100% + ${HANDLE_OFFSET}px)`,
            top: midY,
            width: `${HANDLE_SIZE}px`,
            height: `${HANDLE_SIZE}px`,
            marginTop: `${HANDLE_OFFSET}px`,
            backgroundColor: "#3b82f6",
            border: "1px solid white",
            borderRadius: "50%",
            cursor: "grab",
            zIndex: 1000,
          }}
          onPointerDown={(e) => handleLineEndpointPointerDown(e, "end")}
          onPointerMove={handleLineEndpointPointerMove}
          onPointerUp={handleLineEndpointPointerUp}
          onPointerCancel={handleLineEndpointPointerUp}
          onLostPointerCapture={handleLineEndpointPointerUp}
        />
      </>
    );
  };

  const ANCHOR_SIZE = 11;
  const ANCHOR_OFF = -ANCHOR_SIZE / 2;

  const parseLinkedConnectorEndpointLocalPoints = useCallback((): { start: { x: number; y: number }; end: { x: number; y: number } } | null => {
    const svgPath = typeof item.style?.svgPath === "string" ? item.style.svgPath : null;
    if (!svgPath) return null;
    // Expected format from connectorLayout: `M x y ... L x y` (end)
    // We keep parsing intentionally simple and resilient.
    const nums = svgPath.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
    if (!nums || nums.length < 4) return null;
    const toNum = (s: string) => Number.parseFloat(s);
    const start = { x: toNum(nums[0]), y: toNum(nums[1]) };
    const end = { x: toNum(nums[nums.length - 2]), y: toNum(nums[nums.length - 1]) };
    if (!Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(end.x) || !Number.isFinite(end.y)) return null;
    return { start, end };
  }, [item.style]);

  const renderLinkedConnectorEndpointHandles = () => {
    if (!showLinkedConnectorEndpoints || !onConnectAnchorPointerDown) return null;
    if (item.type !== "connector" || !item.style?.connection) return null;
    const conn = item.style.connection as ConnectionStyle;
    const fromItemId = conn.fromItemId;
    const toItemId = conn.toItemId;
    const fromAnchor = conn.fromAnchor;
    const toAnchor = conn.toAnchor;
    if (!fromItemId || !toItemId || !fromAnchor || !toAnchor) return null;

    const pts = parseLinkedConnectorEndpointLocalPoints();
    if (!pts) return null;

    const baseStyle: React.CSSProperties = {
      position: "absolute",
      width: `${ANCHOR_SIZE}px`,
      height: `${ANCHOR_SIZE}px`,
      borderRadius: "50%",
      border: "2px solid #3b82f6",
      backgroundColor: "rgba(255,255,255,0.95)",
      boxSizing: "border-box",
      cursor: "crosshair",
      zIndex: 1002,
      pointerEvents: "auto",
    };

    const placeAt = (p: { x: number; y: number }): React.CSSProperties => ({
      ...baseStyle,
      left: `${p.x + ANCHOR_OFF}px`,
      top: `${p.y + ANCHOR_OFF}px`,
    });

    return (
      <>
        <div
          className="connect-anchor-handle"
          style={placeAt(pts.start)}
          onPointerDown={(e) => onConnectAnchorPointerDown(fromItemId, fromAnchor, e)}
        />
        <div
          className="connect-anchor-handle"
          style={placeAt(pts.end)}
          onPointerDown={(e) => onConnectAnchorPointerDown(toItemId, toAnchor, e)}
        />
      </>
    );
  };

  const renderConnectAnchors = () => {
    if (!showConnectAnchors || !onConnectAnchorPointerDown || !itemSupportsConnectAnchors(item.type)) {
      return null;
    }
    const sides: AnchorSide[] = ["left", "right", "top", "bottom"];
    const styleFor = (side: AnchorSide): React.CSSProperties => {
      const base: React.CSSProperties = {
        position: "absolute",
        width: `${ANCHOR_SIZE}px`,
        height: `${ANCHOR_SIZE}px`,
        borderRadius: "50%",
        border: "2px solid #3b82f6",
        backgroundColor: "rgba(255,255,255,0.95)",
        boxSizing: "border-box",
        cursor: "crosshair",
        zIndex: 1001,
        pointerEvents: "auto",
      };
      if (side === "left")
        return { ...base, left: ANCHOR_OFF, top: "50%", marginTop: ANCHOR_OFF };
      if (side === "right")
        return { ...base, right: ANCHOR_OFF, top: "50%", marginTop: ANCHOR_OFF };
      if (side === "top")
        return { ...base, top: ANCHOR_OFF, left: "50%", marginLeft: ANCHOR_OFF };
      return { ...base, bottom: ANCHOR_OFF, left: "50%", marginLeft: ANCHOR_OFF };
    };
    return (
      <>
        {sides.map((side) => (
          <div
            key={side}
            className="connect-anchor-handle"
            data-connect-anchor="true"
            data-item-id={item.id}
            data-anchor={side}
            style={styleFor(side)}
            onPointerDown={(e) => onConnectAnchorPointerDown(item.id, side, e)}
          />
        ))}
      </>
    );
  };

  const renderResizeHandles = () => {
    if (!isSelected || disableResize) return null;
    if (showLineEndpoints) return renderLineEndpointHandles();

    const handles: Array<{ corner: ResizeCorner; style: React.CSSProperties }> = [
      {
        corner: 'top-left',
        style: {
          position: 'absolute',
          left: `${HANDLE_OFFSET}px`,
          top: `${HANDLE_OFFSET}px`,
          width: `${HANDLE_SIZE}px`,
          height: `${HANDLE_SIZE}px`,
          backgroundColor: '#3b82f6',
          border: '1px solid white',
          borderRadius: '2px',
          cursor: 'nwse-resize',
          zIndex: 1000,
        },
      },
      {
        corner: 'top-right',
        style: {
          position: 'absolute',
          right: `${HANDLE_OFFSET}px`,
          top: `${HANDLE_OFFSET}px`,
          width: `${HANDLE_SIZE}px`,
          height: `${HANDLE_SIZE}px`,
          backgroundColor: '#3b82f6',
          border: '1px solid white',
          borderRadius: '2px',
          cursor: 'nesw-resize',
          zIndex: 1000,
        },
      },
      {
        corner: 'bottom-left',
        style: {
          position: 'absolute',
          left: `${HANDLE_OFFSET}px`,
          bottom: `${HANDLE_OFFSET}px`,
          width: `${HANDLE_SIZE}px`,
          height: `${HANDLE_SIZE}px`,
          backgroundColor: '#3b82f6',
          border: '1px solid white',
          borderRadius: '2px',
          cursor: 'nesw-resize',
          zIndex: 1000,
        },
      },
      {
        corner: 'bottom-right',
        style: {
          position: 'absolute',
          right: `${HANDLE_OFFSET}px`,
          bottom: `${HANDLE_OFFSET}px`,
          width: `${HANDLE_SIZE}px`,
          height: `${HANDLE_SIZE}px`,
          backgroundColor: '#3b82f6',
          border: '1px solid white',
          borderRadius: '2px',
          cursor: 'nwse-resize',
          zIndex: 1000,
        },
      },
    ];

    return (
      <>
        {handles.map(({ corner, style }) => (
          <div
            key={corner}
            className="resize-handle"
            style={style}
            onPointerDown={(e) => handleResizeHandleDown(e, corner)}
            onPointerMove={handleResizeHandleMove}
            onPointerUp={handleResizeHandleUp}
            onPointerCancel={handleResizeHandleUp}
            onLostPointerCapture={handleResizeHandleUp}
          />
        ))}
      </>
    );
  };

  return (
    <div
      data-board-item="true"
      style={itemStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
      onDoubleClick={handleDoubleClick}
    >
      <BoardItemRenderer
        item={item}
        isSelected={isSelected}
        onSelect={onSelect}
        onUpdate={onUpdate}
      />
      {renderConnectAnchors()}
      {renderLinkedConnectorEndpointHandles()}
      {renderResizeHandles()}
    </div>
  );
});

export default BoardItemContainer;

