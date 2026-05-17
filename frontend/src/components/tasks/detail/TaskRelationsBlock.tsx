'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Network, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData, TaskRelationsResponse, TaskRelationItem } from '@/types/task';
import AddRelationDialog from './AddRelationDialog';
import ConfirmDialog from './ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_TOKEN } from './pills/StatusPill';

// ── Constants ────────────────────────────────────────────────────────────────

const GROUPS: Array<{ key: keyof TaskRelationsResponse; label: string }> = [
  { key: 'blocks',       label: 'Blocks' },
  { key: 'is_blocked_by', label: 'Is blocked by' },
  { key: 'causes',       label: 'Causes' },
  { key: 'is_caused_by', label: 'Is caused by' },
  { key: 'clones',       label: 'Clones' },
  { key: 'is_cloned_by', label: 'Is cloned by' },
  { key: 'relates_to',   label: 'Relates to' },
];

const PRIORITY_TOKEN: Record<string, { cls: string; symbol: string }> = {
  HIGHEST: { cls: 'text-rose-600',   symbol: '↑↑' },
  HIGH:    { cls: 'text-orange-500', symbol: '↑'  },
  MEDIUM:  { cls: 'text-gray-400',   symbol: '—'  },
  LOW:     { cls: 'text-sky-500',    symbol: '↓'  },
  LOWEST:  { cls: 'text-gray-300',   symbol: '↓↓' },
};

// ── Small components ─────────────────────────────────────────────────────────

function MiniStatus({ status }: { status?: string }) {
  const token = (status && STATUS_TOKEN[status]) || STATUS_TOKEN.DRAFT;
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${token.bg} ${token.text}`}>
      {token.label}
    </span>
  );
}

function MiniPriority({ priority }: { priority?: string }) {
  const p = priority ? PRIORITY_TOKEN[priority] : null;
  if (!p) return null;
  return (
    <span className={`font-mono text-[11px] font-bold ${p.cls}`} title={priority}>
      {p.symbol}
    </span>
  );
}

// ── Dependency tree node ─────────────────────────────────────────────────────

function TreeNode({
  task,
  depth,
  isCircular,
  chainCache,
  visited,
}: {
  task: TaskData;
  depth: number;
  isCircular: boolean;
  chainCache: Map<number, TaskRelationsResponse>;
  visited: Set<number>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [childRel, setChildRel] = useState<TaskRelationsResponse | null>(
    task.id != null ? chainCache.get(task.id) ?? null : null,
  );
  const [childLoading, setChildLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const blockerChildren: TaskRelationItem[] = childRel
    ? [...(childRel.blocks ?? []), ...(childRel.is_blocked_by ?? [])]
    : [];

  const hasChildren = childRel ? blockerChildren.length > 0 : true; // optimistic until loaded

  const toggle = async () => {
    if (!task.id) return;
    if (!expanded && !childRel) {
      setChildLoading(true);
      try {
        const r = await TaskAPI.getRelations(task.id);
        if (mountedRef.current) setChildRel(r);
      } catch {
        if (mountedRef.current) setChildRel({ blocks: [], is_blocked_by: [], causes: [], is_caused_by: [], clones: [], is_cloned_by: [], relates_to: [] });
      } finally {
        if (mountedRef.current) setChildLoading(false);
      }
    }
    if (mountedRef.current) setExpanded((v) => !v);
  };

  const nextVisited = new Set(visited).add(task.id ?? -1);

  return (
    <div className={depth > 0 ? 'ml-4 border-l border-gray-100 pl-3' : ''}>
      <div className="flex items-center gap-1.5 py-1">
        {/* expand toggle — only show if not a leaf or not yet loaded */}
        {depth < 3 ? (
          <button
            type="button"
            onClick={toggle}
            className="flex-shrink-0 text-gray-300 hover:text-gray-500"
          >
            {childLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        <MiniPriority priority={(task as any).priority} />

        <Link
          href={`/tasks/${task.id}`}
          className="flex-1 truncate text-[12px] text-gray-800 hover:text-[#3CCED7] hover:underline"
        >
          {task.summary || `Task #${task.id}`}
        </Link>

        <MiniStatus status={task.status} />

        {isCircular && (
          <span title="Circular dependency" className="text-amber-500">
            <AlertTriangle className="h-3 w-3" />
          </span>
        )}
      </div>

      {expanded && childRel && (
        <>
          {childRel.blocks.length > 0 && (
            <div>
              <p className="ml-4 mt-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">Blocks</p>
              {childRel.blocks.map((item) => (
                <TreeNode
                  key={item.relation_id}
                  task={item.task}
                  depth={depth + 1}
                  isCircular={nextVisited.has(item.task.id ?? -1)}
                  chainCache={chainCache}
                  visited={nextVisited}
                />
              ))}
            </div>
          )}
          {childRel.is_blocked_by.length > 0 && (
            <div>
              <p className="ml-4 mt-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">Blocked by</p>
              {childRel.is_blocked_by.map((item) => (
                <TreeNode
                  key={item.relation_id}
                  task={item.task}
                  depth={depth + 1}
                  isCircular={nextVisited.has(item.task.id ?? -1)}
                  chainCache={chainCache}
                  visited={nextVisited}
                />
              ))}
            </div>
          )}
          {blockerChildren.length === 0 && (
            <p className="ml-7 text-[11px] text-gray-400">No further blockers</p>
          )}
        </>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function TaskRelationsBlock({
  task,
  readOnly,
  loading = false,
  onMutated,
}: {
  task: TaskData;
  readOnly: boolean;
  loading?: boolean;
  onMutated?: () => void;
}) {
  const [rel, setRel] = useState<TaskRelationsResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [localKey, setLocalKey] = useState(0);
  const [explorerOpen, setExplorerOpen] = useState(false);
  // Cache of relations fetched for linked tasks (used for chain depth badges + tree)
  const [chainCache, setChainCache] = useState<Map<number, TaskRelationsResponse>>(new Map());

  useEffect(() => {
    let cancelled = false;
    if (loading || !task.id) return;
    TaskAPI.getRelations(task.id)
      .then((data) => {
        if (!cancelled) setRel(data);
      })
      .catch(() => {
        if (!cancelled)
          setRel({ causes: [], is_caused_by: [], blocks: [], is_blocked_by: [], clones: [], is_cloned_by: [], relates_to: [] });
      });
    return () => { cancelled = true; };
  }, [loading, task.id, localKey]);

  // Batch-fetch relations for direct blockers/blocked-by to show chain depth badges
  useEffect(() => {
    if (!rel) return;
    const ids = [
      ...rel.blocks.map((i) => i.task.id),
      ...rel.is_blocked_by.map((i) => i.task.id),
    ].filter((id): id is number => id != null);
    if (ids.length === 0) return;

    let cancelled = false;
    Promise.all(
      ids.map((id) =>
        TaskAPI.getRelations(id)
          .then((r) => [id, r] as const)
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      setChainCache((prev) => {
        const next = new Map(prev);
        for (const entry of results) {
          if (entry) next.set(entry[0], entry[1]);
        }
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [rel]);

  const [confirmRelationId, setConfirmRelationId] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  const removeRelation = async () => {
    if (!task.id || !confirmRelationId) return;
    setRemoving(true);
    try {
      await TaskAPI.deleteRelation(task.id, confirmRelationId);
      setConfirmRelationId(null);
      setLocalKey((k) => k + 1);
      onMutated?.();
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Remove failed');
    } finally {
      setRemoving(false);
    }
  };

  // Detect circular dependencies: task IDs that appear in both sides of a pair
  const circularIds = useMemo<Set<number>>(() => {
    if (!rel) return new Set();
    const out = new Set<number>();
    const blockIds = new Set(rel.blocks.map((i) => i.task.id).filter(Boolean) as number[]);
    const blockedByIds = new Set(rel.is_blocked_by.map((i) => i.task.id).filter(Boolean) as number[]);
    const causeIds = new Set(rel.causes.map((i) => i.task.id).filter(Boolean) as number[]);
    const causedByIds = new Set(rel.is_caused_by.map((i) => i.task.id).filter(Boolean) as number[]);
    for (const id of blockIds) if (blockedByIds.has(id)) out.add(id);
    for (const id of causeIds) if (causedByIds.has(id)) out.add(id);
    return out;
  }, [rel]);

  const totalCount = rel
    ? GROUPS.reduce((sum, g) => sum + (rel[g.key] as TaskRelationItem[]).length, 0)
    : 0;

  const hasBlockerRelations = rel && (rel.blocks.length > 0 || rel.is_blocked_by.length > 0);

  return (
    <section className="min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Linked work items
          {totalCount > 0 && (
            <span className="ml-2 text-[11px] font-medium normal-case text-gray-400">
              {totalCount}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-1">
          {hasBlockerRelations && (
            <button
              type="button"
              onClick={() => setExplorerOpen((v) => !v)}
              title={explorerOpen ? 'Hide dependency tree' : 'View dependency tree'}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                explorerOpen
                  ? 'bg-[#3CCED7]/10 text-[#2fb8c0]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              Tree
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              <Plus className="h-3.5 w-3.5" />
              Link
            </button>
          )}
        </div>
      </div>

      {/* Circular dependency warning banner */}
      {circularIds.size > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Circular dependency detected — {circularIds.size === 1 ? '1 task' : `${circularIds.size} tasks`} appear
            on both sides of a blocker or cause relationship.
          </span>
        </div>
      )}

      {(loading || rel === null) ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, groupIndex) => (
            <div key={`task-relations-skeleton-group-${groupIndex}`}>
              <Skeleton className="mb-2 h-3 w-20" />
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((__, itemIndex) => (
                  <div
                    key={`task-relations-skeleton-${groupIndex}-${itemIndex}`}
                    className="flex items-center gap-3 py-1.5"
                  >
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {rel && totalCount === 0 && (
        <p className="text-xs text-gray-400">No linked work items yet.</p>
      )}

      {rel && totalCount > 0 && (
        <div className="space-y-4">
          {GROUPS.map((g) => {
            const items = rel[g.key] as TaskRelationItem[];
            if (!items || items.length === 0) return null;
            const isBlockerGroup = g.key === 'blocks' || g.key === 'is_blocked_by';
            return (
              <div key={g.key}>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  {g.label}
                </p>
                <ul className="divide-y divide-gray-100">
                  {items.map((item) => {
                    const isCircular = circularIds.has(item.task.id ?? -1);
                    const cached = item.task.id != null ? chainCache.get(item.task.id) : undefined;
                    const chainBlockCount = cached ? cached.blocks.length : 0;
                    const chainBlockedByCount = cached ? cached.is_blocked_by.length : 0;

                    return (
                      <li key={item.relation_id} className={`flex items-center gap-2 py-1.5 ${isCircular ? 'bg-amber-50/40 -mx-1 rounded px-1' : ''}`}>
                        <MiniPriority priority={(item.task as any).priority} />
                        <Link
                          href={`/tasks/${item.task.id}`}
                          className="flex-1 truncate text-sm text-gray-900 hover:text-[#3CCED7] hover:underline"
                        >
                          {item.task.summary}
                        </Link>

                        {/* Chain depth badges for blocker groups */}
                        {isBlockerGroup && cached && (
                          <div className="flex items-center gap-1">
                            {g.key === 'blocks' && chainBlockCount > 0 && (
                              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600">
                                → {chainBlockCount} blocked
                              </span>
                            )}
                            {g.key === 'is_blocked_by' && chainBlockedByCount > 0 && (
                              <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-600">
                                ← {chainBlockedByCount} upstream
                              </span>
                            )}
                          </div>
                        )}

                        <MiniStatus status={item.task.status} />

                        {isCircular && (
                          <span title="Circular dependency" className="flex-shrink-0 text-amber-500">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        )}

                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => setConfirmRelationId(item.relation_id)}
                            title="Remove"
                            className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* Dependency explorer tree */}
      {explorerOpen && hasBlockerRelations && rel && (
        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Dependency tree
          </p>

          {rel.blocks.length > 0 && (
            <div className="mb-2">
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-500">Blocks</p>
              {rel.blocks.map((item) => (
                <TreeNode
                  key={item.relation_id}
                  task={item.task}
                  depth={0}
                  isCircular={circularIds.has(item.task.id ?? -1)}
                  chainCache={chainCache}
                  visited={new Set([task.id ?? -1])}
                />
              ))}
            </div>
          )}

          {rel.is_blocked_by.length > 0 && (
            <div>
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-orange-500">Blocked by</p>
              {rel.is_blocked_by.map((item) => (
                <TreeNode
                  key={item.relation_id}
                  task={item.task}
                  depth={0}
                  isCircular={circularIds.has(item.task.id ?? -1)}
                  chainCache={chainCache}
                  visited={new Set([task.id ?? -1])}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && task.id && (
        <AddRelationDialog
          open={modalOpen}
          onOpenChange={setModalOpen}
          sourceTaskId={task.id}
          onAdded={() => { setLocalKey((k) => k + 1); onMutated?.(); }}
        />
      )}

      {!loading && <ConfirmDialog
        open={confirmRelationId !== null}
        onOpenChange={(o) => !o && setConfirmRelationId(null)}
        title="Remove relation"
        description="The link between these two items will be removed. This cannot be undone."
        confirmLabel="Remove"
        destructive
        busy={removing}
        onConfirm={removeRelation}
      />}
    </section>
  );
}
