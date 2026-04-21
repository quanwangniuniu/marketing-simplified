import { useCallback, useRef, useState } from "react";
import { BoardItem } from "@/lib/api/miroApi";
import { lineEndpointsWorld, lineItemFromPivotAndEndWorld } from "../utils/lineEndpointMath";

export type LineEndpoint = "start" | "end";

type DragState = {
  itemId: string;
  moving: LineEndpoint;
  fixedWorld: { x: number; y: number };
  height: number;
};

export function useLineEndpointDrag() {
  const dragRef = useRef<DragState | null>(null);
  const [tick, setTick] = useState(0);
  const currentWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const startDrag = useCallback((item: BoardItem, moving: LineEndpoint) => {
    const { start, end } = lineEndpointsWorld(item);
    const fixedWorld = moving === "end" ? start : end;
    dragRef.current = {
      itemId: item.id,
      moving,
      fixedWorld,
      height: item.height,
    };
    currentWorldRef.current = moving === "end" ? { ...end } : { ...start };
    setTick((t) => t + 1);
  }, []);

  const updateDrag = useCallback((worldX: number, worldY: number) => {
    if (!dragRef.current) return;
    currentWorldRef.current = { x: worldX, y: worldY };
    setTick((t) => t + 1);
  }, []);

  const endDrag = useCallback((): (Partial<BoardItem> & { id: string }) | null => {
    const d = dragRef.current;
    if (!d) return null;
    const { moving, fixedWorld, height } = d;
    const cur = currentWorldRef.current;
    const geom =
      moving === "end"
        ? lineItemFromPivotAndEndWorld(fixedWorld, cur, height)
        : lineItemFromPivotAndEndWorld(cur, fixedWorld, height);
    dragRef.current = null;
    setTick((t) => t + 1);
    return {
      id: d.itemId,
      x: geom.x,
      y: geom.y,
      width: geom.width,
      height: geom.height,
      rotation: geom.rotation,
    };
  }, []);

  const getOverride = useCallback(
    (itemId: string): Partial<BoardItem> | null => {
      const d = dragRef.current;
      if (!d || d.itemId !== itemId) return null;
      const { moving, fixedWorld, height } = d;
      const cur = currentWorldRef.current;
      const geom =
        moving === "end"
          ? lineItemFromPivotAndEndWorld(fixedWorld, cur, height)
          : lineItemFromPivotAndEndWorld(cur, fixedWorld, height);
      return {
        x: geom.x,
        y: geom.y,
        width: geom.width,
        height: geom.height,
        rotation: geom.rotation,
      };
    },
    [tick]
  );

  const isDragging = dragRef.current !== null;

  return {
    startDrag,
    updateDrag,
    endDrag,
    getOverride,
    isDragging,
    lineEndpointDragTick: tick,
  };
}
