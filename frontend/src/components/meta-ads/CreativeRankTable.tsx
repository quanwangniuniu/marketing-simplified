"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Image as ImageIcon,
  Video,
} from "lucide-react";

import type { MetaCreativePerformanceRow } from "@/lib/api/facebookApi";
import SelectAllHeader from "./SelectAllHeader";
import {
  formatCurrency,
  formatPercent,
  formatRatio,
  thumbnailOrFallback,
} from "./metaAdsUtils";
import { computeCompositeScores, type WeightSet } from "./rankingScoring";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const LOW_CONFIDENCE_EVENTS_THRESHOLD = 50;

export interface CreativeRankTableSelection {
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  headerSlot?: ReactNode;
}

interface CreativeRankTableProps {
  rows: MetaCreativePerformanceRow[];
  weights: WeightSet;
  currency: string;
  loading: boolean;
  selection?: CreativeRankTableSelection;
}

interface RankedRow {
  row: MetaCreativePerformanceRow;
  score: number;
  rank: number;
}

export default function CreativeRankTable({
  rows,
  weights,
  currency,
  loading,
  selection,
}: CreativeRankTableProps) {
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const ranked = useMemo<RankedRow[]>(() => {
    const scoreMap = computeCompositeScores(rows, weights);
    const out = rows.map((row) => ({
      row,
      score: scoreMap.get(row.id) ?? 0,
      rank: 0,
    }));
    out.sort((a, b) => b.score - a.score);
    out.forEach((r, i) => {
      r.rank = i + 1;
    });
    return out;
  }, [rows, weights]);

  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length, pageSize]);

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paged = useMemo(
    () => ranked.slice((safePage - 1) * pageSize, safePage * pageSize),
    [ranked, safePage, pageSize]
  );

  return (
    <section className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Ranked creatives
          {total > 0 && (
            <span className="ml-2 text-[11px] font-medium normal-case text-gray-400">
              {total}
            </span>
          )}
          {selection && selection.selectedIds.size > 0 && (
            <span className="ml-3 text-[11px] font-medium normal-case text-[#1a9ba3]">
              {selection.selectedIds.size} selected
            </span>
          )}
        </h2>
        {selection?.headerSlot ?? (
          <span className="text-[11px] text-gray-400">
            Higher score = better fit for the current weights
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
            <tr>
              {selection && (
                <th className="w-10 px-3 py-2.5">
                  <SelectAllHeader
                    selectedCount={
                      paged.filter((r) =>
                        selection.selectedIds.has(r.row.id)
                      ).length
                    }
                    totalCount={paged.length}
                    onSelectAll={() => {
                      for (const r of paged) {
                        if (!selection.selectedIds.has(r.row.id)) {
                          selection.onToggle(r.row.id);
                        }
                      }
                    }}
                    onClear={() => {
                      for (const r of paged) {
                        if (selection.selectedIds.has(r.row.id)) {
                          selection.onToggle(r.row.id);
                        }
                      }
                    }}
                  />
                </th>
              )}
              <th className="w-12 px-4 py-2.5">#</th>
              <th className="px-4 py-2.5">Creative</th>
              <th className="px-4 py-2.5 text-right">Score</th>
              <th className="px-4 py-2.5 text-right">Spend</th>
              <th className="px-4 py-2.5 text-right">ROAS</th>
              <th className="px-4 py-2.5 text-right">CPA</th>
              <th className="px-4 py-2.5 text-right">Hook</th>
              <th className="px-4 py-2.5 text-right">Hold</th>
              <th className="px-4 py-2.5 text-right">CTR</th>
              <th className="px-4 py-2.5 text-right">CPL</th>
              <th className="px-4 py-2.5 text-right">CPLPV</th>
              <th className="px-4 py-2.5 text-right">CPCMT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={selection ? 13 : 12}
                  className="px-4 py-8 text-center text-xs text-gray-400"
                >
                  Loading…
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td
                  colSpan={selection ? 13 : 12}
                  className="px-4 py-8 text-center text-xs text-gray-400"
                >
                  No creatives match the current filters.
                </td>
              </tr>
            ) : (
              paged.map(({ row, score, rank }) => (
                <Row
                  key={row.id}
                  row={row}
                  score={score}
                  rank={rank}
                  currency={currency}
                  selection={selection}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <PaginationBar
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          currentPage={safePage}
          totalPages={totalPages}
          total={total}
          onPageChange={setCurrentPage}
        />
      )}
    </section>
  );
}

function Row({
  row,
  score,
  rank,
  currency,
  selection,
}: {
  row: MetaCreativePerformanceRow;
  score: number;
  rank: number;
  currency: string;
  selection?: CreativeRankTableSelection;
}) {
  const lowConfidence = row.total_events < LOW_CONFIDENCE_EVENTS_THRESHOLD;
  const isLearning = row.is_in_learning === true;
  const learningUnknown = row.is_in_learning === null;
  const thumb = thumbnailOrFallback(row.thumbnail_url);
  const isVideo = row.object_type === "VIDEO" || !!row.video_id;
  const detailHref = `/meta-ads/creatives/${row.id}`;
  const altText = row.name || row.title || "Creative thumbnail";
  const display = row.title || row.name || row.meta_creative_id;
  const isSelected = selection?.selectedIds.has(row.id) ?? false;

  return (
    <tr
      className={[
        "align-top hover:bg-gray-50/60",
        lowConfidence ? "opacity-50" : "",
        isSelected ? "bg-[#3CCED7]/5" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {selection && (
        <td className="px-3 py-3">
          <input
            type="checkbox"
            aria-label={`Select creative ${display} for export`}
            checked={isSelected}
            onChange={() => selection.onToggle(row.id)}
            className="h-4 w-4 rounded accent-[#3CCED7] focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/30"
          />
        </td>
      )}
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">
        {rank}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-3">
          <Link
            href={detailHref}
            aria-label={`Open creative ${display}`}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 transition-shadow hover:border-[#3CCED7]/60 hover:shadow"
          >
            {thumb ? (
              <img
                src={thumb}
                alt={altText}
                className="h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-300">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
            {isVideo && (
              <span className="pointer-events-none absolute bottom-0 right-0 rounded-tl-md bg-black/70 px-1 py-0.5">
                <Video className="h-2.5 w-2.5 text-white" />
              </span>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                href={detailHref}
                className="truncate text-sm font-medium text-gray-900 hover:text-[#1a9ba3]"
              >
                {display}
              </Link>
              {isLearning && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Learning
                </span>
              )}
            </div>
            {row.body && (
              <p className="mt-1 line-clamp-2 text-sm leading-snug text-gray-700">
                {row.body}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
              {row.call_to_action_type && (
                <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                  {row.call_to_action_type}
                </span>
              )}
              {row.ad_count > 1 && (
                <span className="text-xs text-gray-500">
                  {row.ad_count} ads
                </span>
              )}
              <span className="font-mono">{row.meta_creative_id}</span>
            </div>
          </div>
        </div>
      </td>
      <td
        className="px-4 py-3 text-right font-mono text-sm text-gray-900"
        title={
          lowConfidence
            ? `Low confidence — only ${row.total_events} events in window (need >= ${LOW_CONFIDENCE_EVENTS_THRESHOLD})`
            : learningUnknown
              ? "Learning state unknown — window shorter than 7 days"
              : undefined
        }
      >
        {score.toFixed(4)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-800">
        {formatCurrency(row.spend, currency)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-800">
        {Number(row.roas) > 0 ? `${formatRatio(row.roas)}x` : "—"}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-800">
        {row.purchases > 0 ? formatCurrency(row.cpa, currency) : "—"}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-800">
        {Number(row.hook_rate_strict) > 0
          ? formatPercent(row.hook_rate_strict)
          : "—"}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-800">
        {Number(row.hold_rate) > 0 ? formatPercent(row.hold_rate) : "—"}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-800">
        {Number(row.ctr) > 0 ? formatPercent(row.ctr) : "—"}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-800">
        {row.leads > 0 ? formatCurrency(row.cpl, currency) : "—"}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-800">
        {row.lpv_count > 0 ? formatCurrency(row.cost_per_lpv, currency) : "—"}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs text-gray-800">
        {row.comment_count > 0
          ? formatCurrency(row.cost_per_comment, currency)
          : "—"}
      </td>
    </tr>
  );
}

function PaginationBar({
  pageSize,
  onPageSizeChange,
  currentPage,
  totalPages,
  total,
  onPageChange,
}: {
  pageSize: number;
  onPageSizeChange: (n: number) => void;
  currentPage: number;
  totalPages: number;
  total: number;
  onPageChange: (n: number) => void;
}) {
  const [pageInput, setPageInput] = useState<string>(String(currentPage));
  useEffect(() => setPageInput(String(currentPage)), [currentPage]);

  const goToPage = (n: number) => {
    const clamped = Math.max(1, Math.min(totalPages, Math.floor(n)));
    onPageChange(clamped);
    setPageInput(String(clamped));
  };

  const rangeStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, currentPage * pageSize);

  const btnBase =
    "inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-2.5 text-xs text-gray-600">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Rows per page</span>
        <select
          aria-label="Rows per page"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/30"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="ml-2 text-gray-400">
          {rangeStart}–{rangeEnd} of {total}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={btnBase}
          aria-label="First page"
          disabled={currentPage <= 1}
          onClick={() => goToPage(1)}
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={btnBase}
          aria-label="Previous page"
          disabled={currentPage <= 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-1 px-1 text-gray-500">
          <span>Page</span>
          <input
            type="number"
            aria-label="Page number"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={() => {
              const n = Number(pageInput);
              if (Number.isFinite(n)) goToPage(n);
              else setPageInput(String(currentPage));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = Number((e.target as HTMLInputElement).value);
                if (Number.isFinite(n)) goToPage(n);
              }
            }}
            className="h-7 w-14 rounded-md border border-gray-200 bg-white px-1.5 text-center font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/30"
          />
          <span>of {totalPages}</span>
        </div>
        <button
          type="button"
          className={btnBase}
          aria-label="Next page"
          disabled={currentPage >= totalPages}
          onClick={() => goToPage(currentPage + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={btnBase}
          aria-label="Last page"
          disabled={currentPage >= totalPages}
          onClick={() => goToPage(totalPages)}
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
