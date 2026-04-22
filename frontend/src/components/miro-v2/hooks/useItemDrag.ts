import { useState, useCallback, useRef, useEffect } from 'react';

interface DragState {
  itemId: string;
  startWorldX: number;
  startWorldY: number;
  startItemX: number;
  startItemY: number;
}

export function useItemDrag() {
  // Store drag state and coords in refs (no re-renders on update)
  const dragStateRef = useRef<DragState | null>(null);
  const currentWorldXRef = useRef<number>(0);
  const currentWorldYRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // Only track if dragging (for external state checks)
  const [isDragging, setIsDragging] = useState(false);
  // Tick counter for triggering re-renders via rAF
  const [dragTick, setDragTick] = useState(0);

  // RequestAnimationFrame loop to update UI during drag
  useEffect(() => {
    if (isDragging) {
      const tick = () => {
        setDragTick((prev) => prev + 1);
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
  }, [isDragging]);

  const startDrag = useCallback((
    itemId: string,
    itemX: number,
    itemY: number,
    worldX: number,
    worldY: number
  ) => {
    dragStateRef.current = {
      itemId,
      startWorldX: worldX,
      startWorldY: worldY,
      startItemX: itemX,
      startItemY: itemY,
    };
    currentWorldXRef.current = worldX;
    currentWorldYRef.current = worldY;
    setIsDragging(true);
  }, []);

  const updateDrag = useCallback((worldX: number, worldY: number) => {
    if (!dragStateRef.current) return;
    currentWorldXRef.current = worldX;
    currentWorldYRef.current = worldY;
    // rAF will trigger re-render via dragTick
  }, []);

  const endDrag = useCallback((): { itemId: string; newX: number; newY: number } | null => {
    const dragState = dragStateRef.current;
    if (!dragState) return null;

    const deltaX = currentWorldXRef.current - dragState.startWorldX;
    const deltaY = currentWorldYRef.current - dragState.startWorldY;

    const result = {
      itemId: dragState.itemId,
      newX: dragState.startItemX + deltaX,
      newY: dragState.startItemY + deltaY,
    };

    dragStateRef.current = null;
    currentWorldXRef.current = 0;
    currentWorldYRef.current = 0;
    setIsDragging(false);

    return result;
  }, []);

  const getOverridePosition = useCallback((itemId: string): { x: number; y: number } | null => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.itemId !== itemId) return null;

    const deltaX = currentWorldXRef.current - dragState.startWorldX;
    const deltaY = currentWorldYRef.current - dragState.startWorldY;

    return {
      x: dragState.startItemX + deltaX,
      y: dragState.startItemY + deltaY,
    };
  }, []); // No dependencies - reads from refs

  const draggingItemId = dragStateRef.current?.itemId || null;

  return {
    isDragging,
    draggingItemId,
    startDrag,
    updateDrag,
    endDrag,
    getOverridePosition,
    dragTick, // Exposed for components that need to know when to re-read from refs
  };
}
