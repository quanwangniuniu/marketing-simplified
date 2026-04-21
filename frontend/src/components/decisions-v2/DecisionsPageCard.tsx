'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import DecisionsCardHeader from './DecisionsCardHeader';
import DecisionsGraphSection from './DecisionsGraphSection';
import DecisionsFilterBar, { type SortDir, type SortField } from './DecisionsFilterBar';
import DecisionsTable from './DecisionsTable';
import DecisionsEmptyState from './DecisionsEmptyState';
import DecisionDeleteDialog from './DecisionDeleteDialog';
import { DecisionAPI } from '@/lib/api/decisionApi';
import type {
  DecisionGraphNode,
  DecisionGraphResponse,
  DecisionListItem,
} from '@/types/decision';

const ALL = '__all__';
const PAGE_SIZE = 20;

interface Props {
  projectId: number | null;
  projectName?: string | null;
  role?: string | null;
  canCreate: boolean;
  canDelete: boolean;
  onNavigateToDecision: (id: number) => void;
}

export default function DecisionsPageCard({
  projectId,
  projectName,
  role,
  canCreate,
  canDelete,
  onNavigateToDecision,
}: Props) {
  const [items, setItems] = useState<DecisionListItem[]>([]);
  const [graph, setGraph] = useState<DecisionGraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [riskFilter, setRiskFilter] = useState(ALL);
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<DecisionListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setItems([]);
      setGraph(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [listRes, graphRes] = await Promise.all([
          DecisionAPI.listDecisions(projectId),
          DecisionAPI.getDecisionGraph(projectId).catch(() => null),
        ]);
        if (cancelled) return;
        setItems(listRes.items ?? []);
        setGraph(graphRes ?? null);
      } catch (err) {
        if (!cancelled) {
          const detail =
            (err as any)?.response?.data?.detail ||
            (err as any)?.response?.data?.error?.message ||
            (err as Error)?.message ||
            'Failed to load decisions';
          toast.error(detail);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = items;
    if (q) {
      result = result.filter((d) => (d.title || '').toLowerCase().includes(q));
    }
    if (statusFilter !== ALL) {
      result = result.filter((d) => d.status === statusFilter);
    }
    if (riskFilter !== ALL) {
      result = result.filter((d) => d.riskLevel === riskFilter);
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const resolveSortKey = (item: DecisionListItem): string | number | null => {
      if (sortField === 'updatedAt') {
        return item.updatedAt ?? item.lastEditedAt ?? item.committedAt ?? item.createdAt ?? null;
      }
      return ((item as any)[sortField] ?? null) as string | number | null;
    };
    result = [...result].sort((a, b) => {
      const av = resolveSortKey(a);
      const bv = resolveSortKey(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return result;
  }, [items, search, statusFilter, riskFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const handleCreate = async () => {
    if (!projectId || creating) return;
    setCreating(true);
    try {
      const draft = await DecisionAPI.createDraft(projectId);
      if (draft.id == null) {
        throw new Error('Draft created without id');
      }
      onNavigateToDecision(draft.id);
    } catch (err) {
      const detail =
        (err as any)?.response?.data?.detail ||
        (err as any)?.response?.data?.error?.message ||
        (err as Error)?.message ||
        'Failed to create decision';
      toast.error(detail);
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete || !projectId) return;
    setDeleting(true);
    try {
      await DecisionAPI.deleteDecision(pendingDelete.id, projectId);
      toast.success('Decision deleted');
      setItems((prev) => prev.filter((d) => d.id !== pendingDelete.id));
      setGraph((prev) =>
        prev
          ? {
              nodes: prev.nodes.filter((n) => n.id !== pendingDelete.id),
              edges: prev.edges.filter(
                (e) => e.from !== pendingDelete.id && e.to !== pendingDelete.id
              ),
            }
          : prev
      );
      setPendingDelete(null);
    } catch (err) {
      const detail =
        (err as any)?.response?.data?.detail ||
        (err as any)?.response?.data?.error?.message ||
        (err as Error)?.message ||
        'Failed to delete decision';
      toast.error(detail);
    } finally {
      setDeleting(false);
    }
  };

  const decisionCount = items.length;
  const hasItems = decisionCount > 0;
  const graphNodeForDelete = (node: DecisionGraphNode) => {
    const listItem = items.find((i) => i.id === node.id);
    if (listItem) setPendingDelete(listItem);
  };

  return (
    <>
      <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
        <DecisionsCardHeader
          projectName={projectName}
          decisionCount={decisionCount}
          role={role}
          canCreate={canCreate}
          creating={creating}
          onCreate={handleCreate}
        />

        {loading && !hasItems ? (
          <div className="flex items-center justify-center px-6 py-16 text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading decisions…
          </div>
        ) : !hasItems ? (
          <DecisionsEmptyState onCreate={handleCreate} canCreate={canCreate} />
        ) : (
          <>
            <DecisionsGraphSection
              graph={graph}
              projectId={projectId}
              canEdit={canDelete}
              onEditDecision={(node) => onNavigateToDecision(node.id)}
              onCreateDecision={handleCreate}
              onDeleteDecision={graphNodeForDelete}
            />
            <DecisionsFilterBar
              search={search}
              onSearchChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              statusFilter={statusFilter}
              onStatusFilterChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
              riskFilter={riskFilter}
              onRiskFilterChange={(v) => {
                setRiskFilter(v);
                setPage(1);
              }}
              sortField={sortField}
              onSortFieldChange={setSortField}
              sortDir={sortDir}
              onSortDirToggle={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            />
            <DecisionsTable
              items={paginated}
              onRowClick={onNavigateToDecision}
              onDelete={setPendingDelete}
              canDelete={canDelete}
            />
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3 text-sm">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                  className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-white px-3 text-gray-700 transition hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="text-[12px] text-gray-500">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                  className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-white px-3 text-gray-700 transition hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <DecisionDeleteDialog
        open={!!pendingDelete}
        onOpenChange={(v) => {
          if (!v) setPendingDelete(null);
        }}
        title={pendingDelete?.title ?? ''}
        busy={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
