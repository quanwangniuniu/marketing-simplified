"use client";

import Link from "next/link";
import { Image as ImageIcon, Video } from "lucide-react";

import type { MetaAdPerformanceRow } from "@/lib/api/facebookApi";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRatio,
  thumbnailOrFallback,
} from "./metaAdsUtils";
import {
  AD_ACCENT_PALETTE,
  COMPARISON_DIMENSIONS,
  COMPARISON_GROUP_ORDER,
  type ComparisonDimension,
} from "./comparisonDimensions";

interface ComparisonTableProps {
  rows: MetaAdPerformanceRow[];
  currency: string;
}

function renderCell(
  raw: number | string | boolean | null,
  formatter: ComparisonDimension["formatter"],
  currency: string
): string {
  if (raw === null || raw === undefined) return "—";
  switch (formatter) {
    case "currency":
      return formatCurrency(raw as number | string, currency);
    case "percent":
      return formatPercent(raw as number | string);
    case "number":
      return formatNumber(raw as number | string);
    case "ratio": {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return "—";
      if (n === 0) return "0.0000x";
      return `${formatRatio(String(raw))}x`;
    }
    case "yes_no_dash":
      if (raw === true) return "Yes";
      if (raw === false) return "No";
      return "—";
  }
}

export default function ComparisonTable({
  rows,
  currency,
}: ComparisonTableProps) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-6 text-center text-xs text-gray-400">
        No ads to compare.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className="w-[200px] px-4 pb-3 pt-2 text-left align-bottom"
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Dimension
              </span>
            </th>
            {rows.map((row, idx) => {
              const accent = AD_ACCENT_PALETTE[idx] ?? "#94A3B8";
              const thumb = thumbnailOrFallback(
                row.creative?.thumbnail_url ?? null
              );
              const isVideo =
                row.creative?.object_type === "VIDEO" ||
                !!row.creative?.video_id;
              return (
                <th
                  key={row.id}
                  scope="col"
                  className="px-4 pb-3 pt-2 text-left align-bottom"
                >
                  <div className="flex items-start gap-2">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-100">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={row.name || row.meta_ad_id || "Ad thumbnail"}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}
                      {isVideo && (
                        <span className="pointer-events-none absolute bottom-0 right-0 rounded-tl-md bg-black/70 px-0.5">
                          <Video className="h-2 w-2 text-white" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: accent }}
                        />
                        {row.creative?.id ? (
                          <Link
                            href={`/meta-ads/creatives/${row.creative.id}`}
                            className="truncate text-sm font-medium text-gray-900 hover:text-[#1a9ba3]"
                            title={row.name || row.meta_ad_id}
                          >
                            {row.name || row.meta_ad_id}
                          </Link>
                        ) : (
                          <span
                            className="truncate text-sm font-medium text-gray-900"
                            title={row.name || row.meta_ad_id}
                          >
                            {row.name || row.meta_ad_id}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-gray-400">
                        {row.campaign_name}
                        {row.adset_name ? ` · ${row.adset_name}` : ""}
                      </div>
                    </div>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_GROUP_ORDER.map((group, groupIdx) => {
            const groupDims = COMPARISON_DIMENSIONS.filter(
              (d) => d.group === group
            );
            return (
              <GroupRows
                key={group}
                groupName={group}
                isFirst={groupIdx === 0}
                rows={rows}
                currency={currency}
                dimensions={groupDims}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  groupName,
  isFirst,
  rows,
  currency,
  dimensions,
}: {
  groupName: string;
  isFirst: boolean;
  rows: MetaAdPerformanceRow[];
  currency: string;
  dimensions: ComparisonDimension[];
}) {
  return (
    <>
      <tr>
        <td
          colSpan={1 + rows.length}
          className={`px-4 ${isFirst ? "pb-1.5 pt-1" : "border-t border-gray-100 pb-1.5 pt-3"}`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {groupName}
          </span>
        </td>
      </tr>
      {dimensions.map((dim) => (
        <tr key={dim.key} className="hover:bg-gray-50/50">
          <td className="px-4 py-2 align-middle">
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              {dim.label}
            </span>
          </td>
          {rows.map((row) => {
            const raw = dim.accessor(row);
            const formatted = renderCell(raw, dim.formatter, currency);
            const isEmpty = formatted === "—";
            return (
              <td
                key={`${dim.key}_${row.id}`}
                className={`px-4 py-2 text-right font-mono text-sm ${isEmpty ? "text-gray-400" : "text-gray-900"}`}
              >
                {formatted}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
