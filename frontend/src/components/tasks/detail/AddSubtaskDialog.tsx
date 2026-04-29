'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData } from '@/types/task';
import BrandDialog from './BrandDialog';
import InlineSelect, { type InlineSelectOption } from './InlineSelect';

type Mode = 'create' | 'choose';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentTaskId: number;
  parentProjectId?: number;
  onAdded: () => void;
}

export default function AddSubtaskDialog({
  open,
  onOpenChange,
  parentTaskId,
  parentProjectId,
  onAdded,
}: Props) {
  const [mode, setMode] = useState<Mode>('create');
  const [summary, setSummary] = useState('');
  const [taskType, setTaskType] = useState('budget');
  const [types, setTypes] = useState<InlineSelectOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<TaskData[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setSummary('');
      setSearch('');
      setSelectedId(null);
      setMode('create');
    }
  }, [open]);

  useEffect(() => {
    TaskAPI.getTaskTypes()
      .then((rows) =>
        setTypes(rows.map((r) => ({ value: r.value, label: r.label })))
      )
      .catch(() => setTypes([]));
  }, []);

  useEffect(() => {
    if (mode !== 'choose' || !open) return;
    const handle = setTimeout(() => {
      TaskAPI.getTasks({ include_subtasks: true, project_id: parentProjectId })
        .then((resp) => {
          const rows: TaskData[] = Array.isArray(resp.data)
            ? resp.data
            : (resp.data as any)?.results || [];
          const q = search.trim().toLowerCase();
          const filtered = rows
            .filter((t) => t.id !== parentTaskId)
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
  }, [mode, open, search, parentProjectId, parentTaskId]);

  const createAndLink = async () => {
    if (!summary.trim() || !parentProjectId) return;
    setSubmitting(true);
    try {
      const resp = await TaskAPI.createTask({
        project_id: parentProjectId,
        type: taskType,
        summary: summary.trim(),
      });
      const newTask = resp.data as TaskData;
      if (newTask.id) await TaskAPI.addSubtask(parentTaskId, newTask.id);
      onAdded();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  const linkExisting = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await TaskAPI.addSubtask(parentTaskId, selectedId);
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
      title="Add subtask"
      subtitle={mode === 'create' ? 'Create a new subtask under this task.' : 'Link an existing task as a subtask.'}
    >
      <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1 text-xs font-medium">
        {(['create', 'choose'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-2 py-1.5 transition ${
              mode === m
                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-100'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {m === 'create' ? 'Create new' : 'Link existing'}
          </button>
        ))}
      </div>

      {mode === 'create' ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Summary
            </label>
            <input
              type="text"
              autoFocus
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              placeholder="What needs to be done?"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Type
            </label>
            <InlineSelect
              ariaLabel="Task type"
              value={taskType}
              onValueChange={setTaskType}
              options={types.length > 0 ? types : [{ value: 'budget', label: 'Budget' }]}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              autoFocus
              className="w-full rounded-md border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              placeholder="Search tasks by title or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto rounded-md border border-gray-100">
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
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={mode === 'create' ? createAndLink : linkExisting}
          disabled={
            submitting ||
            (mode === 'create' ? !summary.trim() : !selectedId)
          }
          className="inline-flex h-9 items-center rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Saving…' : mode === 'create' ? 'Create subtask' : 'Link subtask'}
        </button>
      </div>
    </BrandDialog>
  );
}
