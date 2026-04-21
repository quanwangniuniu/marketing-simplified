import { BoardItem } from "@/lib/api/miroApi";

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getSelectionBounds(items: BoardItem[], selectedItemIds: string[]): Rect | null {
  if (selectedItemIds.length === 0) return null;
  const selected = items.filter((item) => selectedItemIds.includes(item.id) && !item.is_deleted);
  if (selected.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  selected.forEach((item) => {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
