'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ChatFAB from '@/components/global-chat/ChatFAB';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useProjectStore } from '@/lib/projectStore';
import { ProjectAPI, ProjectData } from '@/lib/api/projectApi';
import { SpreadsheetAPI } from '@/lib/api/spreadsheetApi';
import type { SpreadsheetData } from '@/types/spreadsheet';
import SpreadsheetsHeader from '@/components/spreadsheets/SpreadsheetsHeader';
import SpreadsheetCard from '@/components/spreadsheets/SpreadsheetCard';
import CreateSpreadsheetDialog from '@/components/spreadsheets/CreateSpreadsheetDialog';
import { Skeleton } from '@/components/ui/skeleton';

const PAGE_SIZE = 12;

function SpreadsheetCardSkeleton() {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    </div>
  );
}

export default function SpreadsheetsV2ListPage() {
  const searchParams = useSearchParams();
  const projectIdParam = searchParams?.get('project_id');
  const activeProject = useProjectStore((s) => s.activeProject);
  const hasProjectStoreHydrated = useProjectStore((s) => s.hasHydrated);
  const projectId = projectIdParam
    ? Number(projectIdParam)
    : activeProject?.id ?? null;
  const projectContextLoading = !projectIdParam && !hasProjectStoreHydrated;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<SpreadsheetData | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }
    let cancelled = false;
    ProjectAPI.getProjects()
      .then((list) => {
        if (cancelled) return;
        const match = list.find((p) => p.id === projectId);
        setProject(match || null);
      })
      .catch(() => {
        if (!cancelled) setProject(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    SpreadsheetAPI.listSpreadsheets(projectId, {
      page,
      page_size: PAGE_SIZE,
      search: debouncedSearch || undefined,
      order_by: 'updated_at',
    })
      .then((resp) => {
        if (cancelled) return;
        setSpreadsheets(resp.results || []);
        setTotalCount(resp.count ?? 0);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          (err as { response?: { data?: { detail?: string; error?: string } } })
            ?.response?.data?.detail ||
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error ||
          (err as { message?: string })?.message ||
          'Could not load spreadsheets.';
        setErrorMessage(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, page, debouncedSearch, refreshToken]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    [totalCount]
  );

  const handleCreated = useCallback(async (created: SpreadsheetData) => {
    setRefreshToken((n) => n + 1);
    setPage(1);
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await SpreadsheetAPI.deleteSpreadsheet(deleteTarget.id);
      toast.success(`Deleted ${deleteTarget.name}`);
      setDeleteTarget(null);
      setRefreshToken((n) => n + 1);
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message || 'Could not delete spreadsheet.';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ProtectedRoute renderChildrenWhileLoading>
      <DashboardLayout alerts={[]}>
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <SpreadsheetsHeader
          projectName={project?.name ?? activeProject?.name}
          onCreate={() => setCreateOpen(true)}
        />

        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search spreadsheets"
                className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              />
            </div>
            <div className="text-xs text-gray-500">
              {projectContextLoading || loading ? (
                <Skeleton className="h-3 w-24" />
              ) : (
                `${totalCount} ${totalCount === 1 ? 'spreadsheet' : 'spreadsheets'}`
              )}
            </div>
          </div>

          {!projectContextLoading && !projectId && (
            <div className="rounded-xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">
              Select a project from the sidebar to view spreadsheets.
            </div>
          )}

          {projectId && errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="flex-1">{errorMessage}</div>
              <button
                type="button"
                onClick={() => setRefreshToken((n) => n + 1)}
                className="text-xs font-medium text-rose-700 underline"
              >
                Retry
              </button>
            </div>
          )}

          {projectId && !errorMessage && spreadsheets.length === 0 && !loading && (
            <div className="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
              <p className="text-sm text-gray-600">
                {debouncedSearch
                  ? `No spreadsheets match "${debouncedSearch}".`
                  : 'No spreadsheets yet.'}
              </p>
              {!debouncedSearch && (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                >
                  Create your first spreadsheet
                </button>
              )}
            </div>
          )}

          {(projectContextLoading || (projectId && !errorMessage && loading)) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <SpreadsheetCardSkeleton key={`legacy-spreadsheet-card-skeleton-${index}`} />
              ))}
            </div>
          )}

          {projectId && !errorMessage && spreadsheets.length > 0 && !loading && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {spreadsheets.map((sheet) => (
                <SpreadsheetCard
                  key={sheet.id}
                  spreadsheet={sheet}
                  projectId={projectId}
                  onRequestDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}

          {projectId && totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>

        {projectId && (
          <CreateSpreadsheetDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            projectId={projectId}
            onCreated={handleCreated}
          />
        )}

        <ConfirmDialog
          isOpen={!!deleteTarget}
          type="danger"
          title="Delete spreadsheet?"
          message={`"${deleteTarget?.name ?? ''}" will be hidden from everyone in this project. You can still recover it via support.`}
          confirmText={deleting ? 'Deleting…' : 'Delete'}
          cancelText="Cancel"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
      <ChatFAB />
    </DashboardLayout>
    </ProtectedRoute>
  );
}
