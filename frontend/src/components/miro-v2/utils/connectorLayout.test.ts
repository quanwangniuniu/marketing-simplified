import { anchorWorldPoint, applyConnectorLayouts, computeLinkedConnectorGeometry } from "./connectorLayout";
import { BoardItem } from "@/lib/api/miroApi";

function item(partial: Partial<BoardItem> & Pick<BoardItem, "id" | "type" | "x" | "y" | "width" | "height">): BoardItem {
  return {
    board_id: "b",
    style: {},
    content: "",
    z_index: 0,
    is_deleted: false,
    created_at: "",
    updated_at: "",
    ...partial,
  } as BoardItem;
}

function parseLinkedPath(path: string) {
  const m = path.match(
    /^M\s+([\d.-]+)\s+([\d.-]+)\s+L\s+([\d.-]+)\s+([\d.-]+)\s+C\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+L\s+([\d.-]+)\s+([\d.-]+)$/
  );
  expect(m).not.toBeNull();
  return {
    s: { x: Number(m![1]), y: Number(m![2]) },
    s2: { x: Number(m![3]), y: Number(m![4]) },
    c1: { x: Number(m![5]), y: Number(m![6]) },
    c2: { x: Number(m![7]), y: Number(m![8]) },
    e2: { x: Number(m![9]), y: Number(m![10]) },
    e: { x: Number(m![11]), y: Number(m![12]) },
  };
}

describe("anchorWorldPoint", () => {
  test("midpoints on edges", () => {
    const b = item({ id: "a", type: "shape", x: 10, y: 20, width: 100, height: 40 });
    expect(anchorWorldPoint(b, "left")).toEqual({ x: 10, y: 40 });
    expect(anchorWorldPoint(b, "right")).toEqual({ x: 110, y: 40 });
    expect(anchorWorldPoint(b, "top")).toEqual({ x: 60, y: 20 });
    expect(anchorWorldPoint(b, "bottom")).toEqual({ x: 60, y: 60 });
  });
});

describe("computeLinkedConnectorGeometry", () => {
  test("returns bbox and path for two items", () => {
    const a = item({ id: "a", type: "shape", x: 0, y: 0, width: 50, height: 50 });
    const b = item({ id: "b", type: "shape", x: 200, y: 0, width: 50, height: 50 });
    const c = item({
      id: "c",
      type: "connector",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      style: {
        connection: {
          fromItemId: "a",
          toItemId: "b",
          fromAnchor: "right",
          toAnchor: "left",
        },
      },
    });
    const map = new Map<string, BoardItem>([
      ["a", a],
      ["b", b],
    ]);
    const g = computeLinkedConnectorGeometry(c, map);
    expect(g).not.toBeNull();
    expect(g!.svgPath).toMatch(/^M /);
    expect(g!.width).toBeGreaterThan(0);
    expect(g!.height).toBeGreaterThan(0);
  });

  test("control handles align with edge normals (perpendicular approach at anchors)", () => {
    const a = item({ id: "a", type: "shape", x: 0, y: 0, width: 50, height: 50 });
    const b = item({ id: "b", type: "shape", x: 200, y: 0, width: 50, height: 50 });
    const c = item({
      id: "c",
      type: "connector",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      style: {
        connection: {
          fromItemId: "a",
          toItemId: "b",
          fromAnchor: "right",
          toAnchor: "left",
        },
      },
    });
    const map = new Map<string, BoardItem>([
      ["a", a],
      ["b", b],
    ]);
    const g = computeLinkedConnectorGeometry(c, map)!;
    const p = parseLinkedPath(g.svgPath);
    // Stub segments enforce perpendicular entry/exit at both ends.
    expect(p.s2.y).toBeCloseTo(p.s.y, 5);
    expect(p.e.y).toBeCloseTo(p.e2.y, 5);
    // And the cubic itself leaves/arrives horizontally for left/right anchors.
    // B'(0) ∥ (c1 - s2), B'(1) ∥ (e2 - c2)
    expect(p.c1.y).toBeCloseTo(p.s2.y, 5);
    expect(p.e2.y).toBeCloseTo(p.c2.y, 5);
  });

  test("connector curve does not enter endpoint item boxes", () => {
    const fromItem = item({ id: "a", type: "shape", x: 0, y: 0, width: 50, height: 50 });
    const toItem = item({ id: "b", type: "shape", x: 200, y: 0, width: 50, height: 50 });

    // Connect from `fromItem.right` to `toItem.left`.
    // Historically the tangent selection could pull the bezier handle into `toItem`.
    const connector = item({
      id: "c",
      type: "connector",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      style: {
        strokeWidth: 4,
        connection: {
          fromItemId: "a",
          toItemId: "b",
          fromAnchor: "right",
          toAnchor: "left",
        },
      },
    });

    const map = new Map<string, BoardItem>([
      ["a", fromItem],
      ["b", toItem],
    ]);
    const g = computeLinkedConnectorGeometry(connector, map);
    expect(g).not.toBeNull();

    const isStrictlyInside = (p: { x: number; y: number }, r: BoardItem, margin: number) => {
      return (
        p.x > r.x + margin &&
        p.x < r.x + r.width - margin &&
        p.y > r.y + margin &&
        p.y < r.y + r.height - margin
      );
    };

    const p = parseLinkedPath(g!.svgPath);
    const toWorld = (pt: { x: number; y: number }) => ({ x: pt.x + g!.x, y: pt.y + g!.y });
    const S2 = toWorld(p.s2);
    const C1 = toWorld(p.c1);
    const C2 = toWorld(p.c2);
    const E2 = toWorld(p.e2);

    const cubicAt = (t: number) => {
      const mt = 1 - t;
      const a = mt * mt * mt;
      const b = 3 * mt * mt * t;
      const c = 3 * mt * t * t;
      const d = t * t * t;
      return {
        x: a * S2.x + b * C1.x + c * C2.x + d * E2.x,
        y: a * S2.y + b * C1.y + c * C2.y + d * E2.y,
      };
    };

    // Use a small margin to avoid "failing" on boundary points caused by floating error.
    const margin = 0.25;
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      const p = cubicAt(t);
      expect(isStrictlyInside(p, fromItem, margin)).toBe(false);
      expect(isStrictlyInside(p, toItem, margin)).toBe(false);
    }
  });

  test("bottom-anchor target does not curl into target box", () => {
    const fromItem = item({ id: "a", type: "sticky_note", x: 40, y: 140, width: 120, height: 120 });
    const toItem = item({ id: "b", type: "shape", x: 360, y: 120, width: 90, height: 90 });

    const connector = item({
      id: "c",
      type: "connector",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      style: {
        strokeWidth: 4,
        connection: {
          fromItemId: "a",
          toItemId: "b",
          fromAnchor: "right",
          toAnchor: "bottom",
        },
      },
    });

    const map = new Map<string, BoardItem>([
      ["a", fromItem],
      ["b", toItem],
    ]);
    const g = computeLinkedConnectorGeometry(connector, map);
    expect(g).not.toBeNull();
    const p = parseLinkedPath(g!.svgPath);
    const toWorld = (pt: { x: number; y: number }) => ({ x: pt.x + g!.x, y: pt.y + g!.y });
    const p0 = toWorld(p.s2);
    const p1 = toWorld(p.c1);
    const p2 = toWorld(p.c2);
    const p3 = toWorld(p.e2);

    const cubicAt = (t: number) => {
      const mt = 1 - t;
      const a = mt * mt * mt;
      const b = 3 * mt * mt * t;
      const c = 3 * mt * t * t;
      const d = t * t * t;
      return {
        x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
        y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
      };
    };

    const isInside = (p: { x: number; y: number }, r: BoardItem, margin: number) => {
      return p.x > r.x + margin && p.x < r.x + r.width - margin && p.y > r.y + margin && p.y < r.y + r.height - margin;
    };

    for (let i = 0; i <= 80; i++) {
      const p = cubicAt(i / 80);
      expect(isInside(p, fromItem, 0.25)).toBe(false);
      expect(isInside(p, toItem, 0.25)).toBe(false);
    }
  });
});

describe("applyConnectorLayouts", () => {
  test("soft-deletes connector when endpoint missing (default)", () => {
    const c = item({
      id: "c",
      type: "connector",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      style: {
        connection: {
          fromItemId: "missing",
          toItemId: "b",
          fromAnchor: "right",
          toAnchor: "left",
        },
      },
    });
    const b = item({ id: "b", type: "shape", x: 100, y: 0, width: 40, height: 40 });
    const next = applyConnectorLayouts([c, b]);
    const updated = next.find((i) => i.id === "c");
    expect(updated?.is_deleted).toBe(true);
  });

  test("preserves connector when endpoint missing if preserveOrphanConnectors", () => {
    const c = item({
      id: "c",
      type: "connector",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      style: {
        connection: {
          fromItemId: "missing",
          toItemId: "b",
          fromAnchor: "right",
          toAnchor: "left",
        },
      },
    });
    const b = item({ id: "b", type: "shape", x: 100, y: 0, width: 40, height: 40 });
    const next = applyConnectorLayouts([c, b], { preserveOrphanConnectors: true });
    const updated = next.find((i) => i.id === "c");
    expect(updated?.is_deleted).toBeFalsy();
    expect(updated?.x).toBe(0);
    expect(updated?.width).toBe(10);
  });
});
