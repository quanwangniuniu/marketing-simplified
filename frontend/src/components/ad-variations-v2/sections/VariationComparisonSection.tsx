"use client";

import { useState } from "react";
import type {
  AdVariation,
  ComparisonResponse,
  VariationStatus,
} from "@/types/adVariation";
import BrandButton from "@/components/campaigns-v2/BrandButton";
import AdVariationStatusPill from "@/components/ad-variations-v2/pills/AdVariationStatusPill";

interface Props {
  variations: AdVariation[];
  compareIds: number[];
  compareData: ComparisonResponse | null;
  onSelect: (ids: number[]) => void;
  onCompare: () => Promise<void> | void;
  onMarkStatus: (variation: AdVariation, targetStatus: VariationStatus) => Promise<void> | void;
}

export default function VariationComparisonSection({
  variations,
  compareIds,
  compareData,
  onSelect,
  onCompare,
  onMarkStatus,
}: Props) {
  const [comparing, setComparing] = useState(false);
  const selected = variations.filter((item) => compareIds.includes(item.id));
  const rows = compareData?.rows || [];

  const handleRun = async () => {
    try {
      setComparing(true);
      await onCompare();
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Left: Selector */}
      <aside className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wide text-gray-400">
            Comparison Lab
          </p>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
            {compareIds.length}/4
          </span>
        </div>
        <h3 className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Pick 2–4 variations
        </h3>
        <p className="mt-1.5 text-xs text-gray-500">
          Build a focused head-to-head view and mark winners instantly.
        </p>
        <div className="mt-4 space-y-2">
          {variations.length === 0 && (
            <p className="py-6 text-center text-xs text-gray-400">
              No variations to compare.
            </p>
          )}
          {variations.map((variation) => {
            const isSelected = compareIds.includes(variation.id);
            const disabled = !isSelected && compareIds.length >= 4;
            return (
              <label
                key={variation.id}
                className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-xs transition ${
                  isSelected
                    ? "border-[#0E8A96]/30 bg-[#0E8A96]/10 text-[#0E8A96]"
                    : disabled
                    ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={disabled}
                    onChange={() => {
                      if (isSelected) {
                        onSelect(compareIds.filter((id) => id !== variation.id));
                      } else if (compareIds.length < 4) {
                        onSelect([...compareIds, variation.id]);
                      }
                    }}
                    className="accent-[#0E8A96]"
                  />
                  <span className="truncate font-medium">{variation.name}</span>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                  {variation.creativeType}
                </span>
              </label>
            );
          })}
        </div>
        <BrandButton
          disabled={compareIds.length < 2 || comparing}
          onClick={handleRun}
          title={
            compareIds.length < 2 ? "Select at least 2 variations" : undefined
          }
          className="mt-5 w-full"
        >
          {comparing ? "Running..." : "Run comparison"}
        </BrandButton>
      </aside>

      {/* Right: Snapshot + Attribute table */}
      <section className="space-y-6">
        {/* Snapshot */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">
                Snapshot
              </p>
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
                Variation comparison
              </h3>
            </div>
            <div className="flex gap-2 text-[11px] text-gray-500">
              <span className="rounded-full border border-gray-200 px-2.5 py-0.5">
                {rows.length} rows
              </span>
              <span className="rounded-full border border-gray-200 px-2.5 py-0.5">
                {compareIds.length} columns
              </span>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {selected.length === 0 ? (
              <p className="col-span-full py-8 text-center text-xs text-gray-400">
                Select variations to preview here.
              </p>
            ) : (
              selected.map((variation) => (
                <div
                  key={variation.id}
                  className="rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400">
                      Variation
                    </p>
                    <AdVariationStatusPill status={variation.status} />
                  </div>
                  <h4 className="mt-2 truncate text-sm font-semibold text-gray-900">
                    {variation.name}
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-600">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5">
                      {variation.creativeType}
                    </span>
                    <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5">
                      {variation.tags?.length
                        ? `${variation.tags.length} tags`
                        : "No tags"}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onMarkStatus(variation, "Winner")}
                      className={`flex-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                        variation.status === "Winner"
                          ? "bg-emerald-600 text-white hover:bg-emerald-500"
                          : "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      {variation.status === "Winner"
                        ? "Unmark Winner"
                        : "Mark Winner"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onMarkStatus(variation, "Loser")}
                      className={`flex-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                        variation.status === "Loser"
                          ? "bg-rose-600 text-white hover:bg-rose-500"
                          : "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50"
                      }`}
                    >
                      {variation.status === "Loser"
                        ? "Unmark Loser"
                        : "Mark Loser"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Attribute table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm ring-1 ring-gray-100">
          <table className="w-full min-w-[720px] text-sm">
            <colgroup>
              <col className="w-56" />
              {compareIds.map((id) => (
                <col key={id} className="w-64" />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2.5 text-left">
                  Attribute
                </th>
                {compareIds.map((id) => {
                  const variation = variations.find((item) => item.id === id);
                  return (
                    <th key={id} className="px-4 py-2.5 text-left">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-gray-700">
                          {variation?.name || id}
                        </span>
                        {variation && (
                          <AdVariationStatusPill status={variation.status} />
                        )}
                      </div>
                      {variation && (
                        <span className="mt-1 inline-flex rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-500">
                          {variation.creativeType}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {rows.map((row, index) => (
                <tr
                  key={row.key}
                  className={`transition hover:bg-[#0E8A96]/5 ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                  }`}
                >
                  <td className="sticky left-0 bg-inherit px-4 py-2.5 text-xs text-gray-500">
                    {row.key}
                  </td>
                  {compareIds.map((id) => (
                    <td
                      key={id}
                      className="px-4 py-2.5 text-xs text-gray-700"
                    >
                      {row.values[id] ?? "/"}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={compareIds.length + 1}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    Select variations and run a comparison.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
