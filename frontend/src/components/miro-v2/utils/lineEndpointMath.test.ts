import { lineEndpointsWorld, lineItemFromPivotAndEndWorld } from "./lineEndpointMath";
import { BoardItem } from "@/lib/api/miroApi";

function lineItem(partial: Partial<BoardItem> & Pick<BoardItem, "x" | "y" | "width" | "height">): BoardItem {
  return {
    id: "1",
    board_id: "b",
    type: "line",
    x: partial.x,
    y: partial.y,
    width: partial.width,
    height: partial.height,
    rotation: partial.rotation ?? 0,
    style: {},
    content: "",
    z_index: 0,
    is_deleted: false,
    created_at: "",
    updated_at: "",
  };
}

describe("lineEndpointsWorld", () => {
  test("horizontal line to the right from origin", () => {
    const { start, end } = lineEndpointsWorld(lineItem({ x: 0, y: 0, width: 100, height: 20, rotation: 0 }));
    expect(start).toEqual({ x: 0, y: 10 });
    expect(end.x).toBeCloseTo(100);
    expect(end.y).toBeCloseTo(10);
  });

  test("90 degree rotation", () => {
    const { start, end } = lineEndpointsWorld(
      lineItem({ x: 0, y: 0, width: 100, height: 20, rotation: 90 })
    );
    expect(start).toEqual({ x: 0, y: 10 });
    expect(end.x).toBeCloseTo(0);
    expect(end.y).toBeCloseTo(110);
  });
});

describe("lineItemFromPivotAndEndWorld", () => {
  test("reconstructs horizontal segment", () => {
    const g = lineItemFromPivotAndEndWorld({ x: 0, y: 10 }, { x: 50, y: 10 }, 20);
    expect(g.x).toBe(0);
    expect(g.y).toBe(0);
    expect(g.width).toBe(50);
    expect(g.height).toBe(20);
    expect(g.rotation).toBeCloseTo(0);
  });

  test("enforces minimum length", () => {
    const g = lineItemFromPivotAndEndWorld({ x: 0, y: 10 }, { x: 0, y: 10 }, 20);
    expect(g.width).toBeGreaterThanOrEqual(20);
  });
});
