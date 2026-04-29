"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

import {
  facebookApi,
  type MetaAdPerformanceRow,
} from "@/lib/api/facebookApi";
import FilterPanel, {
  DEFAULT_RANKING_FILTERS,
  RANKING_DAY_OPTIONS,
  type RankingFilters,
  type RankingDays,
} from "./FilterPanel";
import MetricWeightControls from "./MetricWeightControls";
import RankingTable from "./RankingTable";
import {
  RANKING_METRICS,
  applyPreset,
  detectActivePreset,
  type PresetName,
  type RankingMetric,
  type WeightSet,
} from "./rankingScoring";

interface RankingPanelProps {
  adAccountId: number;
  currency: string;
}

const PRESET_NAMES: PresetName[] = [
  "performance",
  "engagement",
  "cost_efficient",
];

function parseDays(raw: string | null): RankingDays {
  if (!raw) return DEFAULT_RANKING_FILTERS.days;
  const n = Number(raw);
  return (RANKING_DAY_OPTIONS as readonly number[]).includes(n)
    ? (n as RankingDays)
    : DEFAULT_RANKING_FILTERS.days;
}

function parseInt0(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseBool(raw: string | null): boolean {
  return raw === "true" || raw === "1";
}

function parseWeightsFromUrl(
  presetParam: string | null,
  wParam: string | null
): WeightSet {
  if (presetParam && PRESET_NAMES.includes(presetParam as PresetName)) {
    return applyPreset(presetParam as PresetName);
  }
  if (presetParam === "custom" && wParam) {
    const out = applyPreset("performance");
    for (const piece of wParam.split(",")) {
      const [metric, value] = piece.split(":");
      if (
        metric &&
        value !== undefined &&
        (RANKING_METRICS as readonly string[]).includes(metric)
      ) {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0 && n <= 1) {
          out[metric as RankingMetric] = n;
        }
      }
    }
    return out;
  }
  return applyPreset("performance");
}

function encodeWeightsForUrl(weights: WeightSet): string {
  return RANKING_METRICS.map((m) => `${m}:${weights[m].toFixed(2)}`).join(",");
}

function readFiltersFromSearch(
  search: URLSearchParams
): { filters: RankingFilters; weights: WeightSet } {
  const filters: RankingFilters = {
    days: parseDays(search.get("days")),
    minImpressions: parseInt0(
      search.get("min_impressions"),
      DEFAULT_RANKING_FILTERS.minImpressions
    ),
    minSpend: parseInt0(
      search.get("min_spend"),
      DEFAULT_RANKING_FILTERS.minSpend
    ),
    minEvents: parseInt0(
      search.get("min_events"),
      DEFAULT_RANKING_FILTERS.minEvents
    ),
    minDaysWithData: parseInt0(
      search.get("min_days_with_data"),
      DEFAULT_RANKING_FILTERS.minDaysWithData
    ),
    includeInactive: parseBool(search.get("include_inactive")),
  };
  const weights = parseWeightsFromUrl(
    search.get("preset"),
    search.get("w")
  );
  return { filters, weights };
}

export default function RankingPanel({
  adAccountId,
  currency,
}: RankingPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = useMemo(
    () => readFiltersFromSearch(new URLSearchParams(searchParams.toString())),
    // initial only — subsequent URL changes flow through state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [filters, setFilters] = useState<RankingFilters>(initial.filters);
  const [weights, setWeights] = useState<WeightSet>(initial.weights);
  const [rows, setRows] = useState<MetaAdPerformanceRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const lastSyncedSearchRef = useRef<string>("");

  // Sync URL <- state (debounced is overkill; React batches state updates)
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", "ranking");
    next.set("days", String(filters.days));

    const setOrDelete = (key: string, value: string, fallback: string) => {
      if (value === fallback) next.delete(key);
      else next.set(key, value);
    };

    setOrDelete(
      "min_impressions",
      String(filters.minImpressions),
      String(DEFAULT_RANKING_FILTERS.minImpressions)
    );
    setOrDelete(
      "min_spend",
      String(filters.minSpend),
      String(DEFAULT_RANKING_FILTERS.minSpend)
    );
    setOrDelete(
      "min_events",
      String(filters.minEvents),
      String(DEFAULT_RANKING_FILTERS.minEvents)
    );
    setOrDelete(
      "min_days_with_data",
      String(filters.minDaysWithData),
      String(DEFAULT_RANKING_FILTERS.minDaysWithData)
    );
    if (filters.includeInactive) next.set("include_inactive", "true");
    else next.delete("include_inactive");

    const presetMatch = detectActivePreset(weights);
    if (presetMatch === "custom") {
      next.set("preset", "custom");
      next.set("w", encodeWeightsForUrl(weights));
    } else {
      if (presetMatch === "performance") next.delete("preset");
      else next.set("preset", presetMatch);
      next.delete("w");
    }

    const nextStr = next.toString();
    if (nextStr === lastSyncedSearchRef.current) return;
    lastSyncedSearchRef.current = nextStr;
    router.replace(`${pathname}?${nextStr}`, { scroll: false });
  }, [filters, weights, pathname, router, searchParams]);

  // Fetch when filters change
  useEffect(() => {
    let active = true;
    setLoading(true);
    facebookApi
      .getMetaAdPerformance(adAccountId, filters.days, {
        minImpressions: filters.minImpressions || undefined,
        minSpend: filters.minSpend || undefined,
        minEvents: filters.minEvents || undefined,
        minDaysWithData: filters.minDaysWithData || undefined,
        includeInactive: filters.includeInactive,
      })
      .then((data) => {
        if (!active) return;
        setRows(data.ads);
      })
      .catch(() => {
        if (!active) return;
        toast.error("Failed to load ad ranking.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    adAccountId,
    filters.days,
    filters.minImpressions,
    filters.minSpend,
    filters.minEvents,
    filters.minDaysWithData,
    filters.includeInactive,
  ]);

  const handleFiltersChange = useCallback((next: RankingFilters) => {
    setFilters(next);
  }, []);

  const handleWeightsChange = useCallback((next: WeightSet) => {
    setWeights(next);
  }, []);

  return (
    <div className="space-y-5">
      <FilterPanel
        filters={filters}
        onChange={handleFiltersChange}
        currency={currency}
      />
      <MetricWeightControls
        weights={weights}
        onChange={handleWeightsChange}
      />
      <RankingTable
        rows={rows}
        weights={weights}
        currency={currency}
        loading={loading}
      />
    </div>
  );
}
