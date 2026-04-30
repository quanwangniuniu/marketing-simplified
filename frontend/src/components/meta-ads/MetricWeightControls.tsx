"use client";

import { Slider } from "@/components/ui/slider";
import {
  METRIC_LABEL,
  PRESETS,
  PRESET_LABEL,
  RANKING_METRICS,
  applyPreset,
  detectActivePreset,
  sumWeights,
  type PresetName,
  type WeightSet,
} from "./rankingScoring";

interface MetricWeightControlsProps {
  weights: WeightSet;
  onChange: (next: WeightSet) => void;
}

const PRESET_ORDER: PresetName[] = ["performance", "engagement", "cost_efficient"];
const SLIDER_STEP_PERCENT = 5;

export default function MetricWeightControls({
  weights,
  onChange,
}: MetricWeightControlsProps) {
  const activePreset = detectActivePreset(weights);
  const sum = sumWeights(weights);
  const sumPercent = Math.round(sum * 100);
  const sumDrifted = Math.abs(sum - 1) > 0.01;

  const setMetricWeight = (metric: keyof WeightSet, percent: number) => {
    onChange({ ...weights, [metric]: percent / 100 });
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Metric weights
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-[11px] ${
              sumDrifted ? "text-amber-700" : "text-gray-500"
            }`}
          >
            Sum: {sumPercent}%
          </span>
          {activePreset === "custom" && (
            <span className="text-[11px] text-gray-400">Custom weights</span>
          )}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {PRESET_ORDER.map((name) => {
          const active = activePreset === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(applyPreset(name))}
              aria-pressed={active}
              className={`h-9 rounded-lg px-4 text-sm font-medium transition ${
                active
                  ? "bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white shadow-sm hover:opacity-95"
                  : "bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300"
              }`}
            >
              {PRESET_LABEL[name]}
            </button>
          );
        })}
      </div>

      <div className="space-y-1">
        {RANKING_METRICS.map((metric) => {
          const value = Math.round((weights[metric] ?? 0) * 100);
          const inverted =
            metric === "cpa" ||
            metric === "cost_per_lpv" ||
            metric === "cost_per_comment";
          return (
            <div
              key={metric}
              className="grid grid-cols-[140px_1fr_56px] items-center gap-3 py-2"
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-gray-700">
                {METRIC_LABEL[metric]}
                {inverted && (
                  <span className="ml-1 text-[10px] font-normal normal-case tracking-normal text-gray-400">
                    (lower better)
                  </span>
                )}
              </span>
              <Slider
                value={[value]}
                min={0}
                max={100}
                step={SLIDER_STEP_PERCENT}
                onValueChange={([next]) => setMetricWeight(metric, next ?? 0)}
                aria-label={`${METRIC_LABEL[metric]} weight`}
              />
              <span className="text-right font-mono text-xs text-gray-900">
                {value}%
              </span>
            </div>
          );
        })}
      </div>

      {activePreset !== "custom" && (
        <p className="mt-4 text-[11px] text-gray-400">
          Showing the {PRESET_LABEL[activePreset]} preset. Drag any slider to
          customise.
        </p>
      )}
    </section>
  );
}

export { PRESETS };
