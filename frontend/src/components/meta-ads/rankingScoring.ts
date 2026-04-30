/**
 * Composite-score logic shared by the meta-ads ranking surfaces (per-ad and
 * per-creative leaderboards).
 *
 * Pure module — no React, no DOM, no fetch. Easy to unit-test.
 *
 * Each metric is min-max normalized across the currently visible rows to [0, 1].
 * For "lower is better" metrics (cpa, cost_per_lpv, cost_per_comment) the
 * normalized value is then transformed to (1 - normalized) so a higher score
 * always means "better". Final score = Σ (weight × transformed_normalized).
 *
 * When all rows have the same value for a metric (range = 0), that metric
 * contributes 0 to every row's score (avoids divide-by-zero).
 *
 * Weights summing to a value other than 1.0 are tolerated; the function
 * returns whatever sum the given weights produce. UI is responsible for
 * surfacing drift if it matters.
 */

/**
 * Structural row shape that the composite-score logic needs.
 * Both the per-ad and per-creative leaderboard rows satisfy this contract —
 * they share the seven metric strings plus an integer `id`.
 */
export interface MetricBearingRow {
  id: number;
  roas: string;
  cpa: string;
  hook_rate_strict: string;
  hold_rate: string;
  ctr: string;
  cost_per_lpv: string;
  cost_per_comment: string;
}

export type RankingMetric =
  | "roas"
  | "cpa"
  | "hook_rate_strict"
  | "hold_rate"
  | "ctr"
  | "cost_per_lpv"
  | "cost_per_comment";

export const RANKING_METRICS: readonly RankingMetric[] = [
  "roas",
  "cpa",
  "hook_rate_strict",
  "hold_rate",
  "ctr",
  "cost_per_lpv",
  "cost_per_comment",
] as const;

export const INVERTED_METRICS: ReadonlySet<RankingMetric> = new Set([
  "cpa",
  "cost_per_lpv",
  "cost_per_comment",
]);

export const METRIC_LABEL: Record<RankingMetric, string> = {
  roas: "ROAS",
  cpa: "CPA",
  hook_rate_strict: "Hook rate (strict)",
  hold_rate: "Hold rate",
  ctr: "CTR",
  cost_per_lpv: "Cost per LPV",
  cost_per_comment: "Cost per comment",
};

export type WeightSet = Record<RankingMetric, number>;

export type PresetName = "performance" | "engagement" | "cost_efficient";

export const PRESETS: Record<PresetName, WeightSet> = {
  performance: {
    roas: 0.5,
    cpa: 0.3,
    hook_rate_strict: 0.1,
    hold_rate: 0.05,
    ctr: 0.05,
    cost_per_lpv: 0,
    cost_per_comment: 0,
  },
  engagement: {
    roas: 0.1,
    cpa: 0.1,
    hook_rate_strict: 0.25,
    hold_rate: 0.25,
    ctr: 0.2,
    cost_per_lpv: 0.05,
    cost_per_comment: 0.05,
  },
  cost_efficient: {
    roas: 0.2,
    cpa: 0.4,
    hook_rate_strict: 0,
    hold_rate: 0,
    ctr: 0.05,
    cost_per_lpv: 0.25,
    cost_per_comment: 0.1,
  },
};

export const PRESET_LABEL: Record<PresetName, string> = {
  performance: "Performance",
  engagement: "Engagement",
  cost_efficient: "Cost-efficient",
};

export function applyPreset(name: PresetName): WeightSet {
  return { ...PRESETS[name] };
}

const PRESET_EQ_TOLERANCE = 0.001;

export function detectActivePreset(
  weights: WeightSet
): PresetName | "custom" {
  for (const name of Object.keys(PRESETS) as PresetName[]) {
    const preset = PRESETS[name];
    let match = true;
    for (const m of RANKING_METRICS) {
      if (Math.abs((weights[m] ?? 0) - preset[m]) > PRESET_EQ_TOLERANCE) {
        match = false;
        break;
      }
    }
    if (match) return name;
  }
  return "custom";
}

export function sumWeights(weights: WeightSet): number {
  let total = 0;
  for (const m of RANKING_METRICS) total += weights[m] ?? 0;
  return total;
}

function readMetric<T extends MetricBearingRow>(row: T, metric: RankingMetric): number {
  switch (metric) {
    case "roas":
      return Number(row.roas);
    case "cpa":
      return Number(row.cpa);
    case "hook_rate_strict":
      return Number(row.hook_rate_strict);
    case "hold_rate":
      return Number(row.hold_rate);
    case "ctr":
      return Number(row.ctr);
    case "cost_per_lpv":
      return Number(row.cost_per_lpv);
    case "cost_per_comment":
      return Number(row.cost_per_comment);
  }
}

interface MetricRange {
  min: number;
  max: number;
  range: number;
}

function computeRanges<T extends MetricBearingRow>(
  rows: T[]
): Record<RankingMetric, MetricRange> {
  const ranges = {} as Record<RankingMetric, MetricRange>;
  for (const m of RANKING_METRICS) {
    let min = Infinity;
    let max = -Infinity;
    for (const r of rows) {
      const v = readMetric(r, m);
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      ranges[m] = { min: 0, max: 0, range: 0 };
    } else {
      ranges[m] = { min, max, range: max - min };
    }
  }
  return ranges;
}

export function computeCompositeScores<T extends MetricBearingRow>(
  rows: T[],
  weights: WeightSet
): Map<number, number> {
  const ranges = computeRanges(rows);
  const scores = new Map<number, number>();
  for (const r of rows) {
    let s = 0;
    for (const m of RANKING_METRICS) {
      const w = weights[m] ?? 0;
      if (w === 0) continue;
      const raw = readMetric(r, m);
      if (!Number.isFinite(raw)) continue;
      const { min, range } = ranges[m];
      const norm = range === 0 ? 0 : (raw - min) / range;
      const transformed = INVERTED_METRICS.has(m) ? 1 - norm : norm;
      s += w * transformed;
    }
    scores.set(r.id, s);
  }
  return scores;
}

/**
 * Per-row [0, 1] normalized value for one metric across the given row set.
 *
 * Used by the radar chart to map raw metric values onto each radial axis.
 * When all rows share the same value (range = 0) every row gets 0 — no
 * spike in any direction. When a row's raw value is non-finite (e.g. a
 * derived ratio that came back as "NaN") the row gets 0 for that metric.
 *
 * For "lower is better" metrics, pass `invert = true` so cheap CPA / cost
 * per LPV / cost per comment yields a higher normalized score than the
 * expensive end of the range.
 */
export function computeMinMaxNormalized<T extends MetricBearingRow>(
  rows: T[],
  metric: RankingMetric,
  invert: boolean
): Map<number, number> {
  const out = new Map<number, number>();
  let min = Infinity;
  let max = -Infinity;
  for (const r of rows) {
    const v = readMetric(r, metric);
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range =
    Number.isFinite(min) && Number.isFinite(max) ? max - min : 0;
  for (const r of rows) {
    const raw = readMetric(r, metric);
    if (!Number.isFinite(raw)) {
      out.set(r.id, 0);
      continue;
    }
    const norm = range === 0 ? 0 : (raw - min) / range;
    out.set(r.id, invert ? 1 - norm : norm);
  }
  return out;
}
