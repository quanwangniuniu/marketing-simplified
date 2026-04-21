"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { WorkflowSummary } from "@/lib/api/workflowApi";
import WorkflowStatusBadge from "./WorkflowStatusBadge";
import {
  ArrowRight,
  Copy,
  Edit2,
  LayoutGrid,
  List as ListIcon,
  Trash2,
} from "lucide-react";

export type WorkflowViewMode = "table" | "grid";

interface WorkflowViewsProps {
  workflows: WorkflowSummary[];
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  total: number;
  viewMode: WorkflowViewMode;
  onViewModeChange: (mode: WorkflowViewMode) => void;
  onPageChange: (page: number) => void;
  onEdit: (workflow: WorkflowSummary) => void;
  onDuplicate: (workflow: WorkflowSummary) => void;
  onDelete: (workflow: WorkflowSummary) => void;
}

const EMPTY_COLUMNS =
  "grid place-items-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-600";

export function WorkflowViews({
  workflows,
  loading,
  error,
  page,
  pageSize,
  total,
  viewMode,
  onViewModeChange,
  onPageChange,
  onEdit,
  onDuplicate,
  onDelete,
}: WorkflowViewsProps) {
  const router = useRouter();

  const totalPages = useMemo(() => {
    if (!pageSize) return 1;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [total, pageSize]);

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 text-sm text-gray-600">
        <div>
          Page <span className="font-semibold">{page}</span> of{" "}
          <span className="font-semibold">{totalPages}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (loading) {
      return (
        <div className={EMPTY_COLUMNS}>
          <p className="font-medium text-gray-900">Loading workflows…</p>
          <p className="mt-1 text-sm text-gray-500">
            Fetching workflow list from the backend.
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div className={EMPTY_COLUMNS}>
          <p className="font-semibold text-red-600">Failed to load workflows</p>
          <p className="mt-1 text-sm text-red-500">{error}</p>
        </div>
      );
    }

    if (!workflows.length) {
      return (
        <div className={EMPTY_COLUMNS}>
          <p className="mt-3 font-semibold text-gray-900">
            No workflows to show
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Create your first workflow or adjust filters/search.
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Workflow
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Version
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {workflows.map((workflow) => (
              <tr
                key={workflow.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() =>
                  router.push(`/workflows/${workflow.id}/edit`)
                }
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {workflow.name}
                </td>
                <td className="px-4 py-3 text-sm">
                  <WorkflowStatusBadge status={workflow.status} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {workflow.description || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  v{workflow.version}
                </td>
                <td
                  className="px-4 py-3 text-right text-sm text-gray-600"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => onEdit(workflow)}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[#1a9ba3] hover:bg-[#3CCED7]/10"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit workflow
                    </button>
                    <button
                      onClick={() => onDuplicate(workflow)}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                    <button
                      onClick={() => onDelete(workflow)}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove workflow
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 pb-4">{renderPagination()}</div>
      </div>
    );
  };

  const renderGrid = () => {
    if (loading || error || !workflows.length) {
      return renderTable();
    }

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workflows.map((workflow) => (
          <div
            key={workflow.id}
            className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-[#3CCED7]/30 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {workflow.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                  {workflow.description || "No description provided."}
                </p>
              </div>
              <WorkflowStatusBadge status={workflow.status} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Version {workflow.version}</span>
              <button
                onClick={() => onEdit(workflow)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[#1a9ba3] hover:bg-[#3CCED7]/10"
              >
                Edit workflow
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
              <button
                onClick={() => onDuplicate(workflow)}
                className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 font-medium hover:bg-gray-100"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
              <button
                onClick={() => onDelete(workflow)}
                className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 font-medium text-red-700 hover:bg-red-100"
              >
                <Trash2 className="h-3 w-3" />
                Remove workflow
              </button>
            </div>
          </div>
        ))}
        <div className="sm:col-span-2 lg:col-span-3">{renderPagination()}</div>
      </div>
    );
  };

  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center justify-end gap-2 text-xs text-gray-600">
        <span className="hidden sm:inline">View</span>
        <button
          onClick={() => onViewModeChange("table")}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${
            viewMode === "table"
              ? "bg-slate-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <ListIcon className="h-3.5 w-3.5" />
          Table
        </button>
        <button
          onClick={() => onViewModeChange("grid")}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${
            viewMode === "grid"
              ? "bg-slate-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Grid
        </button>
      </div>
      {viewMode === "table" ? renderTable() : renderGrid()}
    </div>
  );
}

export default WorkflowViews;
