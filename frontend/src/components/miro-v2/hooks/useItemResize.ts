import { useState, useCallback, useRef, useEffect } from 'react';

type ResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface ResizeState {
  itemId: string;
  corner: ResizeCorner;
  startClientX: number;
  startClientY: number;
  startItemX: number;
  startItemY: number;
  startItemWidth: number;
  startItemHeight: number;
}

export function useItemResize() {
  // Store resize state and coords in refs (no re-renders on update)
  const resizeStateRef = useRef<ResizeState | null>(null);
  const currentClientXRef = useRef<number>(0);
  const currentClientYRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // Only track if resizing (for external state checks)
  const [isResizing, setIsResizing] = useState(false);
  // Tick counter for triggering re-renders via rAF
  const [resizeTick, setResizeTick] = useState(0);

  // RequestAnimationFrame loop to update UI during resize
  useEffect(() => {
    if (isResizing) {
      const tick = () => {
        setResizeTick((prev) => prev + 1);
        rafIdRef.current = requestAnimationFrame(tick);
      };
      rafIdRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      };
    } else {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    }
  }, [isResizing]);

  const startResize = useCallback((
    itemId: string,
    corner: ResizeCorner,
    itemX: number,
    itemY: number,
    itemWidth: number,
    itemHeight: number,
    clientX: number,
    clientY: number
  ) => {
    resizeStateRef.current = {
      itemId,
      corner,
      startClientX: clientX,
      startClientY: clientY,
      startItemX: itemX,
      startItemY: itemY,
      startItemWidth: itemWidth,
      startItemHeight: itemHeight,
    };
    currentClientXRef.current = clientX;
    currentClientYRef.current = clientY;
    setIsResizing(true);
  }, []);

  const updateResize = useCallback((clientX: number, clientY: number) => {
    if (!resizeStateRef.current) return;
    currentClientXRef.current = clientX;
    currentClientYRef.current = clientY;
    // rAF will trigger re-render via resizeTick
  }, []);

  const endResize = useCallback((viewportZoom: number): {
    itemId: string;
    newX: number;
    newY: number;
    newWidth: number;
    newHeight: number;
  } | null => {
    const resizeState = resizeStateRef.current;
    if (!resizeState) return null;

    // Convert screen delta to world delta (accounting for zoom)
    const deltaX = (currentClientXRef.current - resizeState.startClientX) / viewportZoom;
    const deltaY = (currentClientYRef.current - resizeState.startClientY) / viewportZoom;

    let newX = resizeState.startItemX;
    let newY = resizeState.startItemY;
    let newWidth = resizeState.startItemWidth;
    let newHeight = resizeState.startItemHeight;

    const { corner } = resizeState;

    // Calculate new dimensions based on corner
    if (corner === 'top-left') {
      newX = resizeState.startItemX + deltaX;
      newY = resizeState.startItemY + deltaY;
      newWidth = resizeState.startItemWidth - deltaX;
      newHeight = resizeState.startItemHeight - deltaY;
    } else if (corner === 'top-right') {
      newY = resizeState.startItemY + deltaY;
      newWidth = resizeState.startItemWidth + deltaX;
      newHeight = resizeState.startItemHeight - deltaY;
    } else if (corner === 'bottom-left') {
      newX = resizeState.startItemX + deltaX;
      newWidth = resizeState.startItemWidth - deltaX;
      newHeight = resizeState.startItemHeight + deltaY;
    } else if (corner === 'bottom-right') {
      newWidth = resizeState.startItemWidth + deltaX;
      newHeight = resizeState.startItemHeight + deltaY;
    }

    // Apply minimum size constraints
    const MIN_SIZE = 20;
    if (newWidth < MIN_SIZE) {
      if (corner === 'top-left' || corner === 'bottom-left') {
        newX = resizeState.startItemX + resizeState.startItemWidth - MIN_SIZE;
      }
      newWidth = MIN_SIZE;
    }
    if (newHeight < MIN_SIZE) {
      if (corner === 'top-left' || corner === 'top-right') {
        newY = resizeState.startItemY + resizeState.startItemHeight - MIN_SIZE;
      }
      newHeight = MIN_SIZE;
    }

    const result = {
      itemId: resizeState.itemId,
      newX,
      newY,
      newWidth,
      newHeight,
    };

    resizeStateRef.current = null;
    currentClientXRef.current = 0;
    currentClientYRef.current = 0;
    setIsResizing(false);

    return result;
  }, []);

  const getOverrideSize = useCallback((
    itemId: string,
    viewportZoom: number,
    itemType?: string
  ): { x: number; y: number; width: number; height: number } | null => {
    const resizeState = resizeStateRef.current;
    if (!resizeState || resizeState.itemId !== itemId) return null;

    const deltaX = (currentClientXRef.current - resizeState.startClientX) / viewportZoom;
    const deltaY = (currentClientYRef.current - resizeState.startClientY) / viewportZoom;

    // For connector/line, only allow width changes (horizontal resize)
    const isHorizontalOnly = itemType === 'connector' || itemType === 'line';

    let newX = resizeState.startItemX;
    let newY = resizeState.startItemY;
    let newWidth = resizeState.startItemWidth;
    let newHeight = resizeState.startItemHeight;

    const { corner } = resizeState;

    if (isHorizontalOnly) {
      // Only adjust width, keep height and Y position fixed
      if (corner === 'top-left' || corner === 'bottom-left') {
        newX = resizeState.startItemX + deltaX;
        newWidth = resizeState.startItemWidth - deltaX;
      } else {
        // top-right or bottom-right
        newWidth = resizeState.startItemWidth + deltaX;
      }
      // Keep original height and Y
      newHeight = resizeState.startItemHeight;
      newY = resizeState.startItemY;
    } else {
      // Full resize for other items
      if (corner === 'top-left') {
        newX = resizeState.startItemX + deltaX;
        newY = resizeState.startItemY + deltaY;
        newWidth = resizeState.startItemWidth - deltaX;
        newHeight = resizeState.startItemHeight - deltaY;
      } else if (corner === 'top-right') {
        newY = resizeState.startItemY + deltaY;
        newWidth = resizeState.startItemWidth + deltaX;
        newHeight = resizeState.startItemHeight - deltaY;
      } else if (corner === 'bottom-left') {
        newX = resizeState.startItemX + deltaX;
        newWidth = resizeState.startItemWidth - deltaX;
        newHeight = resizeState.startItemHeight + deltaY;
      } else if (corner === 'bottom-right') {
        newWidth = resizeState.startItemWidth + deltaX;
        newHeight = resizeState.startItemHeight + deltaY;
      }
    }

    // Apply minimum size constraints
    const MIN_SIZE = 20;
    if (newWidth < MIN_SIZE) {
      if (corner === 'top-left' || corner === 'bottom-left') {
        newX = resizeState.startItemX + resizeState.startItemWidth - MIN_SIZE;
      }
      newWidth = MIN_SIZE;
    }
    if (!isHorizontalOnly && newHeight < MIN_SIZE) {
      if (corner === 'top-left' || corner === 'top-right') {
        newY = resizeState.startItemY + resizeState.startItemHeight - MIN_SIZE;
      }
      newHeight = MIN_SIZE;
    }

    return { x: newX, y: newY, width: newWidth, height: newHeight };
  }, []);

  const resizingItemId = resizeStateRef.current?.itemId || null;

  return {
    isResizing,
    resizingItemId,
    startResize,
    updateResize,
    endResize,
    getOverrideSize,
    resizeTick, // Exposed for components that need to know when to re-read from refs
  };
}

