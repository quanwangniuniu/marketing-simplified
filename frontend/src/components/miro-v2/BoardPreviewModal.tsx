"use client";

import React, { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { BoardItem } from "@/lib/api/miroApi";
import { useBoardViewport, Viewport } from "./hooks/useBoardViewport";
import BoardItemRenderer from "./items/BoardItemRenderer";

interface BoardPreviewModalProps {
  open: boolean;
  items: BoardItem[];
  onClose: () => void;
}

export default function BoardPreviewModal({
  open,
  items,
  onClose,
}: BoardPreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const {
    viewport,
    setViewport,
    screenToWorld,
    zoomAtPoint,
    startPan,
    updatePan,
    endPan,
  } = useBoardViewport({ x: 0, y: 0, zoom: 1 });

  // Measure container size with ResizeObserver
  useEffect(() => {
    if (!open || !containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setContainerSize({ width: clientWidth, height: clientHeight });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [open]);

  // Auto-fit to items on open
  useEffect(() => {
    if (!open || containerSize.width <= 0 || containerSize.height <= 0) return;

    const visibleItems = items.filter((item) => !item.is_deleted);
    if (visibleItems.length === 0) {
      setViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }

    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    visibleItems.forEach((item) => {
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x + item.width);
      maxY = Math.max(maxY, item.y + item.height);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    if (contentWidth === 0 || contentHeight === 0) {
      setViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }

    const padding = 50;
    const zoomX = (containerSize.width - padding * 2) / contentWidth;
    const zoomY = (containerSize.height - padding * 2) / contentHeight;
    const zoomUnclamped = Math.min(zoomX, zoomY, 1);
    const zoom = Math.max(0.5, Math.min(3, zoomUnclamped));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const x = containerSize.width / 2 - centerX * zoom;
    const y = containerSize.height / 2 - centerY * zoom;

    setViewport({ x, y, zoom });
  }, [open, items, containerSize, setViewport]);

  // Handle wheel zoom (non-passive listener)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !open) return;

    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomDelta = -e.deltaY * 0.001;
      zoomAtPoint(mouseX, mouseY, zoomDelta);
    };

    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => el.removeEventListener("wheel", wheelHandler as any);
  }, [open, zoomAtPoint]);

  // Handle pan
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only left mouse button
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
      e.preventDefault();
    },
    [viewport]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    setViewport({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
      zoom: viewport.zoom,
    });
  }, [viewport.zoom, setViewport]);

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  // Handle ESC key
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  // Viewport culling and sorting (same logic as BoardCanvas)
  const visibleItems = useMemo(() => {
    if (containerSize.width <= 0 || containerSize.height <= 0) {
      const filtered = items.filter((item) => !item.is_deleted);
      return filtered.sort((a, b) => {
        const aIsFrame = a.type === "frame";
        const bIsFrame = b.type === "frame";
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

    const buffer = 100;
    const bufferWorld = buffer / viewport.zoom;

    const topLeft = {
      x: (0 - viewport.x) / viewport.zoom,
      y: (0 - viewport.y) / viewport.zoom,
    };
    const bottomRight = {
      x: (containerSize.width - viewport.x) / viewport.zoom,
      y: (containerSize.height - viewport.y) / viewport.zoom,
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

    return filtered.sort((a, b) => {
      const aIsFrame = a.type === "frame";
      const bIsFrame = b.type === "frame";
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
  }, [items, viewport, containerSize]);

  if (!open) return null;

  const canvasStyle: React.CSSProperties = {
    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    transformOrigin: "0 0",
    willChange: "transform",
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative transform overflow-hidden rounded-lg bg-white shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-7xl w-full h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
            <h3 className="text-lg font-semibold text-gray-900">Preview</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Canvas Container */}
          <div
            ref={containerRef}
            className="flex-1 relative overflow-hidden bg-gray-50"
          >
            <div
              ref={canvasRef}
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Grid background */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                    linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                  `,
                  backgroundSize: (() => {
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
                    return `${cellPx}px ${cellPx}px`;
                  })(),
                  backgroundPosition: `${viewport.x}px ${viewport.y}px`,
                }}
              />

              {/* Canvas content */}
              <div className="absolute inset-0" style={canvasStyle}>
                {/* Render visible items (readonly) */}
                {visibleItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      position: "absolute",
                      left: `${item.x}px`,
                      top: `${item.y}px`,
                      width: `${item.width}px`,
                      height: `${item.height}px`,
                      pointerEvents: "none", // Readonly: disable interactions
                    }}
                  >
                    <BoardItemRenderer
                      item={item}
                      isSelected={false}
                      onSelect={() => {}} // No-op in readonly mode
                      onUpdate={() => {}} // No-op in readonly mode
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t bg-gray-50 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span>Zoom: {Math.round(viewport.zoom * 100)}%</span>
              <span>Items: {visibleItems.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

