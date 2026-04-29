"use client";

import { useId, type ReactNode } from "react";

export const RANKING_DAY_OPTIONS = [1, 2, 3, 7, 14, 28, 30] as const;
export type RankingDays = (typeof RANKING_DAY_OPTIONS)[number];

export interface RankingFilters {
  days: RankingDays;
  minImpressions: number;
  minSpend: number;
  minEvents: number;
  minDaysWithData: number;
  includeInactive: boolean;
}

export const DEFAULT_RANKING_FILTERS: RankingFilters = {
  days: 14,
  minImpressions: 0,
  minSpend: 100,
  minEvents: 50,
  minDaysWithData: 7,
  includeInactive: false,
};

interface FilterPanelProps {
  filters: RankingFilters;
  onChange: (next: RankingFilters) => void;
  currency: string;
  /**
   * Optional extra controls rendered after the include_inactive checkbox.
   * Used by the creative leaderboard to add an `include_shared_creatives`
   * toggle without polluting the shared `RankingFilters` shape.
   */
  extras?: ReactNode;
}

const INPUT_CLASSES =
  "rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30";

const FIELD_LABEL =
  "text-[11px] font-medium uppercase tracking-wide text-gray-500";

function readNumber(raw: string, fallback: number): number {
  if (raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export default function FilterPanel({
  filters,
  onChange,
  currency,
  extras,
}: FilterPanelProps) {
  const minImpId = useId();
  const minSpendId = useId();
  const minEventsId = useId();
  const minDaysId = useId();
  const includeInactiveId = useId();

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Filters
        </h2>
        <span className="text-[11px] text-gray-400">
          Defaults exclude paused ads and low-confidence rows
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <span className={`${FIELD_LABEL} mb-2 block`}>Time window</span>
          <div className="flex flex-wrap gap-1.5">
            {RANKING_DAY_OPTIONS.map((d) => {
              const active = filters.days === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onChange({ ...filters, days: d })}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                    active
                      ? "border-transparent bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white shadow-sm"
                      : "border-transparent bg-gray-100 text-gray-700 hover:border-[#3CCED7]/40 hover:bg-white"
                  }`}
                >
                  {d} day{d > 1 ? "s" : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor={minImpId} className={`${FIELD_LABEL} mb-1.5 block`}>
              Min impressions
            </label>
            <input
              id={minImpId}
              type="number"
              min={0}
              step={100}
              value={filters.minImpressions === 0 ? "" : filters.minImpressions}
              onChange={(e) =>
                onChange({
                  ...filters,
                  minImpressions: readNumber(
                    e.target.value,
                    filters.minImpressions
                  ),
                })
              }
              placeholder="0"
              className={`${INPUT_CLASSES} w-full`}
            />
          </div>

          <div>
            <label htmlFor={minSpendId} className={`${FIELD_LABEL} mb-1.5 block`}>
              Min spend
              <span className="ml-1 text-[10px] font-normal normal-case tracking-normal text-gray-400">
                ({currency || "USD"})
              </span>
            </label>
            <input
              id={minSpendId}
              type="number"
              min={0}
              step={10}
              value={filters.minSpend === 0 ? "" : filters.minSpend}
              onChange={(e) =>
                onChange({
                  ...filters,
                  minSpend: readNumber(e.target.value, filters.minSpend),
                })
              }
              placeholder="0"
              className={`${INPUT_CLASSES} w-full`}
            />
          </div>

          <div>
            <label htmlFor={minEventsId} className={`${FIELD_LABEL} mb-1.5 block`}>
              Min events
              <span className="ml-1 text-[10px] font-normal normal-case tracking-normal text-gray-400">
                (leads + purchases + calls + msgs)
              </span>
            </label>
            <input
              id={minEventsId}
              type="number"
              min={0}
              step={10}
              value={filters.minEvents === 0 ? "" : filters.minEvents}
              onChange={(e) =>
                onChange({
                  ...filters,
                  minEvents: readNumber(e.target.value, filters.minEvents),
                })
              }
              placeholder="0"
              className={`${INPUT_CLASSES} w-full`}
            />
          </div>

          <div>
            <label htmlFor={minDaysId} className={`${FIELD_LABEL} mb-1.5 block`}>
              Min days with data
            </label>
            <input
              id={minDaysId}
              type="number"
              min={0}
              max={filters.days}
              step={1}
              value={
                filters.minDaysWithData === 0 ? "" : filters.minDaysWithData
              }
              onChange={(e) =>
                onChange({
                  ...filters,
                  minDaysWithData: readNumber(
                    e.target.value,
                    filters.minDaysWithData
                  ),
                })
              }
              placeholder="0"
              className={`${INPUT_CLASSES} w-full`}
            />
          </div>
        </div>

        <label
          htmlFor={includeInactiveId}
          className="flex items-center gap-2 text-[12px] text-gray-700"
        >
          <input
            id={includeInactiveId}
            type="checkbox"
            checked={filters.includeInactive}
            onChange={(e) =>
              onChange({ ...filters, includeInactive: e.target.checked })
            }
            className="h-4 w-4 rounded accent-[#3CCED7]"
          />
          Include inactive ads (zero impressions in window)
        </label>

        {extras}
      </div>
    </section>
  );
}
