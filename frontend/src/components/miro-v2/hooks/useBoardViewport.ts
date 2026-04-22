import { useState, useCallback, useRef } from 'react';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export function useBoardViewport(initialViewport: Viewport) {
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;

  const clampZoom = useCallback(
    (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)),
    []
  );

  const [viewport, _setViewport] = useState<Viewport>({
    ...initialViewport,
    zoom: clampZoom(initialViewport.zoom),
  });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Coordinate conversion
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      return {
        x: (screenX - viewport.x) / viewport.zoom,
        y: (screenY - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number) => {
      return {
        x: worldX * viewport.zoom + viewport.x,
        y: worldY * viewport.zoom + viewport.y,
      };
    },
    [viewport]
  );

  // Zoom at mouse position
  const zoomAtPoint = useCallback(
    (mouseX: number, mouseY: number, zoomDelta: number) => {
      _setViewport((prev) => {
        const worldPoint = {
          x: (mouseX - prev.x) / prev.zoom,
          y: (mouseY - prev.y) / prev.zoom,
        };

        const newZoom = clampZoom(prev.zoom * (1 + zoomDelta));
        const newX = mouseX - worldPoint.x * newZoom;
        const newY = mouseY - worldPoint.y * newZoom;

        return { x: newX, y: newY, zoom: newZoom };
      });
    },
    [clampZoom]
  );

  // Expose a clamped setViewport so all callers respect 50%~300%
  const setViewport = useCallback(
    (next: Viewport | ((prev: Viewport) => Viewport)) => {
      _setViewport((prev) => {
        const v = typeof next === "function" ? (next as any)(prev) : next;
        return { ...v, zoom: clampZoom(v.zoom) };
      });
    },
    [clampZoom]
  );

  // Pan handlers
  const startPan = useCallback(
    (startX: number, startY: number) => {
      isPanningRef.current = true;
      panStartRef.current = { x: startX - viewport.x, y: startY - viewport.y };
    },
    [viewport]
  );

  const updatePan = useCallback((currentX: number, currentY: number) => {
    if (!isPanningRef.current) return;
    _setViewport((prev) => ({
      ...prev,
      x: currentX - panStartRef.current.x,
      y: currentY - panStartRef.current.y,
    }));
  }, []);

  const endPan = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    _setViewport((prev) => ({
      ...prev,
      x: prev.x - dx,
      y: prev.y - dy,
    }));
  }, []);

  return {
    viewport,
    setViewport,
    screenToWorld,
    worldToScreen,
    zoomAtPoint,
    startPan,
    updatePan,
    endPan,
    panBy,
  };
}

