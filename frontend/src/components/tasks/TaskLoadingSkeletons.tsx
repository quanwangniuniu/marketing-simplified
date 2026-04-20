"use client";

import Link from "next/link";
import { ChevronRight, Share2, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Layout from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import TasksWorkspaceSkeleton from "@/components/tasks/TasksWorkspaceSkeleton";

const sectionLineWidths = ["w-full", "w-11/12", "w-9/12", "w-10/12", "w-8/12"];
const collectionLineWidths = ["w-40", "w-52", "w-36", "w-44"];
const commentCardWidths = [
  { title: "w-48", body: ["w-full", "w-10/12"] },
  { title: "w-40", body: ["w-11/12", "w-8/12"] },
  { title: "w-44", body: ["w-full", "w-9/12"] },
];

function TaskDetailValueSkeleton({
  kind = "field",
  widthClass = "w-full",
}: {
  kind?: "field" | "pill" | "text";
  widthClass?: string;
}) {
  if (kind === "pill") {
    return <Skeleton className={`h-8 rounded-md ${widthClass}`} />;
  }

  if (kind === "text") {
    return <Skeleton className={`h-4 rounded ${widthClass}`} />;
  }

  return <Skeleton className={`h-12 rounded-md ${widthClass}`} />;
}

function TaskDetailSidebarSkeleton() {
  return (
    <aside className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <button
          type="button"
          disabled
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white opacity-80"
        >
          <Share2 className="h-4 w-4" />
          Share to Chat
        </button>
      </div>

      <section className="w-full border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-[#172b4d]">
            Details
          </span>
          <ChevronRight className="h-4 w-4 rotate-90 text-slate-500" />
        </div>

        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-x-5 gap-y-2">
            <label className="text-[15px] leading-6 text-[#44546f]">Status</label>
            <TaskDetailValueSkeleton widthClass="w-full" />
          </div>

          <div className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-x-5 gap-y-2">
            <label className="text-[15px] leading-6 text-[#44546f]">
              Work type
            </label>
            <TaskDetailValueSkeleton kind="pill" widthClass="w-28" />
          </div>

          <div className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-x-5 gap-y-2">
            <label className="text-[15px] leading-6 text-[#44546f]">Owner</label>
            <TaskDetailValueSkeleton widthClass="w-full" />
          </div>

          <div className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-x-5 gap-y-2">
            <label className="text-[15px] leading-6 text-[#44546f]">
              Current Approver
            </label>
            <TaskDetailValueSkeleton widthClass="w-full" />
          </div>

          <div className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-x-5 gap-y-2">
            <label className="text-[15px] leading-6 text-[#44546f]">
              Project
            </label>
            <TaskDetailValueSkeleton kind="text" widthClass="w-40" />
          </div>

          <div className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-x-5 gap-y-2">
            <label className="text-[15px] leading-6 text-[#44546f]">
              Start Date
            </label>
            <TaskDetailValueSkeleton widthClass="w-full" />
          </div>

          <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-x-5 gap-y-2">
            <label className="pt-2 text-[15px] leading-6 text-[#44546f]">
              Due Date
            </label>
            <div className="space-y-2">
              <TaskDetailValueSkeleton kind="pill" widthClass="w-36" />
              <TaskDetailValueSkeleton widthClass="w-full" />
            </div>
          </div>
        </div>
      </section>

      <section className="w-full border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-[#172b4d]">
            Approval Timeline
          </span>
          <ChevronRight className="h-4 w-4 rotate-90 text-slate-500" />
        </div>
        <div className="mt-5 space-y-4">
          <div className="flex gap-3">
            <Skeleton className="mt-1 h-3 w-3 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-11/12" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="mt-1 h-3 w-3 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
      </section>

      <div>
        <button
          type="button"
          disabled
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white opacity-80"
        >
          Start Review
        </button>
      </div>

      <div>
        <button
          type="button"
          disabled
          className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 opacity-80"
        >
          <Trash2 className="h-4 w-4" />
          Delete Task
        </button>
      </div>
    </aside>
  );
}

export function TaskSectionSkeleton({
  title,
  rows = 4,
}: {
  title: string;
  rows?: number;
}) {
  const rowVariants = Array.from({ length: rows }, (_, index) => ({
    titleWidth: collectionLineWidths[index % collectionLineWidths.length],
    bodyWidths: [
      sectionLineWidths[index % sectionLineWidths.length],
      sectionLineWidths[(index + 2) % sectionLineWidths.length],
    ],
  }));

  return (
    <section className="border-t border-slate-200 pt-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-slate-200" />
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-3">
        {rowVariants.map((variant, index) => (
          <div
            key={`${title}-skeleton-${index}`}
            className="rounded-md border border-slate-200 bg-white px-3 py-3"
          >
            <Skeleton className={`h-4 ${variant.titleWidth}`} />
            <div className="mt-3 space-y-2">
              {variant.bodyWidths.map((widthClass, lineIndex) => (
                <Skeleton
                  key={`${title}-line-${index}-${lineIndex}`}
                  className={`h-4 ${widthClass}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TaskCollectionSkeleton({
  title,
  rows = 3,
}: {
  title: string;
  rows?: number;
}) {
  const itemVariants = Array.from({ length: rows }, (_, index) => ({
    titleWidth: collectionLineWidths[index % collectionLineWidths.length],
    metaWidth: ["w-24", "w-28", "w-20", "w-32"][index % 4],
  }));

  return (
    <section className="border-t border-slate-200 pt-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-slate-200" />
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
        {itemVariants.map((variant, index) => (
          <div
            key={`${title}-item-${index}`}
            className="flex items-center justify-between px-3 py-3"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={`h-4 ${variant.titleWidth}`} />
              <Skeleton className={`h-4 ${variant.metaWidth}`} />
            </div>
            <Skeleton className="ml-4 h-8 w-8 rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function TasksPageLoadingSkeleton() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project_id");
  const view = searchParams.get("view");
  const mode =
    view === "board" ? "board" : view === "summary" ? "summary" : "tasks";
  const projectPickerRows = [
    { name: "w-44", detail: "w-56", key: "w-10", lead: "w-15", status: "w-14" },
    { name: "w-52", detail: "w-48", key: "w-10", lead: "w-15", status: "w-14" },
    { name: "w-36", detail: "w-60", key: "w-10", lead: "w-15", status: "w-14" },
    { name: "w-48", detail: "w-52", key: "w-10", lead: "w-15", status: "w-14" },
    { name: "w-40", detail: "w-44", key: "w-10", lead: "w-15", status: "w-14" },
    { name: "w-56", detail: "w-64", key: "w-10", lead: "w-15", status: "w-14" },
  ];

  return (
    <Layout mainScrollMode="page">
      {projectId ? (
        <div className="min-h-full bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <div className="flex flex-row gap-4 items-center mb-4">
                <Skeleton className="h-9 w-64" />
                {mode !== "board" ? (
                  <button
                    type="button"
                    disabled
                    className="px-3 py-1.5 rounded text-white bg-indigo-600 opacity-70"
                  >
                    Create Task
                  </button>
                ) : null}
              </div>

              <div className="mb-4 border-b border-gray-200">
                <nav className="flex space-x-8">
                  {["Summary", "Tasks", "Board"].map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      disabled
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        index === 0
                          ? "border-indigo-600 text-indigo-600"
                          : "border-transparent text-gray-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-gray-900">
                      Project selected
                    </div>
                    <p className="text-sm text-gray-600">
                      Switch projects to see a different task workspace.
                    </p>
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                      Current project:
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>
                  <div className="w-full sm:max-w-xs">
                    <button
                      type="button"
                      disabled
                      className="flex w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm opacity-70"
                    >
                      Switch project
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <TasksWorkspaceSkeleton mode={mode as "summary" | "board" | "tasks"} />
          </div>
        </div>
      ) : (
        <div className="min-h-full bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <div className="mx-auto max-w-5xl">
                <h2 className="text-xl font-semibold text-gray-900">
                  Select project
                </h2>
                <div className="mt-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by project name or ID..."
                      disabled
                      className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-3 hidden grid-cols-[24px,minmax(0,2fr),minmax(0,1fr),minmax(0,1fr),minmax(0,0.9fr)] items-center gap-3 border-b border-gray-200 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 sm:grid">
                    <span />
                    <span>Name</span>
                    <span>Key</span>
                    <span>Lead</span>
                    <span>Status</span>
                  </div>
                  {projectPickerRows.map((row, index) => (
                    <div
                      key={`project-picker-skeleton-${index}`}
                      className="w-full border-b border-gray-200 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[24px,minmax(0,2fr),minmax(0,1fr),minmax(0,1fr),minmax(0,0.9fr)] sm:items-center sm:gap-3">
                        <Skeleton className="h-6 w-6 rounded-md" />
                        <div className="min-w-0 space-y-2">
                          <Skeleton className={`h-4 ${row.name}`} />
                          <Skeleton className={`h-4 ${row.detail}`} />
                        </div>
                        <Skeleton className={`h-4 ${row.key}`} />
                        <Skeleton className={`h-4 ${row.lead}`} />
                        <Skeleton className={`h-6 rounded-full ${row.status}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export function TaskDetailContentSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1680px] px-2 py-8 sm:px-3 lg:px-4">
        <div className="mb-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Link href="/tasks" className="hover:text-slate-700">
              Tasks
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Skeleton className="h-4 w-24" />
            <ChevronRight className="h-3.5 w-3.5" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/tasks" className="text-sm font-medium text-indigo-600">
                Back to Tasks
              </Link>
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 px-5 py-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <div className="space-y-3">
                <Skeleton className="h-8 w-2/3" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-28 rounded-full" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <Skeleton className="h-4 w-28" />
                  <div className="mt-4 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <Skeleton className="h-4 w-24" />
                  <div className="mt-4 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <Skeleton className="h-5 w-36" />
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>

              <TaskSectionSkeleton title="Task-specific details" rows={4} />
              <TaskCollectionSkeleton title="Attachments" rows={3} />
              <TaskCollectionSkeleton title="Subtasks" rows={3} />
              <TaskCollectionSkeleton title="Linked work items" rows={3} />

              <section className="border-t border-slate-200 pt-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-slate-200" />
                  <h3 className="text-base font-semibold text-slate-900">
                    Comments
                  </h3>
                </div>
                <div className="space-y-3">
                  {commentCardWidths.map((variant, index) => (
                    <div
                      key={`comment-skeleton-${index}`}
                      className="rounded-md border border-slate-200 bg-white px-3 py-3"
                    >
                      <Skeleton className={`h-4 ${variant.title}`} />
                      <div className="mt-3 space-y-2">
                        {variant.body.map((widthClass, lineIndex) => (
                          <Skeleton
                            key={`comment-line-${index}-${lineIndex}`}
                            className={`h-4 ${widthClass}`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <TaskDetailSidebarSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaskDetailPageSkeleton() {
  return (
    <Layout mainScrollMode="page">
      <TaskDetailContentSkeleton />
    </Layout>
  );
}
