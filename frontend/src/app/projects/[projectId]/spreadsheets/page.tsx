'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SpreadsheetAPI } from '@/lib/api/spreadsheetApi';
import { ProjectAPI, ProjectData } from '@/lib/api/projectApi';
import { SpreadsheetData } from '@/types/spreadsheet';
import { AlertCircle, ArrowLeft, FileSpreadsheet, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/skeleton';
import toast from 'react-hot-toast';
import { useMinimumLoading } from '@/hooks/useMinimumLoading';

const UNTITLED_BASE = 'Untitled spreadsheet';
const spreadsheetLoadingRows = [
  { name: 'w-40', updated: 'w-28' },
  { name: 'w-56', updated: 'w-32' },
  { name: 'w-44', updated: 'w-24' },
  { name: 'w-52', updated: 'w-[7.5rem]' },
  { name: 'w-36', updated: 'w-28' },
  { name: 'w-48', updated: 'w-32' },
];

function nextUntitledSpreadsheetName(existing: string[]): string {
  if (!existing.includes(UNTITLED_BASE)) return UNTITLED_BASE;
  let n = 2;
  while (existing.includes(`${UNTITLED_BASE} (${n})`)) n += 1;
  return `${UNTITLED_BASE} (${n})`;
}

const PAGE_SIZE = 10;

export default function SpreadsheetsListPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetData[]>([]);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirmSpreadsheet, setDeleteConfirmSpreadsheet] = useState<{ id: number; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const delayedLoading = useMinimumLoading(loading);

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return;
      try {
        const projects = await ProjectAPI.getProjects();
        const currentProject = projects.find((p) => p.id === Number(projectId));
        setProject(currentProject || null);
      } catch (err) {
        console.error('Failed to load project:', err);
      }
    };
    void loadProject();
  }, [projectId]);

  const loadSpreadsheets = useCallback(async () => {
    if (!projectId) {
      setError('Project ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await SpreadsheetAPI.listSpreadsheets(Number(projectId), {
        page,
        page_size: PAGE_SIZE,
        search: searchQuery.trim() || undefined,
        order_by: 'updated_at',
      });
      setSpreadsheets(response.results || []);
      setTotalCount(response.count ?? 0);
    } catch (err: any) {
      console.error('Failed to load spreadsheets:', err);
      const errorMessage =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to load spreadsheets';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [projectId, page, searchQuery]);

  useEffect(() => {
    void loadSpreadsheets();
  }, [loadSpreadsheets]);

  const handleCreateSpreadsheet = async () => {
    if (!projectId) {
      toast.error('Project ID is required');
      return;
    }

    setCreating(true);
    try {
      const listResp = await SpreadsheetAPI.listSpreadsheets(Number(projectId), {
        page: 1,
        page_size: 500,
        order_by: 'updated_at',
      });
      const names = (listResp.results || []).map((s) => s.name);
      let name = nextUntitledSpreadsheetName(names);

      const tryCreate = async (n: string) => SpreadsheetAPI.createSpreadsheet(Number(projectId), { name: n });

      let newSpreadsheet: SpreadsheetData;
      try {
        newSpreadsheet = await tryCreate(name);
      } catch (err: any) {
        const msg = String(err?.response?.data?.detail ?? err?.response?.data?.error ?? err?.message ?? '');
        const looksDuplicate = msg.toLowerCase().includes('already exists');
        if (looksDuplicate) {
          const fallback = `Untitled spreadsheet ${Date.now()}`.slice(0, 200);
          newSpreadsheet = await tryCreate(fallback);
        } else {
          throw err;
        }
      }

      toast.success('Spreadsheet created');
      router.push(`/projects/${projectId}/spreadsheets/${newSpreadsheet.id}`);
    } catch (err: any) {
      console.error('Failed to create spreadsheet:', err);
      const errorMessage =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to create spreadsheet';
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSpreadsheet = async (spreadsheetIdToDelete: number) => {
    setDeletingId(spreadsheetIdToDelete);
    try {
      await SpreadsheetAPI.deleteSpreadsheet(spreadsheetIdToDelete);
      toast.success('Spreadsheet deleted successfully');

      const response = await SpreadsheetAPI.listSpreadsheets(Number(projectId), {
        page,
        page_size: PAGE_SIZE,
        search: searchQuery.trim() || undefined,
        order_by: 'updated_at',
      });
      let results = response.results || [];
      let count = response.count ?? 0;

      if (results.length === 0 && page > 1) {
        const prevPage = page - 1;
        setPage(prevPage);
        const retry = await SpreadsheetAPI.listSpreadsheets(Number(projectId), {
          page: prevPage,
          page_size: PAGE_SIZE,
          search: searchQuery.trim() || undefined,
          order_by: 'updated_at',
        });
        results = retry.results || [];
        count = retry.count ?? 0;
      }

      setSpreadsheets(results);
      setTotalCount(count);
    } catch (err: any) {
      console.error('Failed to delete spreadsheet:', err);
      const errorMessage =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        'Delete failed.';
      toast.error(errorMessage);
    } finally {
      setDeletingId(null);
      setDeleteConfirmSpreadsheet(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasNext = page < totalPages;
  const hasPrevious = page > 1;

  const renderEmptyState = () => {
    if (delayedLoading) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <p className="mt-3 font-medium text-gray-900">Loading spreadsheets…</p>
          <p className="text-sm text-gray-600">Fetching spreadsheets from the backend.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-white p-10 text-center text-red-600">
          <AlertCircle className="h-6 w-6" />
          <p className="mt-3 font-semibold">Could not load spreadsheets</p>
          <p className="text-sm text-red-500">{error}</p>
          <button
            onClick={() => {
              setError(null);
              void loadSpreadsheets();
            }}
            className="mt-4 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-600">
        <p className="text-sm font-semibold text-gray-900">
          {searchQuery.trim() ? 'No spreadsheets match your search.' : 'No spreadsheet yet'}
        </p>
      </div>
    );
  };

  const renderSpreadsheetRow = (spreadsheet: SpreadsheetData) => {
    const isDeleting = deletingId === spreadsheet.id;

    return (
      <tr
        key={spreadsheet.id}
        className="border-b border-gray-200 hover:bg-gray-50 transition-colors group cursor-pointer"
        onClick={() => router.push(`/projects/${projectId}/spreadsheets/${spreadsheet.id}`)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700 flex-shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900 truncate">{spreadsheet.name}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(spreadsheet.updated_at)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={(event) => {
                event.stopPropagation();
                setDeleteConfirmSpreadsheet({ id: spreadsheet.id, name: spreadsheet.name });
              }}
              disabled={isDeleting}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const showTable = !error && (delayedLoading || spreadsheets.length > 0);

  return (
    <ProtectedRoute renderChildrenWhileLoading>
      <Layout>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <div className="mx-auto max-w-6xl w-full px-4 py-6 flex flex-col flex-1">
            <div className="flex flex-col gap-2 mb-6">
              <div className="flex items-center gap-3">
                <Link
                  href="/projects"
                  className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Projects
                </Link>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    {project?.name ?? 'Project'}
                  </h1>
                  <div className="mt-1 flex items-center gap-2 text-sm uppercase tracking-wide text-blue-700">
                    <div className="h-6 w-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    Spreadsheets
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCreateSpreadsheet()}
                  disabled={creating || !!error}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 shrink-0"
                >
                  {creating ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create Spreadsheet
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search spreadsheets..."
                  disabled={!!error && !loading}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!showTable ? (
                renderEmptyState()
              ) : (
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
                        {delayedLoading ? (
                          spreadsheetLoadingRows.map((row, index) => (
                            <tr key={`spreadsheet-loading-row-${index}`} className="border-b border-gray-200">
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
                          ))
                        ) : (
                          spreadsheets.map(renderSpreadsheetRow)
                        )}
                      </tbody>
                    </table>
                  </div>

                  {totalCount > 0 && (
                    <div className="px-4 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-gray-700">
                          Showing{' '}
                          <span className="font-semibold text-gray-900">
                            {totalCount > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}
                          </span>
                          {' '}-{' '}
                          <span className="font-semibold text-gray-900">
                            {Math.min(page * PAGE_SIZE, totalCount)}
                          </span>
                          {' '}
                          of <span className="font-semibold text-gray-900">{totalCount}</span> spreadsheet
                          {totalCount !== 1 ? 's' : ''}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={!hasPrevious || loading}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Previous
                          </button>
                          <div className="flex items-center gap-1 flex-wrap">
                            {totalPages <= 7 ? (
                              [...Array(totalPages)].map((_, i) => (
                                <button
                                  key={i + 1}
                                  type="button"
                                  onClick={() => setPage(i + 1)}
                                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                    page === i + 1
                                      ? 'bg-indigo-600 text-white'
                                      : 'text-gray-700 hover:bg-gray-100'
                                  }`}
                                >
                                  {i + 1}
                                </button>
                              ))
                            ) : (
                              <>
                                {page > 3 && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setPage(1)}
                                      className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                                    >
                                      1
                                    </button>
                                    {page > 4 && <span className="px-2 text-gray-500">...</span>}
                                  </>
                                )}
                                {[...Array(5)].map((_, i) => {
                                  const pageNum = page - 2 + i;
                                  if (pageNum < 1 || pageNum > totalPages) return null;
                                  return (
                                    <button
                                      key={pageNum}
                                      type="button"
                                      onClick={() => setPage(pageNum)}
                                      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                        page === pageNum
                                          ? 'bg-indigo-600 text-white'
                                          : 'text-gray-700 hover:bg-gray-100'
                                      }`}
                                    >
                                      {pageNum}
                                    </button>
                                  );
                                })}
                                {page < totalPages - 2 && (
                                  <>
                                    {page < totalPages - 3 && <span className="px-2 text-gray-500">...</span>}
                                    <button
                                      type="button"
                                      onClick={() => setPage(totalPages)}
                                      className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                                    >
                                      {totalPages}
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={!hasNext || loading}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
      {deleteConfirmSpreadsheet && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!deletingId) setDeleteConfirmSpreadsheet(null);
          }}
        >
          <div className="w-[min(420px,calc(100vw-2rem))]">
            <div className="rounded-2xl bg-white shadow-2xl ring-1 ring-gray-100">
              <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Delete spreadsheet</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Delete &quot;{deleteConfirmSpreadsheet.name}&quot;? This action cannot be undone.
                </p>
              </div>
              <div className="p-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmSpreadsheet(null)}
                  className="rounded border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  disabled={!!deletingId}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    deleteConfirmSpreadsheet && void handleDeleteSpreadsheet(deleteConfirmSpreadsheet.id)
                  }
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  disabled={!!deletingId}
                >
                  {deletingId === deleteConfirmSpreadsheet.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </ProtectedRoute>
  );
}
