import { BoardItem } from "@/lib/api/miroApi";

export type AnchorSide = "left" | "right" | "top" | "bottom";

export function itemSupportsConnectAnchors(type: BoardItem["type"]): boolean {
  return type !== "line" && type !== "freehand" && type !== "connector";
}

export interface ConnectionStyle {
  fromItemId: string;
  toItemId: string;
  fromAnchor: AnchorSide;
  toAnchor: AnchorSide;
}

const EPS = 1e-6;

export function anchorWorldPoint(item: BoardItem, side: AnchorSide): { x: number; y: number } {
  const { x, y, width: w, height: h } = item;
  switch (side) {
    case "left":
      return { x, y: y + h / 2 };
    case "right":
      return { x: x + w, y: y + h / 2 };
    case "top":
      return { x: x + w / 2, y };
    case "bottom":
      return { x: x + w / 2, y: y + h };
    default:
      return { x: x + w / 2, y: y + h / 2 };
  }
}

function anchorOutwardNormal(side: AnchorSide): { x: number; y: number } {
  switch (side) {
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "top":
      return { x: 0, y: -1 };
    case "bottom":
      return { x: 0, y: 1 };
  }
}

/**
 * Unit outward tangent ⊥ edge at anchor.
 * Points away from the item's interior so the connector curve doesn't "pull into"
 * the source/target boxes near the anchors.
 */
function outwardPerpendicularTangentAlongSide(side: AnchorSide): { x: number; y: number } {
  return anchorOutwardNormal(side);
}

function sampleCubicBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  steps: number
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const a = mt * mt * mt;
    const b = 3 * mt * mt * t;
    const c = 3 * mt * t * t;
    const d = t * t * t;
    out.push({
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    });
  }
  return out;
}

function sampleLine(p0: { x: number; y: number }, p1: { x: number; y: number }, steps: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push({
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
    });
  }
  return out;
}

export interface LinkedConnectorGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  svgPath: string;
}

/**
 * Compute axis-aligned bbox and local SVG path for a linked connector (world → local).
 */
export function computeLinkedConnectorGeometry(
  connector: BoardItem,
  itemsById: Map<string, BoardItem>
): LinkedConnectorGeometry | null {
  const conn = connector.style?.connection as ConnectionStyle | undefined;
  if (!conn) return null;

  const fromItem = itemsById.get(conn.fromItemId);
  const toItem = itemsById.get(conn.toItemId);
  if (!fromItem || !toItem) return null;

  const strokeWidth = typeof connector.style?.strokeWidth === "number" ? connector.style.strokeWidth : 4;
  // Keep visual stroke (and arrow tip region) from appearing inside attached items.
  const endpointClearance = strokeWidth / 2 + 1;
  const fromBase = anchorWorldPoint(fromItem, conn.fromAnchor);
  const toBase = anchorWorldPoint(toItem, conn.toAnchor);
  const fromNormal = anchorOutwardNormal(conn.fromAnchor);
  const toNormal = anchorOutwardNormal(conn.toAnchor);
  const S = {
    x: fromBase.x + fromNormal.x * endpointClearance,
    y: fromBase.y + fromNormal.y * endpointClearance,
  };
  const E = {
    x: toBase.x + toNormal.x * endpointClearance,
    y: toBase.y + toNormal.y * endpointClearance,
  };

  const dx = E.x - S.x;
  const dy = E.y - S.y;
  const len = Math.hypot(dx, dy) || 1;
  const t0 = outwardPerpendicularTangentAlongSide(conn.fromAnchor);
  const t1 = outwardPerpendicularTangentAlongSide(conn.toAnchor);
  const pad = strokeWidth / 2 + 14;

  // Keep the curve's centerline out of the endpoint boxes (avoid "passing through")
  // by shrinking bezier handles when needed.
  // Clearance for avoiding "inside box" intersection. We use a small value
  // to match the visual expectation: don't let the connector centerline go
  // through the boxes.
  const clearance = 0.25;

  const handleMax = Math.min(len * 0.4, 140);
  const handleScales = [1, 0.85, 0.7, 0.55, 0.4, 0.3, 0.2, 0.15, 0.1, 0.07, 0.05];

  const pointInsideRect = (p: { x: number; y: number }, r: BoardItem) => {
    return (
      p.x > r.x + clearance &&
      p.x < r.x + r.width - clearance &&
      p.y > r.y + clearance &&
      p.y < r.y + r.height - clearance
    );
  };

  let chosenC1: { x: number; y: number } | null = null;
  let chosenC2: { x: number; y: number } | null = null;
  let chosenPts: { x: number; y: number }[] | null = null;
  let bestIntersectionCount = Number.POSITIVE_INFINITY;

  const CHECK_STEPS = 80;
  const LINE_SAMPLE_STEPS = 12;

  // Ensure the path is perpendicular at both ends by adding short straight stubs
  // along the anchor outward normals, then curving between the stub endpoints.
  const stubLen = Math.min(40, Math.max(12, strokeWidth * 3 + 6, len * 0.12));
  const S2 = { x: S.x + t0.x * stubLen, y: S.y + t0.y * stubLen };
  // End stub should approach the item boundary; place E2 farther out so the final
  // straight segment runs toward the attached item.
  const E2 = { x: E.x + t1.x * stubLen, y: E.y + t1.y * stubLen };

  for (const scale of handleScales) {
    const handle = handleMax * scale;
    const C1 = { x: S2.x + t0.x * handle, y: S2.y + t0.y * handle };
    // Match the direction of the final approach segment (E2 -> E) which is along -t1.
    const C2 = { x: E2.x + t1.x * handle, y: E2.y + t1.y * handle };
    const curvePts = sampleCubicBezier(S2, C1, C2, E2, CHECK_STEPS);
    const pts = [
      ...sampleLine(S, S2, LINE_SAMPLE_STEPS),
      ...curvePts,
      ...sampleLine(E2, E, LINE_SAMPLE_STEPS),
    ];

    const intersectionCount = pts.reduce((count, p) => {
      return count + (pointInsideRect(p, fromItem) || pointInsideRect(p, toItem) ? 1 : 0);
    }, 0);
    const intersectsEndpointBoxes = intersectionCount > 0;
    if (!intersectsEndpointBoxes) {
      chosenC1 = C1;
      chosenC2 = C2;
      chosenPts = pts;
      bestIntersectionCount = 0;
      break;
    }

    // If all candidates intersect, keep the least intersecting one.
    if (intersectionCount < bestIntersectionCount) {
      chosenC1 = C1;
      chosenC2 = C2;
      chosenPts = pts;
      bestIntersectionCount = intersectionCount;
    }
  }

  const fallbackScale = handleScales[handleScales.length - 1];
  const C1 = chosenC1 || { x: S2.x + t0.x * handleMax * fallbackScale, y: S2.y + t0.y * handleMax * fallbackScale };
  const C2 = chosenC2 || { x: E2.x + t1.x * handleMax * fallbackScale, y: E2.y + t1.y * handleMax * fallbackScale };
  const pts =
    chosenPts ||
    [
      ...sampleLine(S, S2, LINE_SAMPLE_STEPS),
      ...sampleCubicBezier(S2, C1, C2, E2, CHECK_STEPS),
      ...sampleLine(E2, E, LINE_SAMPLE_STEPS),
    ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;

  const w = Math.max(maxX - minX, 8);
  const h = Math.max(maxY - minY, 8);

  const loc = (p: { x: number; y: number }) => ({ x: p.x - minX, y: p.y - minY });
  const s = loc(S);
  const s2 = loc(S2);
  const c1 = loc(C1);
  const c2 = loc(C2);
  const e2 = loc(E2);
  const e = loc(E);

  const svgPath = `M ${s.x} ${s.y} L ${s2.x} ${s2.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e2.x} ${e2.y} L ${e.x} ${e.y}`;

  return {
    x: minX,
    y: minY,
    width: w,
    height: h,
    svgPath,
  };
}

export type ApplyConnectorLayoutsOptions = {
  /**
   * When true, connectors whose endpoint item is soft-deleted keep their last stored
   * geometry instead of being soft-deleted (used by the eraser tool).
   * Default false keeps the previous behavior: orphan connectors are removed.
   */
  preserveOrphanConnectors?: boolean;
};

export function applyConnectorLayouts(
  items: BoardItem[],
  options?: ApplyConnectorLayoutsOptions
): BoardItem[] {
  const preserveOrphans = Boolean(options?.preserveOrphanConnectors);
  const active = items.filter((i) => !i.is_deleted);
  const byId = new Map(active.map((i) => [i.id, i]));

  let anyChanged = false;
  const next = items.map((item) => {
    if (item.type !== "connector" || item.is_deleted || !item.style?.connection) {
      return item;
    }

    const conn = item.style.connection as ConnectionStyle;
    const fromItem = byId.get(conn.fromItemId);
    const toItem = byId.get(conn.toItemId);
    if (!fromItem || !toItem) {
      if (preserveOrphans) {
        return item;
      }
      anyChanged = true;
      return { ...item, is_deleted: true };
    }

    const geom = computeLinkedConnectorGeometry(item, byId);
    if (!geom) {
      anyChanged = true;
      return { ...item, is_deleted: true };
    }

    const { x, y, width, height, svgPath } = geom;
    const same =
      Math.abs(item.x - x) < EPS &&
      Math.abs(item.y - y) < EPS &&
      Math.abs(item.width - width) < EPS &&
      Math.abs(item.height - height) < EPS &&
      item.style?.svgPath === svgPath &&
      (item.rotation ?? 0) === 0;

    if (same) return item;

    anyChanged = true;
    return {
      ...item,
      x,
      y,
      width,
      height,
      rotation: 0,
      style: {
        ...item.style,
        svgPath,
      },
    };
  });

  return anyChanged ? next : items;
}
