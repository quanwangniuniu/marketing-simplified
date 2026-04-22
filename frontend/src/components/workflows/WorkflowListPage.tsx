"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Layout from "@/components/layout/Layout";
import { WorkflowAPI, WorkflowSummary } from "@/lib/api/workflowApi";
import WorkflowToolbar from "./WorkflowToolbar";
import WorkflowViews, { WorkflowViewMode } from "./WorkflowViews";
import type { WorkflowStatus } from "@/lib/api/workflowApi";
import { AlertCircle, GitBranch, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import toast from "react-hot-toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

const DEFAULT_PAGE_SIZE = 10;

export default function WorkflowListPage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<WorkflowStatus | "all">("all");
  const [viewMode, setViewMode] = useState<WorkflowViewMode>("table");
  const [page, setPage] = useState(1);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowStatus, setNewWorkflowStatus] =
    useState<WorkflowStatus>("draft");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [workflowPendingDelete, setWorkflowPendingDelete] =
    useState<WorkflowSummary | null>(null);

  const pageSize = DEFAULT_PAGE_SIZE;

  const fetchWorkflows = useCallback(
    async (opts?: { resetPage?: boolean }) => {
      setLoading(true);
      try {
        const params: any = {
          search: search || undefined,
          status: status === "all" ? undefined : status,
          ordering: "-created_at",
        };
        const data = await WorkflowAPI.list(params);
        setWorkflows(data.results);
        setError(null);
        if (opts?.resetPage !== false) {
          setPage(1);
        }
      } catch (err: any) {
        const message =
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to load workflows.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [search, status]
  );

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handlePageChange = async (nextPage: number) => {
    setPage(nextPage);
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflowName.trim()) {
      toast.error("Please enter a workflow name.");
      return;
    }
    setCreating(true);
    try {
      await WorkflowAPI.create({
        name: newWorkflowName.trim(),
        status: newWorkflowStatus,
      });
      toast.success("Workflow created.");
      setCreateModalOpen(false);
      await fetchWorkflows();
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to create workflow.";
      setError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleEditWorkflow = (workflow: WorkflowSummary) => {
    window.location.href = `/workflows/${workflow.id}`;
  };

  const handleDuplicateWorkflow = async (workflow: WorkflowSummary) => {
    const confirmed = window.confirm(
      `Create a copy of workflow "${workflow.name}"?`
    );
    if (!confirmed) return;
    setLoading(true);
    try {
      await WorkflowAPI.duplicate(workflow.id);
      await fetchWorkflows({ resetPage: false });
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to duplicate workflow.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorkflow = async (workflow: WorkflowSummary) => {
    setWorkflowPendingDelete(workflow);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteWorkflow = async () => {
    if (!workflowPendingDelete) return;
    setLoading(true);
    try {
      await WorkflowAPI.delete(workflowPendingDelete.id);
      await fetchWorkflows({ resetPage: false });
      toast.success("Workflow deleted.");
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to delete workflow.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
    setWorkflowPendingDelete(null);
    setDeleteConfirmOpen(false);
  };

  const headerTotals = useMemo(
    () => ({
      total: workflows.length,
    }),
    [workflows.length]
  );

  const paginatedWorkflows = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return workflows.slice(start, end);
  }, [workflows, page, pageSize]);

  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gray-50">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 text-sm uppercase tracking-wide text-[#1a9ba3]">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#3CCED7]/15 text-[#1a9ba3]">
                  <GitBranch className="h-4 w-4" />
                </div>
                Workflows
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <h1 className="text-3xl font-bold text-gray-900">
                    Workflows
                  </h1>
                  <p className="text-gray-600">
                    Manage reusable workflows for your projects, similar to the
                    Jira workflow list.
                  </p>
                </div>
                <div className="flex gap-2 text-sm text-gray-600">
                  <div className="rounded-lg bg-white px-4 py-2 shadow-sm ring-1 ring-gray-200">
                    <span className="text-xs uppercase text-gray-500">
                      Total
                    </span>
                    <div className="text-base font-semibold text-gray-900">
                      {headerTotals.total}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <ConfirmModal
              isOpen={deleteConfirmOpen}
              onClose={() => {
                if (!loading) {
                  setDeleteConfirmOpen(false);
                  setWorkflowPendingDelete(null);
                }
              }}
              onConfirm={confirmDeleteWorkflow}
              title="Delete workflow"
              message={
                workflowPendingDelete
                  ? `Are you sure you want to delete workflow "${workflowPendingDelete.name}"?`
                  : "Are you sure you want to delete this workflow?"
              }
              confirmText="Delete"
              cancelText="Cancel"
              type="danger"
              loading={loading}
            />

            <Modal
              isOpen={createModalOpen}
              onClose={() => {
                if (!creating) {
                  setCreateModalOpen(false);
                }
              }}
            >
              <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Add Workflow
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Create a new workflow by specifying a name and status.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => !creating && setCreateModalOpen(false)}
                    className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Workflow name
                    </label>
                    <input
                      type="text"
                      value={newWorkflowName}
                      onChange={(e) => setNewWorkflowName(e.target.value)}
                      placeholder="e.g. Budget approval flow"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#3CCED7] focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Status
                    </label>
                    <select
                      value={newWorkflowStatus}
                      onChange={(e) =>
                        setNewWorkflowStatus(
                          e.target.value as WorkflowStatus
                        )
                      }
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#3CCED7] focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => !creating && setCreateModalOpen(false)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateWorkflow}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={creating}
                  >
                    {creating && (
                      <span className="inline-flex items-center">
                        <span className="mr-1 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      </span>
                    )}
                    Add Workflow
                  </button>
                </div>
              </div>
            </Modal>

            <WorkflowToolbar
              search={search}
              status={status}
              onSearchChange={(value) => {
                setSearch(value);
              }}
              onStatusChange={(value) => {
                setStatus(value);
              }}
              onRefresh={() => fetchWorkflows({ resetPage: false })}
              onCreate={() => {
                setNewWorkflowName("");
                setNewWorkflowStatus("draft");
                setCreateModalOpen(true);
              }}
              loading={creating}
            />

            <WorkflowViews
              workflows={paginatedWorkflows}
              loading={loading}
              error={error}
              page={page}
              pageSize={pageSize}
              total={workflows.length}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onPageChange={handlePageChange}
              onEdit={handleEditWorkflow}
              onDuplicate={handleDuplicateWorkflow}
              onDelete={handleDeleteWorkflow}
            />
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
