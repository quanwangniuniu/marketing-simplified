'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData } from '@/types/task';
import BrandDialog from './BrandDialog';

type RelType = 'causes' | 'blocks' | 'clones' | 'relates_to';

const RELATION_OPTIONS: Array<{ value: RelType; label: string; hint: string }> = [
  { value: 'blocks', label: 'Blocks', hint: 'This task blocks the other' },
  { value: 'causes', label: 'Causes', hint: 'This task causes the other' },
  { value: 'clones', label: 'Clones', hint: 'This task is a clone of the other' },
  { value: 'relates_to', label: 'Relates to', hint: 'Generic relation' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceTaskId: number;
  onAdded: () => void;
}

export default function AddRelationDialog({
  open,
  onOpenChange,
  sourceTaskId,
  onAdded,
}: Props) {
  const [relType, setRelType] = useState<RelType>('blocks');
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<TaskData[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedId(null);
      setRelType('blocks');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      TaskAPI.getTasks({ include_subtasks: true })
        .then((resp) => {
          const rows: TaskData[] = Array.isArray(resp.data)
            ? resp.data
            : (resp.data as any)?.results || [];
          const q = search.trim().toLowerCase();
          const filtered = rows
            .filter((t) => t.id !== sourceTaskId)
            .filter((t) =>
              q
                ? (t.summary || '').toLowerCase().includes(q) ||
                  String(t.id).includes(q)
                : true
            )
            .slice(0, 30);
          setCandidates(filtered);
        })
        .catch(() => setCandidates([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [open, search, sourceTaskId]);

  const submit = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await TaskAPI.addRelation(sourceTaskId, {
        target_task_id: selectedId,
        relationship_type: relType,
      });
      onAdded();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Link failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Link work item"
      subtitle="Pick the relationship type, then select a work item to link."
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Relationship
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {RELATION_OPTIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRelType(r.value)}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  relType === r.value
                    ? 'border-[#3CCED7] bg-[#3CCED7]/5 ring-2 ring-[#3CCED7]/30'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-medium text-gray-900">{r.label}</p>
                <p className="mt-0.5 text-[11px] text-gray-500">{r.hint}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Target
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full rounded-md border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              placeholder="Search by title or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-gray-100">
            {candidates.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-gray-400">No tasks found.</p>
            )}
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id ?? null)}
                className={`flex w-full items-center gap-2 border-b border-gray-50 px-3 py-2 text-left text-sm last:border-b-0 transition ${
                  selectedId === c.id
                    ? 'bg-[#3CCED7]/10 text-gray-900'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span className="font-mono text-[11px] text-gray-400">#{c.id}</span>
                <span className="flex-1 truncate text-gray-900">{c.summary}</span>
                <span className="text-[11px] text-gray-400">{c.type}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
          className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !selectedId}
          className="inline-flex h-9 items-center rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Linking…' : 'Link'}
        </button>
      </div>
    </BrandDialog>
  );
}
