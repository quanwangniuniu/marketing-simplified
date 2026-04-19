'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import Link from 'next/link';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData, TaskRelationsResponse, TaskRelationItem } from '@/types/task';
import AddRelationDialog from './AddRelationDialog';
import ConfirmDialog from './ConfirmDialog';

const GROUPS: Array<{
  key: keyof TaskRelationsResponse;
  label: string;
}> = [
  { key: 'blocks', label: 'Blocks' },
  { key: 'is_blocked_by', label: 'Is blocked by' },
  { key: 'causes', label: 'Causes' },
  { key: 'is_caused_by', label: 'Is caused by' },
  { key: 'clones', label: 'Clones' },
  { key: 'is_cloned_by', label: 'Is cloned by' },
  { key: 'relates_to', label: 'Relates to' },
];

export default function TaskRelationsBlock({
  task,
  readOnly,
}: {
  task: TaskData;
  readOnly: boolean;
}) {
  const [rel, setRel] = useState<TaskRelationsResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [localKey, setLocalKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!task.id) return;
    TaskAPI.getRelations(task.id)
      .then((data) => {
        if (!cancelled) setRel(data);
      })
      .catch(() => {
        if (!cancelled)
          setRel({
            causes: [],
            is_caused_by: [],
            blocks: [],
            is_blocked_by: [],
            clones: [],
            is_cloned_by: [],
            relates_to: [],
          });
      });
    return () => {
      cancelled = true;
    };
  }, [task.id, localKey]);

  const [confirmRelationId, setConfirmRelationId] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  const removeRelation = async () => {
    if (!task.id || !confirmRelationId) return;
    setRemoving(true);
    try {
      await TaskAPI.deleteRelation(task.id, confirmRelationId);
      setConfirmRelationId(null);
      setLocalKey((k) => k + 1);
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Remove failed');
    } finally {
      setRemoving(false);
    }
  };

  const totalCount = rel
    ? GROUPS.reduce((sum, g) => sum + (rel[g.key] as TaskRelationItem[]).length, 0)
    : 0;

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Linked work items
          {totalCount > 0 && (
            <span className="ml-2 text-[11px] font-medium normal-case text-gray-400">
              {totalCount}
            </span>
          )}
        </h2>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            <Plus className="h-3.5 w-3.5" />
            Link work item
          </button>
        )}
      </div>

      {rel === null && <p className="text-xs text-gray-400">Loading…</p>}
      {rel && totalCount === 0 && (
        <p className="text-xs text-gray-400">No linked work items yet.</p>
      )}

      {rel && totalCount > 0 && (
        <div className="space-y-4">
          {GROUPS.map((g) => {
            const items = rel[g.key] as TaskRelationItem[];
            if (!items || items.length === 0) return null;
            return (
              <div key={g.key}>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  {g.label}
                </p>
                <ul className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <li
                      key={item.relation_id}
                      className="flex items-center gap-3 py-1.5"
                    >
                      <Link
                        href={`/tasks-v2/${item.task.id}`}
                        className="flex-1 truncate text-sm text-gray-900 hover:text-[#3CCED7] hover:underline"
                      >
                        {item.task.summary}
                      </Link>
                      <span className="text-[11px] text-gray-500">{item.task.status}</span>
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
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {task.id && (
        <AddRelationDialog
          open={modalOpen}
          onOpenChange={setModalOpen}
          sourceTaskId={task.id}
          onAdded={() => setLocalKey((k) => k + 1)}
        />
      )}

      <ConfirmDialog
        open={confirmRelationId !== null}
        onOpenChange={(o) => !o && setConfirmRelationId(null)}
        title="Remove relation"
        description="The link between these two items will be removed. This cannot be undone."
        confirmLabel="Remove"
        destructive
        busy={removing}
        onConfirm={removeRelation}
      />
    </section>
  );
}
