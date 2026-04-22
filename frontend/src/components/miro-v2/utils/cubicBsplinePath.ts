/**
 * Clamped uniform cubic B-spline path for freehand strokes.
 * Interpolates (approximately through chord-length parameters) sample points,
 * then emits a smooth SVG cubic Bézier chain.
 * p is degree of the spline, u is the parameter value in the range [0, 1], m is the number of control points
 */

export type Vec2 = { x: number; y: number };

const DEGREE = 3;
/** Avoid huge linear solves on mousemove */
const MAX_INTERP_POINTS = 220;

/** Build clamped uniform knots for cubic B-spline according to m = numCtrl - DEGREE - 1*/
export function buildClampedUniformKnots(numCtrl: number): number[] {
  if (numCtrl < DEGREE + 1) {
    throw new Error("Need at least 4 control points for cubic B-spline");
  }
  const end = numCtrl - DEGREE;
  const knots: number[] = [];
  for (let i = 0; i <= DEGREE; i++) knots.push(0);
  for (let j = 1; j < end; j++) knots.push(j);
  for (let i = 0; i <= DEGREE; i++) knots.push(end);
  return knots;
}

/** Find knot span index k with knots[k] <= u < knots[k+1] (clamped end). */
export function findSpan(u: number, knots: number[], p: number): number {
  const n = knots.length - p - 2;
  if (u >= knots[n + 1]) return n;
  if (u <= knots[p]) return p;
  let low = p;
  let high = n + 1;
  let mid = Math.floor((low + high) / 2);
  while (u < knots[mid] || u >= knots[mid + 1]) {
    if (u < knots[mid]) high = mid;
    else low = mid;
    mid = Math.floor((low + high) / 2);
  }
  return mid;
}

/** Cox–de Boor: basis function N_{i,p}(u) recursively defined*/
export function basisFunction(
  i: number,
  p: number,
  u: number,
  knots: number[]
): number {
  if (p === 0) {
    return u >= knots[i] && u < knots[i + 1] ? 1 : 0;
  }
  let left = 0;
  const d1 = knots[i + p] - knots[i];
  if (d1 > 1e-20) left = ((u - knots[i]) / d1) * basisFunction(i, p - 1, u, knots);
  let right = 0;
  const d2 = knots[i + p + 1] - knots[i + 1];
  if (d2 > 1e-20) {
    right = ((knots[i + p + 1] - u) / d2) * basisFunction(i + 1, p - 1, u, knots);
  }
  return left + right;
}

/** Evaluate C(u) = sum_i P_i * N_i^p(u) */
export function evaluateBspline(u: number, controls: Vec2[], knots: number[]): Vec2 {
  const p = DEGREE;
  const span = findSpan(u, knots, p);
  let x = 0;
  let y = 0;
  for (let i = span - p; i <= span; i++) {
    const n = basisFunction(i, p, u, knots);
    x += controls[i].x * n;
    y += controls[i].y * n;
  }
  return { x, y };
}

/** Compute chord-length parameters u_i for cubic B-spline interpolation. */
function chordLengthParams(points: Vec2[], uMax: number): number[] {
  const n = points.length;
  const d: number[] = [0];
  let total = 0;
  for (let i = 1; i < n; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.hypot(dx, dy);
    d.push(total);
  }
  if (total < 1e-12) {
    return points.map((_, i) => (n === 1 ? 0 : (uMax * i) / (n - 1)));
  }
  return d.map((s) => (s / total) * uMax);
}

/** Uniform subsample along polyline to at most maxPts (keeps first & last). */
export function downsamplePolyline(points: Vec2[], maxPts: number): Vec2[] {
  if (points.length <= maxPts) return points;
  const out: Vec2[] = [];
  const step = (points.length - 1) / (maxPts - 1);
  for (let k = 0; k < maxPts; k++) {
    const t = k * step;
    const i = Math.floor(t);
    const f = t - i;
    const a = points[Math.min(i, points.length - 1)];
    const b = points[Math.min(i + 1, points.length - 1)];
    out.push({
      x: a.x + f * (b.x - a.x),
      y: a.y + f * (b.y - a.y),
    });
  }
  return out;
}

/** Solve the linear system of equations A * x = b */
function solveLinearSystem(A: number[][], bx: number[], by: number[]): Vec2[] {
  const n = bx.length;
  // Augment [A | bx | by], Gaussian elimination
  const M: number[][] = [];
  for (let i = 0; i < n; i++) {
    M[i] = [...A[i], bx[i], by[i]];
  }
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-14) {
      return [];
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const div = M[col][col];
    for (let c = col; c < n + 2; c++) M[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (Math.abs(f) < 1e-18) continue;
      for (let c = col; c < n + 2; c++) M[r][c] -= f * M[col][c];
    }
  }
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: M[i][n], y: M[i][n + 1] });
  }
  return out;
}

/** Build interpolation matrix N_j(u_i) for cubic B-spline. */
function buildCollocationMatrix(uParams: number[], knots: number[]): number[][] {
  const n = uParams.length;
  const A: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = new Array(n).fill(0);
    const u = Math.min(
      Math.max(uParams[i], knots[DEGREE] + 1e-10),
      knots[knots.length - DEGREE - 1] - 1e-10
    );
    const span = findSpan(u, knots, DEGREE);
    // Compute the basis function values for the span
    // Please see the B-spline Basis Functions: Definition section in reference for more details
    // on why there is only p+1 basis functions are non-zero 
    // It's a property of the B-spline basis functions that can be shown by the 
    // recursive definition of the basis functions and the graph of the basis functions hierarchy.
    for (let j = span - DEGREE; j <= span; j++) {
      if (j >= 0 && j < n) {
        row[j] = basisFunction(j, DEGREE, u, knots);
      }
    }
    A.push(row);
  }
  return A;
}

/**
 * Compute de Boor control points so the cubic B-spline passes near sample points
 * (chord-length parameters in the spline domain).
 */
export function interpolateControlsThroughPoints(points: Vec2[]): Vec2[] | null {
  const n = points.length;
  if (n < 4) return null;
  const knots = buildClampedUniformKnots(n);
  const uMax = knots[knots.length - DEGREE - 1];
  const uParams = chordLengthParams(points, uMax);
  const A = buildCollocationMatrix(uParams, knots);
  const bx = points.map((p) => p.x);
  const by = points.map((p) => p.y);
  const controls = solveLinearSystem(A, bx, by);
  return controls.length === n ? controls : null;
}

/** One uniform cubic B-spline span control points → cubic Bézier control points. 
 * They should produce the same curve
*/
// Compute both the cubic Bézier and the B-spline basis function and its derivative at endpoints
// We can achieve the relationship(coefficients) between the two sets of four control points in each span
export function spanToBezierUniform(d0: Vec2, d1: Vec2, d2: Vec2, d3: Vec2): [Vec2, Vec2, Vec2, Vec2] {
  return [
    {
      x: (d0.x + 4 * d1.x + d2.x) / 6,
      y: (d0.y + 4 * d1.y + d2.y) / 6,
    },
    { x: (2 * d1.x + d2.x) / 3, y: (2 * d1.y + d2.y) / 3 },
    { x: (d1.x + 2 * d2.x) / 3, y: (d1.y + 2 * d2.y) / 3 },
    {
      x: (d1.x + 4 * d2.x + d3.x) / 6,
      y: (d1.y + 4 * d2.y + d3.y) / 6,
    },
  ];
}

function fmt(n: number): string {
  const s = n.toFixed(3);
  return s.replace(/\.?0+$/, "") || "0";
}

function vecFmt(v: Vec2): string {
  return `${fmt(v.x)} ${fmt(v.y)}`;
}

/**
 * Cubic B-spline control polygon → SVG d="M ... C ..." (same coord space as controls).
 */
export function bsplineControlsToSvgPathCubic(controls: Vec2[], knots: number[]): string {
  const nCtrl = controls.length;
  const numSpans = nCtrl - DEGREE;
  if (numSpans < 1) return "";

  let d = "";
  for (let s = 0; s < numSpans; s++) {
    const d0 = controls[s];
    const d1 = controls[s + 1];
    const d2 = controls[s + 2];
    const d3 = controls[s + 3];
    const [b0, b1, b2, b3] = spanToBezierUniform(d0, d1, d2, d3);
    if (s === 0) {
      d += `M ${vecFmt(b0)} C ${vecFmt(b1)} ${vecFmt(b2)} ${vecFmt(b3)}`;
    } else {
      d += ` C ${vecFmt(b1)} ${vecFmt(b2)} ${vecFmt(b3)}`;
    }
  }
  return d;
}

/** Fallback polyline path */
export function polylineToSvgPath(points: Vec2[]): string {
  if (points.length === 0) return "";
  let d = `M ${vecFmt(points[0])}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${vecFmt(points[i])}`;
  }
  return d;
}

export interface Bbox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function expandBbox(b: Bbox2D, x: number, y: number): void {
  b.minX = Math.min(b.minX, x);
  b.minY = Math.min(b.minY, y);
  b.maxX = Math.max(b.maxX, x);
  b.maxY = Math.max(b.maxY, y);
}

/** Axis-aligned bounds of cubic Bézier (control hull + few samples). */
// It used for computing the bounding box of the cubic Bézier curve
// know a reasonable world-space rectangle that contains the drawn freehand stroke 
// (including a bit of slack for stroke width), for things like layout, culling, 
// hit targets, or view fitting—without assuming the curve is just the polyline through the original points
function bezierBounds(
  b0: Vec2,
  b1: Vec2,
  b2: Vec2,
  b3: Vec2,
  pad: number
): Bbox2D {
  const b: Bbox2D = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  const samples = 12;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    const x =
      mt * mt * mt * b0.x +
      3 * mt * mt * t * b1.x +
      3 * mt * t * t * b2.x +
      t * t * t * b3.x;
    const y =
      mt * mt * mt * b0.y +
      3 * mt * mt * t * b1.y +
      3 * mt * t * t * b2.y +
      t * t * t * b3.y;
    expandBbox(b, x, y);
  }
  b.minX -= pad;
  b.minY -= pad;
  b.maxX += pad;
  b.maxY += pad;
  return b;
}

/** Computes one overall bounding box for the full B-spline by combining the bounding boxes of all its Bézier spans. */
export function unionBezierSpansBbox(controls: Vec2[], strokePadWorld: number): Bbox2D | null {
  const nCtrl = controls.length;
  const numSpans = nCtrl - DEGREE;
  if (numSpans < 1) return null;
  let acc: Bbox2D | null = null;
  for (let s = 0; s < numSpans; s++) {
    const [b0, b1, b2, b3] = spanToBezierUniform(
      controls[s],
      controls[s + 1],
      controls[s + 2],
      controls[s + 3]
    );
    const box = bezierBounds(b0, b1, b2, b3, strokePadWorld);
    if (!acc) acc = { ...box };
    else {
      acc.minX = Math.min(acc.minX, box.minX);
      acc.minY = Math.min(acc.minY, box.minY);
      acc.maxX = Math.max(acc.maxX, box.maxX);
      acc.maxY = Math.max(acc.maxY, box.maxY);
    }
  }
  return acc;
}

export function pointsPolylineBbox(points: Vec2[], pad: number): Bbox2D {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: pad * 2, maxY: pad * 2 };
  }
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

/**
 * World-space points → SVG path string in world space, plus bbox (padded for stroke).
 */
export function freehandPointsToWorldPath(
  worldPoints: Vec2[],
  strokeHalfWidthWorld: number
): { pathWorld: string; bbox: Bbox2D } {
  const pad = strokeHalfWidthWorld;
  if (worldPoints.length === 0) {
    return { pathWorld: "", bbox: { minX: 0, minY: 0, maxX: 1, maxY: 1 } };
  }
  if (worldPoints.length === 1) {
    const p = worldPoints[0];
    const d = `M ${fmt(p.x)} ${fmt(p.y)} L ${fmt(p.x + 0.01)} ${fmt(p.y)}`;
    return {
      pathWorld: d,
      bbox: {
        minX: p.x - pad,
        minY: p.y - pad,
        maxX: p.x + pad,
        maxY: p.y + pad,
      },
    };
  }
  if (worldPoints.length === 2) {
    const d = polylineToSvgPath(worldPoints);
    return { pathWorld: d, bbox: pointsPolylineBbox(worldPoints, pad) };
  }
  if (worldPoints.length === 3) {
    const d = polylineToSvgPath(worldPoints);
    return { pathWorld: d, bbox: pointsPolylineBbox(worldPoints, pad) };
  }

  const toFit = downsamplePolyline(worldPoints, MAX_INTERP_POINTS);
  const controls = interpolateControlsThroughPoints(toFit);
  if (!controls) {
    const d = polylineToSvgPath(worldPoints);
    return { pathWorld: d, bbox: pointsPolylineBbox(worldPoints, pad) };
  }
  const knots = buildClampedUniformKnots(controls.length);
  const pathWorld = bsplineControlsToSvgPathCubic(controls, knots);
  const box = unionBezierSpansBbox(controls, pad);
  if (!box) {
    return { pathWorld: polylineToSvgPath(worldPoints), bbox: pointsPolylineBbox(worldPoints, pad) };
  }
  return { pathWorld, bbox: box };
}

/**
 * Transform path d string: apply mapPoint to every coordinate (affine-safe for Bézier CPs).
 */
export function transformSvgPathD(
  d: string,
  mapPoint: (x: number, y: number) => { x: number; y: number }
): string {
  if (!d.trim()) return d;
  const tokens = d.match(/[MLCZz]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || [];
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (cmd === "M" || cmd === "L") {
      const x = parseFloat(tokens[i + 1]);
      const y = parseFloat(tokens[i + 2]);
      const p = mapPoint(x, y);
      out.push(cmd, fmt(p.x), fmt(p.y));
      i += 3;
    } else if (cmd === "C") {  
      const p1 = mapPoint(parseFloat(tokens[i + 1]), parseFloat(tokens[i + 2]));
      const p2 = mapPoint(parseFloat(tokens[i + 3]), parseFloat(tokens[i + 4]));
      const p3 = mapPoint(parseFloat(tokens[i + 5]), parseFloat(tokens[i + 6]));
      out.push("C", fmt(p1.x), fmt(p1.y), fmt(p2.x), fmt(p2.y), fmt(p3.x), fmt(p3.y));
      i += 7;
    } else if (cmd === "Z" || cmd === "z") {
      out.push(cmd);
      i += 1;
    } else {
      i += 1;
    }
  }
  return out.join(" ");
}

/**
 * Shift path from world to local (subtract origin).
 */
export function worldPathToLocalPath(pathWorld: string, originX: number, originY: number): string {
  return transformSvgPathD(pathWorld, (x , y) => ({
    x: x - originX,
    y: y - originY,
  }));
}

/** World samples → SVG path d in screen space (for draft overlay). */
export function worldPointsToScreenPath(
  worldPoints: Vec2[],
  strokeHalfWidthWorld: number,
  worldToScreen: (x: number, y: number) => { x: number; y: number }
): string {
  const { pathWorld } = freehandPointsToWorldPath(worldPoints, strokeHalfWidthWorld);
  return transformSvgPathD(pathWorld, (x, y) => worldToScreen(x, y));
}
