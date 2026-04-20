import React from "react";
import {
  JiraBoardColumn,
  JiraBoardColumns,
} from "@/components/jira-ticket/JiraBoard";
import { Skeleton } from "@/components/ui/skeleton";

type TasksWorkspaceSkeletonProps = {
  mode?: "summary" | "board" | "tasks";
};

const boardCardVariants = [
  { title: ["w-11/12", "w-7/12"], chip: "w-24", meta: "w-20" },
  { title: ["w-10/12", "w-6/12"], chip: "w-20", meta: "w-24" },
  { title: ["w-9/12", "w-8/12"], chip: "w-28", meta: "w-16" },
];

const taskListVariants = [
  { title: "w-44", meta: "w-28" },
  { title: "w-36", meta: "w-24" },
  { title: "w-48", meta: "w-20" },
  { title: "w-40", meta: "w-32" },
  { title: "w-52", meta: "w-24" },
  { title: "w-[8.5rem]", meta: "w-20" },
  { title: "w-[11.5rem]", meta: "w-28" },
];

const PulseBlock = ({ className }: { className: string }) => (
  <Skeleton className={className} />
);

function SummaryDonutSkeleton() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-6">
      <div className="relative h-36 w-36">
        <div className="absolute inset-0 rounded-full border-[14px] border-slate-200" />
        <div className="absolute inset-3 rounded-full border-[10px] border-slate-100 border-t-slate-300 border-r-slate-300" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Skeleton className="h-6 w-12 rounded" />
          <Skeleton className="mt-2 h-4 w-20 rounded" />
        </div>
      </div>
      <div className="space-y-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    </div>
  );
}

export default function TasksWorkspaceSkeleton({
  mode = "tasks",
}: TasksWorkspaceSkeletonProps) {
  if (mode === "summary") {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            { label: "w-28", value: "w-36", subtitle: "w-20" },
            { label: "w-24", value: "w-32", subtitle: "w-24" },
            { label: "w-32", value: "w-28", subtitle: "w-16" },
            { label: "w-20", value: "w-[7.5rem]", subtitle: "w-24" },
          ].map((card, index) => (
            <div
              key={`summary-card-${index}`}
              className="rounded-md border border-slate-200 bg-white px-4 py-3"
            >
              <PulseBlock className={`h-4 ${card.label}`} />
              <PulseBlock className={`mt-3 h-4 ${card.value}`} />
              <PulseBlock className={`mt-3 h-4 ${card.subtitle}`} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-slate-800">
                  Work type overview
                </div>
                <div className="text-xs text-slate-500">
                  Get a snapshot of the work types in your items.
                </div>
              </div>
              <button
                type="button"
                disabled
                className="text-xs font-semibold text-blue-600 opacity-80"
              >
                View all work items
              </button>
            </div>
            <SummaryDonutSkeleton />
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-slate-800">
                  Types of work
                </div>
                <div className="text-xs text-slate-500">
                  Get a breakdown of work items by their types.
                </div>
              </div>
              <button
                type="button"
                disabled
                className="text-xs font-semibold text-blue-600 opacity-80"
              >
                View all items
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { label: "w-16", bar: "w-[72%]", pct: "w-10" },
                { label: "w-20", bar: "w-[58%]", pct: "w-8" },
                { label: "w-24", bar: "w-[36%]", pct: "w-9" },
                { label: "w-14", bar: "w-[24%]", pct: "w-8" },
              ].map((row, index) => (
                <div
                  key={`work-type-row-${index}`}
                  className="grid grid-cols-[90px_1fr] gap-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />
                    <Skeleton className={`h-4 ${row.label}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative h-3 w-full rounded-full bg-slate-200">
                      <div
                        className={`absolute left-0 top-0 h-3 rounded-full bg-slate-300 ${row.bar}`}
                      />
                    </div>
                    <Skeleton className={`h-4 ${row.pct}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "board") {
    return (
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <PulseBlock className="h-9 w-[280px] rounded-lg md:w-[340px]" />
            <div className="flex items-center gap-2">
              <PulseBlock className="h-8 w-8 rounded-full" />
              <PulseBlock className="h-8 w-28 rounded-md" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PulseBlock className="h-9 w-24 rounded-md" />
          </div>
        </div>
        <JiraBoardColumns>
          {["Todo", "In Progress", "Review", "Done"].map((title, colIndex) => (
            <JiraBoardColumn
              key={`board-skeleton-col-${title}`}
              title={title}
              footer={<PulseBlock className="h-8 w-24 rounded-md" />}
            >
              {boardCardVariants.map((variant, cardIndex) => (
                <div
                  key={`board-skeleton-card-${colIndex}-${cardIndex}`}
                  className="min-h-[132px] shrink-0 rounded-md border border-slate-200 bg-white px-3 py-3"
                >
                  <div className="space-y-2">
                    <PulseBlock className={`h-4 ${variant.title[0]}`} />
                    <PulseBlock className={`h-4 ${variant.title[1]}`} />
                  </div>
                  <div className="mt-3">
                    <PulseBlock className={`h-6 rounded ${variant.chip}`} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <PulseBlock className={`h-4 ${variant.meta}`} />
                    <PulseBlock className="h-7 w-7 rounded-full" />
                  </div>
                </div>
              ))}
            </JiraBoardColumn>
          ))}
          <div className="flex min-h-[420px] w-14 flex-shrink-0 items-start justify-center bg-[#f7f8f9] pt-3 text-slate-600">
            <PulseBlock className="h-9 w-9 rounded-md border border-slate-200 bg-white" />
          </div>
        </JiraBoardColumns>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] px-6 py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <PulseBlock className="h-9 w-[300px] rounded-lg" />
          <PulseBlock className="h-9 w-28 rounded-md" />
          <PulseBlock className="h-9 w-32 rounded-md" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-800">Items</div>
            <div className="mt-3 space-y-2">
              {taskListVariants.map((item, index) => (
                <div
                  key={`task-list-skeleton-${index}`}
                  className="rounded-md border border-slate-200 px-3 py-3"
                >
                  <Skeleton className={`h-4 ${item.title}`} />
                  <Skeleton className={`mt-2 h-4 ${item.meta}`} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">
                Task Details
              </div>
              <button
                type="button"
                disabled
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 opacity-80"
              >
                Edit
              </button>
            </div>
            <Skeleton className="mt-4 h-8 w-2/3" />
            <div className="mt-6 rounded-xl border border-slate-200 p-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-8/12" />
              </div>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-4 w-36" />
                <Skeleton className="mt-2 h-4 w-28" />
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-3 h-4 w-32" />
                <Skeleton className="mt-2 h-4 w-24" />
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-slate-200 p-4">
              <Skeleton className="h-4 w-24" />
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-10/12" />
                <Skeleton className="h-4 w-7/12" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
