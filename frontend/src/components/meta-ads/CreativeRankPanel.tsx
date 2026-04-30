"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import ExportActionMenu from "./ExportActionMenu";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

import {
  facebookApi,
  type MetaCreativePerformanceRow,
} from "@/lib/api/facebookApi";
import FilterPanel, {
  DEFAULT_RANKING_FILTERS,
  RANKING_DAY_OPTIONS,
  type RankingFilters,
  type RankingDays,
} from "./FilterPanel";
import MetricWeightControls from "./MetricWeightControls";
import CreativeRankTable from "./CreativeRankTable";
import {
  RANKING_METRICS,
  applyPreset,
  detectActivePreset,
  type PresetName,
  type RankingMetric,
  type WeightSet,
} from "./rankingScoring";

interface CreativeRankPanelProps {
  adAccountId: number;
  currency: string;
}

interface CreativeRankFilters extends RankingFilters {
  includeSharedCreatives: boolean;
}

const DEFAULT_CREATIVE_FILTERS: CreativeRankFilters = {
  ...DEFAULT_RANKING_FILTERS,
  includeSharedCreatives: false,
};

const PRESET_NAMES: PresetName[] = [
  "performance",
  "engagement",
  "cost_efficient",
];

function parseDays(raw: string | null): RankingDays {
  if (!raw) return DEFAULT_CREATIVE_FILTERS.days;
  const n = Number(raw);
  return (RANKING_DAY_OPTIONS as readonly number[]).includes(n)
    ? (n as RankingDays)
    : DEFAULT_CREATIVE_FILTERS.days;
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

function readFromSearch(
  search: URLSearchParams
): { filters: CreativeRankFilters; weights: WeightSet } {
  const filters: CreativeRankFilters = {
    days: parseDays(search.get("days")),
    minImpressions: parseInt0(
      search.get("min_impressions"),
      DEFAULT_CREATIVE_FILTERS.minImpressions
    ),
    minSpend: parseInt0(
      search.get("min_spend"),
      DEFAULT_CREATIVE_FILTERS.minSpend
    ),
    minEvents: parseInt0(
      search.get("min_events"),
      DEFAULT_CREATIVE_FILTERS.minEvents
    ),
    minDaysWithData: parseInt0(
      search.get("min_days_with_data"),
      DEFAULT_CREATIVE_FILTERS.minDaysWithData
    ),
    includeInactive: parseBool(search.get("include_inactive")),
    includeSharedCreatives: parseBool(search.get("include_shared_creatives")),
  };
  const weights = parseWeightsFromUrl(
    search.get("preset"),
    search.get("w")
  );
  return { filters, weights };
}

export default function CreativeRankPanel({
  adAccountId,
  currency,
}: CreativeRankPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sharedToggleId = useId();

  const initial = useMemo(
    () => readFromSearch(new URLSearchParams(searchParams.toString())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [filters, setFilters] = useState<CreativeRankFilters>(initial.filters);
  const [weights, setWeights] = useState<WeightSet>(initial.weights);
  const [rows, setRows] = useState<MetaCreativePerformanceRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const lastSyncedSearchRef = useRef<string>("");

  const toggleSelected = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", "creative-rank");
    next.set("days", String(filters.days));

    const setOrDelete = (key: string, value: string, fallback: string) => {
      if (value === fallback) next.delete(key);
      else next.set(key, value);
    };

    setOrDelete(
      "min_impressions",
      String(filters.minImpressions),
      String(DEFAULT_CREATIVE_FILTERS.minImpressions)
    );
    setOrDelete(
      "min_spend",
      String(filters.minSpend),
      String(DEFAULT_CREATIVE_FILTERS.minSpend)
    );
    setOrDelete(
      "min_events",
      String(filters.minEvents),
      String(DEFAULT_CREATIVE_FILTERS.minEvents)
    );
    setOrDelete(
      "min_days_with_data",
      String(filters.minDaysWithData),
      String(DEFAULT_CREATIVE_FILTERS.minDaysWithData)
    );
    if (filters.includeInactive) next.set("include_inactive", "true");
    else next.delete("include_inactive");
    if (filters.includeSharedCreatives)
      next.set("include_shared_creatives", "true");
    else next.delete("include_shared_creatives");

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

  useEffect(() => {
    let active = true;
    setLoading(true);
    facebookApi
      .getMetaCreativePerformance(adAccountId, filters.days, {
        minImpressions: filters.minImpressions || undefined,
        minSpend: filters.minSpend || undefined,
        minEvents: filters.minEvents || undefined,
        minDaysWithData: filters.minDaysWithData || undefined,
        includeInactive: filters.includeInactive,
        includeSharedCreatives: filters.includeSharedCreatives,
      })
      .then((data) => {
        if (!active) return;
        setRows(data.creatives);
      })
      .catch(() => {
        if (!active) return;
        toast.error("Failed to load creative ranking.");
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
    filters.includeSharedCreatives,
  ]);

  const handleFiltersChange = useCallback((next: RankingFilters) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const handleSharedToggle = useCallback(
    (next: boolean) => {
      setFilters((prev) => ({ ...prev, includeSharedCreatives: next }));
    },
    []
  );

  const handleWeightsChange = useCallback((next: WeightSet) => {
    setWeights(next);
  }, []);

  const sharedExtras = (
    <label
      htmlFor={sharedToggleId}
      className="flex items-center gap-2 text-[12px] text-gray-700"
    >
      <input
        id={sharedToggleId}
        type="checkbox"
        checked={filters.includeSharedCreatives}
        onChange={(e) => handleSharedToggle(e.target.checked)}
        className="h-4 w-4 rounded accent-[#3CCED7]"
      />
      Show shared creatives (referenced by more than one ad)
    </label>
  );

  return (
    <div className="space-y-5">
      <FilterPanel
        filters={filters}
        onChange={handleFiltersChange}
        currency={currency}
        extras={sharedExtras}
      />
      <MetricWeightControls
        weights={weights}
        onChange={handleWeightsChange}
      />
      <CreativeRankTable
        rows={rows}
        weights={weights}
        currency={currency}
        loading={loading}
        selection={{
          selectedIds,
          onToggle: toggleSelected,
          headerSlot: (
            <ExportActionMenu
              unit="creative"
              selectedIds={Array.from(selectedIds)}
              adAccountId={adAccountId}
              days={filters.days}
            />
          ),
        }}
      />
    </div>
  );
}
