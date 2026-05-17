'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, PiggyBank, Pencil, Check, X, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useProjectStore } from '@/lib/projectStore';
import api from '@/lib/api';
import NewBudgetPool from '@/components/budget/NewBudgetPool';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface BudgetPool {
  id: number;
  name: string;
  project: number;
  ad_channel: number;
  ad_channel_name: string | null;
  total_amount: string;
  used_amount: string;
  available_amount: string;
  currency: string;
  created_at: string | null;
}

interface EditState {
  name: string;
  total_amount: string;
}

type SortKey = 'newest' | 'name' | 'total' | 'used' | 'available' | 'pct';
type SortDir = 'asc' | 'desc';
type GroupBy = 'none' | 'channel' | 'currency';

const INPUT = 'rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30';
const SELECT = `${INPUT} pr-7 appearance-none cursor-pointer`;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Created' },
  { value: 'name', label: 'Name' },
  { value: 'total', label: 'Total' },
  { value: 'used', label: 'Used' },
  { value: 'available', label: 'Available' },
  { value: 'pct', label: '% used' },
];

function PoolCard({
  pool,
  editingId,
  editState,
  saving,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onEditChange,
}: {
  pool: BudgetPool;
  editingId: number | null;
  editState: EditState;
  saving: boolean;
  onStartEdit: (pool: BudgetPool) => void;
  onCancelEdit: () => void;
  onSaveEdit: (pool: BudgetPool) => void;
  onDelete: (id: number) => void;
  onEditChange: (patch: Partial<EditState>) => void;
}) {
  const total = parseFloat(pool.total_amount);
  const used = parseFloat(pool.used_amount);
  const available = parseFloat(pool.available_amount);
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const isEditing = editingId === pool.id;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {pool.ad_channel_name ?? `Channel #${pool.ad_channel}`}
            </span>
            <span className="rounded-full bg-[#3CCED7]/15 px-2 py-0.5 text-xs text-[#1a9ba3]">
              {pool.currency}
            </span>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-400">Name</label>
                <input
                  type="text"
                  value={editState.name}
                  onChange={(e) => onEditChange({ name: e.target.value })}
                  placeholder="e.g. Q1 Campaign"
                  className={`${INPUT} w-full`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-400">Total amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editState.total_amount}
                  onChange={(e) => onEditChange({ total_amount: e.target.value })}
                  className={`${INPUT} w-40`}
                />
              </div>
            </div>
          ) : (
            <>
              {pool.name && <p className="mb-2 text-xs text-gray-500">{pool.name}</p>}
              <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                <div>
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="font-medium text-gray-900">{total.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Used</p>
                  <p className="font-medium text-gray-900">{used.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Available</p>
                  <p className="font-medium text-green-600">{available.toLocaleString()}</p>
                </div>
              </div>
              <div className="w-full rounded-full bg-gray-100 h-1.5">
                <div
                  className="h-1.5 rounded-full bg-[#3CCED7] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">{pct.toFixed(1)}% used</p>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isEditing ? (
            <>
              <button onClick={() => onSaveEdit(pool)} disabled={saving} className="rounded-md p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-40" title="Save">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={onCancelEdit} disabled={saving} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40" title="Cancel">
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onStartEdit(pool)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Edit">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => onDelete(pool.id)} className="rounded-md p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-500" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BudgetPoolsPage() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const projectId = activeProject?.id ?? null;

  const [pools, setPools] = useState<BudgetPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: '', total_amount: '' });
  const [saving, setSaving] = useState(false);

  const PAGE_SIZE = 10;
  const sessionKey = `budget-pools-state-${projectId ?? 'all'}`;

  const [filterChannel, setFilterChannel] = useState('');
  const [filterCurrency, setFilterCurrency] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [currentPage, setCurrentPage] = useState(1);

  const restoredForProject = useRef<number | null | 'all'>(undefined as any);
  useEffect(() => {
    const key = projectId ?? 'all';
    if (restoredForProject.current === key) return;
    restoredForProject.current = key;
    try {
      const saved = sessionStorage.getItem(`budget-pools-state-${key}`);
      if (!saved) return;
      const p = JSON.parse(saved) as { filterChannel?: string; filterCurrency?: string; sortKey?: SortKey; sortDir?: SortDir; groupBy?: GroupBy };
      if (p.filterChannel !== undefined) setFilterChannel(p.filterChannel);
      if (p.filterCurrency !== undefined) setFilterCurrency(p.filterCurrency);
      if (p.sortKey) setSortKey(p.sortKey);
      if (p.sortDir) setSortDir(p.sortDir);
      if (p.groupBy) setGroupBy(p.groupBy);
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify({ filterChannel, filterCurrency, sortKey, sortDir, groupBy }));
    } catch { /* ignore */ }
  }, [sessionKey, filterChannel, filterCurrency, sortKey, sortDir, groupBy]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page_size: 200 };
      if (projectId) params.project_id = projectId;
      const r = await api.get('/api/budgets/pools/', { params });
      const rows: BudgetPool[] = Array.isArray(r.data) ? r.data : (r.data?.results ?? []);
      setPools(rows);
    } catch {
      toast.error('Failed to load budget pools');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const channels = useMemo(() => {
    const seen = new Set<string>();
    return pools
      .map((p) => p.ad_channel_name ?? `Channel #${p.ad_channel}`)
      .filter((c) => { if (seen.has(c)) return false; seen.add(c); return true; })
      .sort();
  }, [pools]);

  const currencies = useMemo(() => {
    const seen = new Set<string>();
    return pools.map((p) => p.currency).filter((c) => { if (seen.has(c)) return false; seen.add(c); return true; }).sort();
  }, [pools]);

  useEffect(() => { setCurrentPage(1); }, [filterChannel, filterCurrency, sortKey, sortDir, groupBy]);

  const sortedFiltered = useMemo(() => {
    let result = pools.filter((p) => {
      const ch = p.ad_channel_name ?? `Channel #${p.ad_channel}`;
      if (filterChannel && ch !== filterChannel) return false;
      if (filterCurrency && p.currency !== filterCurrency) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      let av = 0, bv = 0;
      if (sortKey === 'newest') {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        const diff = bt - at;
        if (diff !== 0) return sortDir === 'desc' ? diff : -diff;
        return sortDir === 'desc' ? b.id - a.id : a.id - b.id;
      }
      if (sortKey === 'name') {
        const an = (a.name || a.ad_channel_name || '').toLowerCase();
        const bn = (b.name || b.ad_channel_name || '').toLowerCase();
        return sortDir === 'asc' ? an.localeCompare(bn) : bn.localeCompare(an);
      }
      if (sortKey === 'total') { av = parseFloat(a.total_amount); bv = parseFloat(b.total_amount); }
      else if (sortKey === 'used') { av = parseFloat(a.used_amount); bv = parseFloat(b.used_amount); }
      else if (sortKey === 'available') { av = parseFloat(a.available_amount); bv = parseFloat(b.available_amount); }
      else if (sortKey === 'pct') {
        const at = parseFloat(a.total_amount); const bt = parseFloat(b.total_amount);
        av = at > 0 ? parseFloat(a.used_amount) / at : 0;
        bv = bt > 0 ? parseFloat(b.used_amount) / bt : 0;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return result;
  }, [pools, filterChannel, filterCurrency, sortKey, sortDir]);

  // Build all groups first, then paginate — either by individual pools (no grouping)
  // or by whole groups (grouping active) so groups never split across pages.
  const allGroups = useMemo(() => {
    if (groupBy === 'none') return [{ label: null, items: sortedFiltered }];
    const map = new Map<string, BudgetPool[]>();
    for (const p of sortedFiltered) {
      const key = groupBy === 'channel'
        ? (p.ad_channel_name ?? `Channel #${p.ad_channel}`)
        : p.currency;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([label, items]) => ({ label, items }));
  }, [sortedFiltered, groupBy]);

  // When grouping: paginate groups. When flat: paginate individual pools.
  const totalPages = useMemo(() => {
    if (groupBy !== 'none') return Math.max(1, Math.ceil(allGroups.length / PAGE_SIZE));
    return Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  }, [groupBy, allGroups.length, sortedFiltered.length, PAGE_SIZE]);

  const grouped = useMemo(() => {
    if (groupBy !== 'none') {
      return allGroups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    }
    const pageItems = sortedFiltered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    return [{ label: null, items: pageItems }];
  }, [groupBy, allGroups, sortedFiltered, currentPage, PAGE_SIZE]);

  const handleCreated = () => { setShowCreate(false); void load(); toast.success('Budget pool created'); };

  const startEdit = (pool: BudgetPool) => {
    setEditingId(pool.id);
    setEditState({ name: pool.name ?? '', total_amount: pool.total_amount });
  };
  const cancelEdit = () => { setEditingId(null); setEditState({ name: '', total_amount: '' }); };

  const saveEdit = async (pool: BudgetPool) => {
    if (!editState.total_amount || Number(editState.total_amount) <= 0) {
      toast.error('Total amount must be greater than 0');
      return;
    }
    setSaving(true);
    try {
      const r = await api.patch(`/api/budgets/pools/${pool.id}/`, { name: editState.name, total_amount: editState.total_amount });
      setPools((prev) => prev.map((p) => p.id === pool.id ? { ...p, ...r.data } : p));
      setEditingId(null);
      toast.success('Pool updated');
    } catch (e: any) {
      toast.error(e?.response?.data ? JSON.stringify(e.response.data) : 'Failed to update pool');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/budgets/pools/${deleteTarget}/`);
      setPools((p) => p.filter((pool) => pool.id !== deleteTarget));
      toast.success('Pool deleted');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to delete pool');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'newest' ? 'desc' : 'asc'); }
  };

  const hasFilters = filterChannel || filterCurrency;

  return (
    <ProtectedRoute renderChildrenWhileLoading>
      <DashboardLayout alerts={[]} upcomingMeetings={[]}>
        <div className="mx-auto max-w-4xl px-6 py-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3CCED7]/15">
                <PiggyBank className="h-5 w-5 text-[#1a9ba3]" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Budget Pools</h1>
                <p className="text-xs text-gray-500">
                  {activeProject ? `Project: ${activeProject.name}` : 'All projects'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3CCED7] px-3 py-2 text-sm font-medium text-white hover:bg-[#2fb8c0]"
            >
              <Plus className="h-4 w-4" /> New pool
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Create budget pool</h2>
              <NewBudgetPool onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
            </div>
          )}

          {/* Controls */}
          {!loading && pools.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {/* Channel filter */}
              <div className="relative">
                <select
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value)}
                  className={SELECT}
                >
                  <option value="">All channels</option>
                  {channels.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              </div>

              {/* Currency filter */}
              <div className="relative">
                <select
                  value={filterCurrency}
                  onChange={(e) => setFilterCurrency(e.target.value)}
                  className={SELECT}
                >
                  <option value="">All currencies</option>
                  {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              </div>

              {/* Group by */}
              <div className="relative">
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                  className={SELECT}
                >
                  <option value="none">No grouping</option>
                  <option value="channel">Group by channel</option>
                  <option value="currency">Group by currency</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortKey}
                  onChange={(e) => toggleSort(e.target.value as SortKey)}
                  className={SELECT}
                >
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              </div>

              <button
                onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
                className="rounded-md px-2.5 py-1.5 text-sm text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
                title="Toggle sort direction"
              >
                {sortDir === 'asc' ? '↑' : '↓'}
              </button>

              {hasFilters && (
                <button
                  onClick={() => { setFilterChannel(''); setFilterCurrency(''); }}
                  className="rounded-md px-2.5 py-1.5 text-xs text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Pool list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : sortedFiltered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
              <PiggyBank className="mx-auto mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">
                {pools.length === 0 ? 'No budget pools yet' : 'No pools match the current filters'}
              </p>
              {pools.length === 0 && (
                <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-[#1a9ba3] hover:underline">
                  Create your first pool
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(({ label, items }) => (
                <div key={label ?? '__all'}>
                  {label && (
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
                      <span className="text-[11px] text-gray-300">({items.length})</span>
                    </div>
                  )}
                  <div className="space-y-3">
                    {items.map((pool) => (
                      <PoolCard
                        key={pool.id}
                        pool={pool}
                        editingId={editingId}
                        editState={editState}
                        saving={saving}
                        onStartEdit={startEdit}
                        onCancelEdit={cancelEdit}
                        onSaveEdit={saveEdit}
                        onDelete={setDeleteTarget}
                        onEditChange={(patch) => setEditState((s) => ({ ...s, ...patch }))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between text-sm">
              <span className="text-xs text-gray-400">
                {groupBy !== 'none'
                  ? `Groups ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, allGroups.length)} of ${allGroups.length}`
                  : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, sortedFiltered.length)} of ${sortedFiltered.length}`
                }
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="rounded-md px-2 py-1 text-xs text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-30"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage((p) => p - 1)}
                  disabled={currentPage === 1}
                  className="rounded-md px-2.5 py-1 text-xs text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-30"
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | '…')[]>((acc, p, i, arr) => {
                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('…');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '…' ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-300">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className={`rounded-md px-2.5 py-1 text-xs ring-1 ${
                          currentPage === p
                            ? 'bg-[#3CCED7] text-white ring-[#3CCED7]'
                            : 'text-gray-500 ring-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-md px-2.5 py-1 text-xs text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-30"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="rounded-md px-2 py-1 text-xs text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-30"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>

        <ConfirmModal
          isOpen={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          title="Delete budget pool"
          message="This pool will be permanently removed. Pools with existing budget requests cannot be deleted."
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          loading={deleting}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
