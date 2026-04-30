import type { MetaAdPerformanceRow } from "@/lib/api/facebookApi";
import type { RankingMetric } from "./rankingScoring";

/**
 * Pure config for the multi-ad comparison view.
 *
 * Each table row pulls one value from a `MetaAdPerformanceRow`. The
 * `accessor` returns either a primitive (number / string) or `null` to
 * mean "show as em-dash". The `formatter` decides how the resulting value
 * renders in the body cell.
 *
 * Groups are rendered with a thin top-border separator above each group's
 * first row.
 */

export type ComparisonGroup =
  | "Performance"
  | "Creative"
  | "Engagement"
  | "Context";

type AdRow = MetaAdPerformanceRow;

type FormatterKind =
  | "currency"
  | "percent"
  | "number"
  | "ratio"
  | "yes_no_dash";

export interface ComparisonDimension {
  key: string;
  label: string;
  group: ComparisonGroup;
  accessor: (row: AdRow) => number | string | boolean | null;
  formatter: FormatterKind;
}

const cvr = (row: AdRow): number | null => {
  if (!row.clicks || row.clicks <= 0) return null;
  return row.purchases / row.clicks;
};

export const COMPARISON_DIMENSIONS: readonly ComparisonDimension[] = [
  // Performance (3)
  {
    key: "roas",
    label: "ROAS",
    group: "Performance",
    accessor: (r) => Number(r.roas),
    formatter: "ratio",
  },
  {
    key: "cpa",
    label: "CPA",
    group: "Performance",
    accessor: (r) => (r.purchases > 0 ? r.cpa : null),
    formatter: "currency",
  },
  {
    key: "cvr",
    label: "CVR",
    group: "Performance",
    accessor: (r) => cvr(r),
    formatter: "percent",
  },

  // Creative (4)
  {
    key: "hook_rate_strict",
    label: "Hook rate (strict)",
    group: "Creative",
    accessor: (r) => r.hook_rate_strict,
    formatter: "percent",
  },
  {
    key: "hold_rate",
    label: "Hold rate",
    group: "Creative",
    accessor: (r) => r.hold_rate,
    formatter: "percent",
  },
  {
    key: "ctr",
    label: "CTR",
    group: "Creative",
    accessor: (r) => r.ctr,
    formatter: "percent",
  },
  {
    key: "completion_rate",
    label: "Completion rate",
    group: "Creative",
    accessor: (r) => r.completion_rate,
    formatter: "percent",
  },

  // Engagement (3)
  {
    key: "lpv_count",
    label: "Landing-page views",
    group: "Engagement",
    accessor: (r) => r.lpv_count,
    formatter: "number",
  },
  {
    key: "comment_count",
    label: "Comments",
    group: "Engagement",
    accessor: (r) => r.comment_count,
    formatter: "number",
  },
  {
    key: "video_3sec_count",
    label: "3-second video views",
    group: "Engagement",
    accessor: (r) => r.video_3sec_count,
    formatter: "number",
  },

  // Context (5) — frequency and ad_count are not exposed on
  // MetaAdPerformanceRow, so impressions and total_events stand in.
  {
    key: "spend",
    label: "Spend",
    group: "Context",
    accessor: (r) => r.spend,
    formatter: "currency",
  },
  {
    key: "impressions",
    label: "Impressions",
    group: "Context",
    accessor: (r) => r.impressions,
    formatter: "number",
  },
  {
    key: "days_with_data",
    label: "Days with data",
    group: "Context",
    accessor: (r) => r.days_with_data,
    formatter: "number",
  },
  {
    key: "is_in_learning",
    label: "In learning",
    group: "Context",
    accessor: (r) => r.is_in_learning,
    formatter: "yes_no_dash",
  },
  {
    key: "total_events",
    label: "Total events",
    group: "Context",
    accessor: (r) => r.total_events,
    formatter: "number",
  },
] as const;

export const COMPARISON_GROUP_ORDER: readonly ComparisonGroup[] = [
  "Performance",
  "Creative",
  "Engagement",
  "Context",
] as const;

/**
 * Radar dimensions — same seven metrics as the ranking weight panel so the
 * radial axes line up visually with how the Ranking tab scores each ad.
 */
export interface RadarDimension {
  key: RankingMetric;
  label: string;
  invert: boolean;
}

export const RADAR_DIMENSIONS: readonly RadarDimension[] = [
  { key: "roas", label: "ROAS", invert: false },
  { key: "cpa", label: "CPA", invert: true },
  { key: "hook_rate_strict", label: "Hook", invert: false },
  { key: "hold_rate", label: "Hold", invert: false },
  { key: "ctr", label: "CTR", invert: false },
  { key: "cost_per_lpv", label: "Cost/LPV", invert: true },
  { key: "cost_per_comment", label: "Cost/Cmt", invert: true },
] as const;

/**
 * Per-ad accent palette. Capped at 5 because the comparison UX caps at 5
 * ads. Ad #1 anchors to brand teal; the remaining four hues are picked to
 * be distinguishable on white and on the amber lifecycle banner.
 */
export const AD_ACCENT_PALETTE: readonly string[] = [
  "#3CCED7", // brand teal
  "#F87171", // coral
  "#38BDF8", // sky
  "#FBBF24", // amber
  "#A78BFA", // violet
] as const;
