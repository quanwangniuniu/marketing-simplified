'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckSquare, Plus } from 'lucide-react';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import type { MeetingActionItem } from '@/types/meeting';
import type { TaskData } from '@/types/task';
import ActionItemRow from './ActionItemRow';
import ConvertActionItemDialog from './ConvertActionItemDialog';
import BulkConvertActionItemDialog from './BulkConvertActionItemDialog';

interface Member {
  id: number;
  user: { id: number; username?: string; email?: string; name?: string };
}

interface Props {
  projectId: number;
  meetingId: number;
  items: MeetingActionItem[];
  members: Member[];
  readOnly: boolean;
  onItemsChange: (next: MeetingActionItem[]) => void;
  onTaskCreated: (task: TaskData) => void;
}

function getErrorMessage(err: unknown, fallback: string): string {
  const e = err as {
    response?: { data?: { detail?: string; title?: string[]; description?: string[] } };
    message?: string;
  };
  return (
    e.response?.data?.detail ||
    e.response?.data?.title?.[0] ||
    e.response?.data?.description?.[0] ||
    e.message ||
    fallback
  );
}

export default function ActionItemsSection({
  projectId,
  meetingId,
  items,
  members,
  readOnly,
  onItemsChange,
  onTaskCreated,
}: Props) {
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [convertTarget, setConvertTarget] = useState<MeetingActionItem | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableIds = items.filter((it) => it.converted_task_id == null).map((it) => it.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const selectedItems = useMemo(
    () => items.filter((it) => selectedIds.has(it.id) && it.converted_task_id == null),
    [items, selectedIds],
  );

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      const created = await MeetingsAPI.createMeetingActionItem(projectId, meetingId, {
        title,
        description: newDescription.trim() || undefined,
        order_index: items.length,
      });
      onItemsChange([...items, created]);
      setNewTitle('');
      setNewDescription('');
      setShowNewForm(false);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not create action item.'));
    } finally {
      setCreating(false);
    }
  };

  const handlePatch = async (
    item: MeetingActionItem,
    patch: { title?: string; description?: string; is_resolved?: boolean },
  ) => {
    const optimistic = items.map((i) => (i.id === item.id ? { ...i, ...patch } : i));
    onItemsChange(optimistic);
    try {
      const updated = await MeetingsAPI.patchMeetingActionItem(
        projectId,
        meetingId,
        item.id,
        patch,
      );
      onItemsChange(optimistic.map((i) => (i.id === item.id ? updated : i)));
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not update action item.'));
      onItemsChange(items);
    }
  };

  const handleDelete = async (item: MeetingActionItem) => {
    const optimistic = items.filter((i) => i.id !== item.id);
    onItemsChange(optimistic);
    selectedIds.delete(item.id);
    try {
      await MeetingsAPI.deleteMeetingActionItem(projectId, meetingId, item.id);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not delete action item.'));
      onItemsChange(items);
    }
  };

  const selectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableIds));
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
            Action items
          </h2>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            {items.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedItems.length > 0 && (
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
            >
              Convert {selectedItems.length}
            </button>
          )}
          {!readOnly && selectableIds.length > 0 && (
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] font-medium text-gray-500 transition hover:text-gray-900"
            >
              {allSelected ? 'Clear selection' : 'Select all'}
            </button>
          )}
        </div>
      </header>

      {items.length === 0 && !showNewForm && (
        <p className="mb-3 text-xs italic text-gray-400">No action items yet.</p>
      )}

      {items.length > 0 && (
        <ul className="mb-3 flex flex-col gap-0.5">
          {items.map((it) => (
            <ActionItemRow
              key={it.id}
              item={it}
              selected={selectedIds.has(it.id)}
              onToggleSelected={() => toggleSelected(it.id)}
              readOnly={readOnly}
              onPatch={(p) => handlePatch(it, p)}
              onDelete={() => handleDelete(it)}
              onConvert={() => setConvertTarget(it)}
              projectId={projectId}
            />
          ))}
        </ul>
      )}

      {!readOnly && !showNewForm && (
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#3CCED7] transition hover:bg-[#3CCED7]/10"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          <span>Add action item</span>
        </button>
      )}

      {!readOnly && showNewForm && (
        <div className="rounded-lg bg-gray-50 p-3 ring-1 ring-gray-100">
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
          />
          <textarea
            rows={2}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className="mt-2 w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowNewForm(false);
                setNewTitle('');
                setNewDescription('');
              }}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-white px-3 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newTitle.trim() || creating}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      <ConvertActionItemDialog
        open={!!convertTarget}
        onOpenChange={(open) => !open && setConvertTarget(null)}
        projectId={projectId}
        meetingId={meetingId}
        item={convertTarget}
        members={members}
        onConverted={(task) => {
          if (convertTarget) {
            const next = items.map((i) =>
              i.id === convertTarget.id ? { ...i, converted_task_id: task.id ?? null } : i,
            );
            onItemsChange(next);
            selectedIds.delete(convertTarget.id);
          }
          onTaskCreated(task);
        }}
      />

      <BulkConvertActionItemDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        projectId={projectId}
        meetingId={meetingId}
        items={selectedItems}
        members={members}
        onConverted={(tasks) => {
          const taskByOrigin = new Map<number, number>();
          for (let i = 0; i < tasks.length && i < selectedItems.length; i++) {
            const t = tasks[i];
            const origin = selectedItems[i];
            if (t.id != null) taskByOrigin.set(origin.id, t.id);
          }
          const next = items.map((i) =>
            taskByOrigin.has(i.id)
              ? { ...i, converted_task_id: taskByOrigin.get(i.id) ?? null }
              : i,
          );
          onItemsChange(next);
          setSelectedIds(new Set());
          tasks.forEach(onTaskCreated);
        }}
      />
    </section>
  );
}
