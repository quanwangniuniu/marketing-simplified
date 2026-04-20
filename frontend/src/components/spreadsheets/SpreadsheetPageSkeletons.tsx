"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, FileSpreadsheet, Plus, Search } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/skeleton";

const spreadsheetRows = [
  { name: "w-40", updated: "w-28" },
  { name: "w-56", updated: "w-32" },
  { name: "w-44", updated: "w-24" },
  { name: "w-52", updated: "w-[7.5rem]" },
  { name: "w-36", updated: "w-28" },
  { name: "w-48", updated: "w-32" },
];

const timelineCardVariants = [
  {
    title: "Grouped Operation",
    subTitleWidth: "w-20",
    group: true,
    items: [
      { title: "w-40", time: "w-16", right: "w-24" },
      { title: "w-32", time: "w-16", right: "w-24" },
    ],
  },
  {
    title: null,
    subTitleWidth: "w-16",
    group: false,
    items: [{ title: "w-44", time: "w-16", right: "w-24" }],
  },
  {
    title: null,
    subTitleWidth: "w-14",
    group: false,
    items: [{ title: "w-36", time: "w-16", right: "w-24" }],
  },
];

function SpreadsheetTableSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Updated
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {spreadsheetRows.map((row, index) => (
              <tr key={`spreadsheet-row-${index}`} className="border-b border-gray-200">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700 flex-shrink-0">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Skeleton className={`h-4 ${row.name}`} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Skeleton className={`h-4 ${row.updated}`} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end">
                    <Skeleton className="h-9 w-20 rounded-lg" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PatternAgentPanelSkeleton() {
  return (
    <div className="hidden xl:flex w-[360px] border-l border-gray-200 bg-white flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 p-3">
        <div className="text-sm font-semibold text-gray-900">Pattern Agent</div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            disabled
            className="rounded bg-blue-600 px-2 py-1 text-white opacity-90"
          >
            Timeline
          </button>
          <button
            type="button"
            disabled
            className="rounded bg-gray-100 px-2 py-1 text-gray-600"
          >
            Patterns
          </button>
        </div>
        <button
          type="button"
          disabled
          className="rounded-lg p-1.5 text-gray-600"
          aria-label="Collapse panel"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between text-xs">
          <Skeleton className="h-4 w-20" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              className="rounded border border-gray-200 px-2 py-1 font-semibold text-gray-700"
            >
              Select all
            </button>
            <button
              type="button"
              disabled
              className="rounded border border-blue-200 bg-blue-50 px-2 py-1 font-semibold text-blue-700 opacity-70"
            >
              Merge
            </button>
            <button
              type="button"
              disabled
              className="rounded border border-gray-200 px-2 py-1 font-semibold text-gray-700"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {timelineCardVariants.map((card, index) => (
            <div
              key={`pattern-card-${index}`}
              className={`rounded-xl border p-3 shadow-sm ${
                card.group
                  ? "border-blue-200 bg-blue-50/50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="pt-1 text-gray-400">
                  <div className="grid grid-cols-2 gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {card.title ? (
                        <div className="text-sm font-semibold text-gray-900">
                          {card.title}
                        </div>
                      ) : (
                        <Skeleton className={`h-4 ${card.items[0].title}`} />
                      )}
                      <Skeleton className={`mt-2 h-4 ${card.subTitleWidth}`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded" />
                      <Skeleton className="h-5 w-5 rounded" />
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    {card.items.map((item, itemIndex) => (
                      <div
                        key={`pattern-inner-${index}-${itemIndex}`}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className={`h-4 ${item.title}`} />
                            <Skeleton className={`h-4 ${item.time}`} />
                          </div>
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-5 w-5 rounded" />
                            <Skeleton className={`h-4 ${item.right}`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 p-4">
        <button
          type="button"
          disabled
          className="w-full rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white opacity-90"
        >
          Export Pattern
        </button>
      </div>
    </div>
  );
}

export function SpreadsheetsListPageSkeleton() {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="mx-auto max-w-6xl w-full px-4 py-6 flex flex-col flex-1">
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex items-center gap-3">
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 text-sm text-gray-600"
                aria-disabled="true"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Projects
              </Link>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
              <div>
                <Skeleton className="h-8 w-56" />
                <div className="mt-1 flex items-center gap-2 text-sm uppercase tracking-wide text-blue-700">
                  <div className="h-6 w-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  Spreadsheets
                </div>
              </div>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-white bg-indigo-600 text-sm font-semibold opacity-70 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Create Spreadsheet
              </button>
            </div>
          </div>

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search spreadsheets..."
                disabled
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-900 disabled:bg-white"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <SpreadsheetTableSkeleton />
          </div>
        </div>
      </div>
    </Layout>
  );
}

export function SpreadsheetDetailPageSkeleton() {
  const sheetTabWidths = ["w-16", "w-20", "w-[4.5rem]"];
  const columnHeaders = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const rowWidths = [
    ["w-full", "w-11/12", "w-10/12", "w-9/12", "w-full", "w-8/12", "w-10/12", "w-7/12"],
    ["w-9/12", "w-full", "w-8/12", "w-11/12", "w-10/12", "w-full", "w-9/12", "w-8/12"],
    ["w-8/12", "w-9/12", "w-full", "w-10/12", "w-7/12", "w-11/12", "w-full", "w-9/12"],
    ["w-full", "w-10/12", "w-9/12", "w-full", "w-8/12", "w-9/12", "w-11/12", "w-10/12"],
    ["w-10/12", "w-8/12", "w-full", "w-11/12", "w-9/12", "w-10/12", "w-full", "w-8/12"],
    ["w-9/12", "w-full", "w-10/12", "w-8/12", "w-11/12", "w-full", "w-9/12", "w-10/12"],
  ];

  return (
    <Layout mainScrollMode="container">
      <div className="h-full min-h-0 overflow-hidden bg-white flex flex-col">
        <div className="border-b border-gray-200 bg-white">
          <div className="max-w-7xl px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="#"
                  className="inline-flex items-center gap-2 text-sm text-gray-600"
                  aria-disabled="true"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-green-50 text-green-700">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <Skeleton className="h-7 w-64" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200 bg-white">
          <div className="max-w-7xl">
            <div className="flex items-center gap-2 overflow-x-auto px-1 py-1">
              {sheetTabWidths.map((widthClass, index) => (
                <div
                  key={`sheet-tab-skeleton-${index}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap"
                >
                  <Skeleton className={`h-4 ${widthClass}`} />
                </div>
              ))}
              <button
                type="button"
                disabled
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 rounded opacity-70"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Sheet</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden bg-gray-50 flex flex-col">
          <div className="flex-1 min-h-0 min-w-0 flex h-full overflow-hidden">
            <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col p-4">
              <div className="flex-1 rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="grid grid-cols-[48px_repeat(8,minmax(0,1fr))] gap-0 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-medium text-gray-500">
                  <span />
                  {columnHeaders.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <div className="space-y-0 p-4">
                  {rowWidths.map((cells, rowIndex) => (
                    <div
                      key={`grid-row-${rowIndex}`}
                      className="grid grid-cols-[48px_repeat(8,minmax(0,1fr))] gap-3 border-b border-gray-100 py-2 last:border-b-0"
                    >
                      <span className="pt-2 text-xs text-gray-400">
                        {rowIndex + 1}
                      </span>
                      {cells.map((widthClass, colIndex) => (
                        <div
                          key={`grid-cell-${rowIndex}-${colIndex}`}
                          className="flex items-center rounded-md border border-gray-100 px-2 py-2"
                        >
                          <Skeleton className={`h-4 ${widthClass}`} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <PatternAgentPanelSkeleton />
          </div>
        </div>
      </div>
    </Layout>
  );
}
