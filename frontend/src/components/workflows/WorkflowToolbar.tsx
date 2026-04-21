"use client";

import { WorkflowStatus } from "@/lib/api/workflowApi";
import { Loader2, Plus, RefreshCw, Search } from "lucide-react";

interface WorkflowToolbarProps {
  search: string;
  status: WorkflowStatus | "all";
  onSearchChange: (value: string) => void;
  onStatusChange: (value: WorkflowStatus | "all") => void;
  onRefresh: () => void;
  onCreate: () => void;
  loading: boolean;
}

const STATUS_OPTIONS: { value: WorkflowStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function WorkflowToolbar({
  search,
  status,
  onSearchChange,
  onStatusChange,
  onRefresh,
  onCreate,
  loading,
}: WorkflowToolbarProps) {
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search workflows by name or description"
            className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Status</label>
          <select
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as WorkflowStatus | "all")
            }
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? "animate-spin text-[#3CCED7]" : "text-gray-400"
            }`}
          />
          Refresh
        </button>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          {loading ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              Adding…
            </span>
          ) : (
            "Add Workflow"
          )}
        </button>
      </div>
    </div>
  );
}

export default WorkflowToolbar;
