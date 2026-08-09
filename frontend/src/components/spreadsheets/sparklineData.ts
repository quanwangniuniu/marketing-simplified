/**
 * Frontend helpers for in-cell sparklines (MED-295).
 *
 * A sparkline cell is a `=SPARKLINE(range)` formula whose backend-resolved
 * series is stored (as JSON) in the cell's `computed_string`. These helpers
 * detect such a cell and parse its payload for rendering with Recharts.
 */

export interface SparklinePayload {
  type: string;
  color: string | null;
  series: (number | null)[];
}

const SPARKLINE_RE = /^\s*=SPARKLINE\(/i;

/** True when a cell's raw input is a SPARKLINE formula. */
export function isSparklineRawInput(rawInput: string | null | undefined): boolean {
  return !!rawInput && SPARKLINE_RE.test(rawInput);
}

/**
 * Parse the backend-resolved sparkline payload from a cell's computed_string.
 * Returns null when it is absent or not a sparkline payload.
 */
export function parseSparklinePayload(
  computedString: string | null | undefined,
): SparklinePayload | null {
  if (!computedString) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(computedString);
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as { kind?: unknown }).kind !== 'sparkline' ||
    !Array.isArray((parsed as { series?: unknown }).series)
  ) {
    return null;
  }
  const obj = parsed as { type?: unknown; color?: unknown; series: unknown[] };
  return {
    type: typeof obj.type === 'string' ? obj.type : 'line',
    color: typeof obj.color === 'string' ? obj.color : null,
    series: obj.series.map((v) => (typeof v === 'number' ? v : null)),
  };
}
