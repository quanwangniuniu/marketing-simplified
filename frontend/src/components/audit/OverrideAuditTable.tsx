'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import type { OverrideAuditEntry, OverrideAuditFilters } from '@/types/adminOverrideAudit';
import { fetchOverrideAudits } from '@/lib/api/adminOverrideAuditApi';
import OverrideAuditFilterBar from './OverrideAuditFilterBar';
import OverrideAuditEntryRow from './OverrideAuditEntryRow';

const PAGE_SIZE = 50;

export default function OverrideAuditTable() {
  const [entries, setEntries] = useState<OverrideAuditEntry[]>([]);
  const [filters, setFilters] = useState<OverrideAuditFilters>({});
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (pageNum: number, currentFilters: OverrideAuditFilters, append: boolean) => {
      try {
        const response = await fetchOverrideAudits(currentFilters, pageNum, PAGE_SIZE);
        setEntries((prev) => (append ? [...prev, ...response.results] : response.results));
        setCount(response.count);
        setHasMore(response.next !== null);
        setPage(pageNum);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load override audit log');
      }
    },
    []
  );

  useEffect(() => {
    setIsLoading(true);
    loadPage(1, filters, false).finally(() => setIsLoading(false));
  }, [filters, loadPage]);

  async function handleLoadMore() {
    setIsLoading(true);
    await loadPage(page + 1, filters, true);
    setIsLoading(false);
  }

  const knownUsers = Array.from(
    new Map(entries.map((e) => [e.user_id, { id: e.user_id, username: e.username }])).values()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <OverrideAuditFilterBar filters={filters} onChange={setFilters} users={knownUsers} />
        <span className="text-xs text-gray-400 dark:text-gray-500">{count} entries</span>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center py-16 text-red-500 dark:text-red-400">
          <AlertCircle className="mb-2" size={24} />
          <p className="text-sm">{error}</p>
          <button
            onClick={() => {
              setIsLoading(true);
              loadPage(1, filters, false).finally(() => setIsLoading(false));
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-sm underline"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : (
        <>
          <Table className="p-6 overflow-hidden">
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Override Type</TableHead>
                <TableHead>Module / Action</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
                    No override audit entries found.
                  </TableCell>
                </TableRow>
              )}
              {entries.map((entry) => (
                <OverrideAuditEntryRow key={entry.id} entry={entry} />
              ))}
            </TableBody>
          </Table>

          {isLoading && (
            <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">Loading…</div>
          )}

          {hasMore && !isLoading && (
            <div className="text-center">
              <button
                onClick={handleLoadMore}
                className="px-4 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
