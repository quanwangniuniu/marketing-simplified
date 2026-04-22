import { BoardItem } from "@/lib/api/miroApi";

const MIN_LINE_LENGTH = 20;

/** World-space endpoints with transform-origin at left center (0, height/2). */
export function lineEndpointsWorld(item: BoardItem): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const h = item.height;
  const w = item.width;
  const rad = ((item.rotation ?? 0) * Math.PI) / 180;
  const px = item.x;
  const py = item.y + h / 2;
  return {
    start: { x: px, y: py },
    end: { x: px + w * Math.cos(rad), y: py + w * Math.sin(rad) },
  };
}

export function lineItemFromPivotAndEndWorld(
  pivotWorld: { x: number; y: number },
  endWorld: { x: number; y: number },
  height: number
): { x: number; y: number; width: number; height: number; rotation: number } {
  const dx = endWorld.x - pivotWorld.x;
  const dy = endWorld.y - pivotWorld.y;
  const width = Math.max(MIN_LINE_LENGTH, Math.hypot(dx, dy));
  const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  return {
    x: pivotWorld.x,
    y: pivotWorld.y - height / 2,
    width,
    height,
    rotation,
  };
}

export function usesLinePivotTransform(item: BoardItem): boolean {
  if (item.type === "line") return true;
  if (item.type === "connector" && !item.style?.connection) return true;
  return false;
}
