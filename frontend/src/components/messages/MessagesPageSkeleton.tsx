"use client";

import { FolderOpen, MessageSquare, Search } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/skeleton";

const projectRailWidths = ["w-full", "w-full", "w-full", "w-full"];
const starredRows = [
  { title: "w-32", meta: "w-20" },
  { title: "w-28", meta: "w-24" },
  { title: "w-36", meta: "w-16" },
];
const chatBubbleWidths = [
  ["w-48", "w-32"],
  ["w-44", "w-28"],
  ["w-52", "w-36"],
];

export function MessagesSidebarSkeleton() {
  return (
    <div className="pb-2">
      <div className="mt-3 px-3 flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
        <span className="flex-1 min-w-0">Starred</span>
      </div>
      <div className="mt-2 divide-y divide-gray-100 border border-dashed border-gray-200 rounded-lg overflow-hidden mx-1">
        {starredRows.map((row, index) => (
          <div
            key={`messages-sidebar-skeleton-${index}`}
            className="w-full px-3 py-2 flex items-center gap-2"
          >
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={`h-4 ${row.title}`} />
              <Skeleton className={`h-4 ${row.meta}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 px-3 flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
        <span className="flex-1 min-w-0">Channels</span>
      </div>
      <div className="mt-2 space-y-2 mx-1">
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    </div>
  );
}

export function MessagesChatPanelSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="border-b border-gray-200 px-5 py-4 bg-white">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
      <div className="flex-1 p-6 space-y-4 bg-gray-50">
        {chatBubbleWidths.map((bubble, index) => (
          <div
            key={`chat-bubble-${index}`}
            className={`flex ${index === 1 ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-3 border ${
                index === 1
                  ? "bg-blue-50 border-blue-100"
                  : "bg-white border-gray-200"
              }`}
            >
              <Skeleton className={`h-4 ${bubble[0]}`} />
              <Skeleton className={`mt-2 h-4 ${bubble[1]}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 px-5 py-4 bg-white">
        <div className="rounded-xl border border-gray-200 px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function MessagesPageSkeleton() {
  return (
    <Layout user={{ name: "", email: "" }} showHeader={true} showSidebar={true}>
      <div className="h-full flex flex-col bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>
          <div className="mt-4 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              disabled
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="h-full flex overflow-hidden bg-white">
            <div className="h-full border-r border-gray-200 flex">
              <div className="w-14 sm:w-16 h-full flex flex-col items-center gap-2 py-3 bg-gray-50">
                <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div className="flex-1 overflow-y-auto w-full px-2 space-y-2">
                  {projectRailWidths.map((widthClass, index) => (
                    <Skeleton
                      key={`project-rail-skeleton-${index}`}
                      className={`h-10 rounded-lg ${widthClass}`}
                    />
                  ))}
                </div>
              </div>
              <nav className="w-14 sm:w-[4.5rem] h-full flex flex-col items-stretch gap-1 py-3 px-1.5 border-r border-gray-200 bg-gray-50/80">
                {["Home", "DMs", "Activity", "Files"].map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    disabled
                    className={[
                      "flex flex-col items-center gap-0.5 rounded-lg py-2 px-1 text-[10px] font-medium border",
                      index === 0
                        ? "bg-white text-blue-700 shadow-sm border-blue-200"
                        : "text-gray-600 border-transparent",
                    ].join(" ")}
                  >
                    <span className="leading-tight text-center">{label}</span>
                  </button>
                ))}
              </nav>
              <div className="w-[320px] max-w-[40vw] border-r border-gray-200 overflow-hidden bg-white">
                <MessagesSidebarSkeleton />
              </div>
            </div>
            <MessagesChatPanelSkeleton />
          </div>
        </div>
      </div>
    </Layout>
  );
}
