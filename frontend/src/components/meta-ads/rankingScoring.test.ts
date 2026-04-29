import type { MetaAdPerformanceRow } from "@/lib/api/facebookApi";
import {
  PRESETS,
  applyPreset,
  computeCompositeScores,
  detectActivePreset,
  sumWeights,
  type WeightSet,
} from "./rankingScoring";

function makeRow(
  id: number,
  overrides: Partial<MetaAdPerformanceRow> = {}
): MetaAdPerformanceRow {
  return {
    id,
    meta_ad_id: `m${id}`,
    name: `Ad ${id}`,
    effective_status: "ACTIVE",
    adset_id: 1,
    adset_name: "AS",
    campaign_id: 1,
    campaign_name: "C",
    creative: null,
    spend: "0",
    impressions: 0,
    clicks: 0,
    leads: 0,
    calls: 0,
    purchases: 0,
    messages: 0,
    revenue: "0",
    ctr: "0",
    cpc: "0",
    cpl: "0",
    cpa: "0",
    roas: "0",
    hook_rate: "0",
    hook_rate_strict: "0",
    hold_rate: "0",
    completion_rate: "0",
    video_3sec_count: 0,
    lpv_count: 0,
    cost_per_lpv: "0",
    comment_count: 0,
    cost_per_comment: "0",
    total_events: 0,
    days_with_data: 0,
    is_in_learning: null,
    ...overrides,
  };
}

describe("applyPreset", () => {
  it("returns Performance preset weights summing to 1.0", () => {
    const w = applyPreset("performance");
    expect(sumWeights(w)).toBeCloseTo(1.0, 5);
    expect(w.roas).toBe(0.5);
    expect(w.cost_per_lpv).toBe(0);
  });

  it("returns Engagement preset weights summing to 1.0", () => {
    const w = applyPreset("engagement");
    expect(sumWeights(w)).toBeCloseTo(1.0, 5);
    expect(w.hook_rate_strict).toBe(0.25);
    expect(w.hold_rate).toBe(0.25);
  });

  it("returns Cost-efficient preset weights summing to 1.0", () => {
    const w = applyPreset("cost_efficient");
    expect(sumWeights(w)).toBeCloseTo(1.0, 5);
    expect(w.cpa).toBe(0.4);
    expect(w.cost_per_lpv).toBe(0.25);
  });
});

describe("computeCompositeScores", () => {
  it("ranks rows by Performance preset (roas dominant)", () => {
    const rows = [
      makeRow(1, { roas: "1.0", cpa: "20" }),
      makeRow(2, { roas: "5.0", cpa: "20" }),
      makeRow(3, { roas: "3.0", cpa: "20" }),
    ];
    const scores = computeCompositeScores(rows, PRESETS.performance);
    expect(scores.get(2)).toBeGreaterThan(scores.get(3)!);
    expect(scores.get(3)).toBeGreaterThan(scores.get(1)!);
  });

  it("inverts cpa correctly — cheaper cpa scores higher", () => {
    const weights: WeightSet = {
      roas: 0,
      cpa: 1,
      hook_rate_strict: 0,
      hold_rate: 0,
      ctr: 0,
      cost_per_lpv: 0,
      cost_per_comment: 0,
    };
    const rows = [
      makeRow(1, { cpa: "10" }),
      makeRow(2, { cpa: "100" }),
    ];
    const scores = computeCompositeScores(rows, weights);
    expect(scores.get(1)).toBeGreaterThan(scores.get(2)!);
  });

  it("inverts cost_per_lpv and cost_per_comment for Cost-efficient preset", () => {
    const rows = [
      makeRow(1, {
        roas: "2.0",
        cpa: "20",
        ctr: "1",
        cost_per_lpv: "1.0",
        cost_per_comment: "1.0",
      }),
      makeRow(2, {
        roas: "2.0",
        cpa: "20",
        ctr: "1",
        cost_per_lpv: "5.0",
        cost_per_comment: "5.0",
      }),
    ];
    const scores = computeCompositeScores(rows, PRESETS.cost_efficient);
    expect(scores.get(1)).toBeGreaterThan(scores.get(2)!);
  });

  it("returns 0 contribution when range is 0 (all rows equal)", () => {
    const weights: WeightSet = {
      roas: 1,
      cpa: 0,
      hook_rate_strict: 0,
      hold_rate: 0,
      ctr: 0,
      cost_per_lpv: 0,
      cost_per_comment: 0,
    };
    const rows = [
      makeRow(1, { roas: "2.0" }),
      makeRow(2, { roas: "2.0" }),
    ];
    const scores = computeCompositeScores(rows, weights);
    expect(scores.get(1)).toBe(0);
    expect(scores.get(2)).toBe(0);
  });

  it("handles weights summing != 1.0 without crashing", () => {
    const weights: WeightSet = {
      roas: 0.5,
      cpa: 0.5,
      hook_rate_strict: 0.5,
      hold_rate: 0.5,
      ctr: 0,
      cost_per_lpv: 0,
      cost_per_comment: 0,
    };
    const rows = [
      makeRow(1, {
        roas: "5",
        cpa: "10",
        hook_rate_strict: "30",
        hold_rate: "20",
      }),
      makeRow(2, {
        roas: "1",
        cpa: "50",
        hook_rate_strict: "5",
        hold_rate: "5",
      }),
    ];
    expect(() => computeCompositeScores(rows, weights)).not.toThrow();
    const scores = computeCompositeScores(rows, weights);
    expect(scores.size).toBe(2);
    expect(scores.get(1)).toBeGreaterThan(scores.get(2)!);
  });

  it("skips metric when weight is 0 (Performance preset has 0 on cost_per_lpv)", () => {
    const rows = [
      makeRow(1, {
        roas: "2.0",
        cpa: "20",
        cost_per_lpv: "10000",
      }),
      makeRow(2, {
        roas: "2.0",
        cpa: "20",
        cost_per_lpv: "0.01",
      }),
    ];
    const scores = computeCompositeScores(rows, PRESETS.performance);
    expect(scores.get(1)!).toBeCloseTo(scores.get(2)!, 5);
  });

  it("handles non-finite raw value by skipping that metric for that row", () => {
    const weights: WeightSet = {
      roas: 1,
      cpa: 0,
      hook_rate_strict: 0,
      hold_rate: 0,
      ctr: 0,
      cost_per_lpv: 0,
      cost_per_comment: 0,
    };
    const rows = [
      makeRow(1, { roas: "NaN" }),
      makeRow(2, { roas: "5" }),
      makeRow(3, { roas: "1" }),
    ];
    const scores = computeCompositeScores(rows, weights);
    expect(scores.get(1)).toBe(0);
    expect(scores.get(2)).toBeGreaterThan(scores.get(3)!);
  });
});

describe("detectActivePreset", () => {
  it("detects performance preset exactly", () => {
    expect(detectActivePreset(PRESETS.performance)).toBe("performance");
    expect(detectActivePreset(PRESETS.engagement)).toBe("engagement");
    expect(detectActivePreset(PRESETS.cost_efficient)).toBe("cost_efficient");
  });

  it('returns "custom" when one weight is off by more than tolerance', () => {
    const tweaked = { ...PRESETS.performance, roas: 0.45 };
    expect(detectActivePreset(tweaked)).toBe("custom");
  });

  it("treats sub-tolerance drift as the matching preset", () => {
    const tweaked = { ...PRESETS.performance, roas: 0.5005 };
    expect(detectActivePreset(tweaked)).toBe("performance");
  });
});
