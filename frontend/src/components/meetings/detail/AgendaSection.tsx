'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { ListChecks, Plus } from 'lucide-react';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import type { AgendaItem } from '@/types/meeting';
import AgendaItemRow from './AgendaItemRow';

interface Props {
  projectId: number;
  meetingId: number;
  items: AgendaItem[];
  readOnly: boolean;
  onItemsChange: (next: AgendaItem[]) => void;
}

function getErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { detail?: string; content?: string[] } }; message?: string };
  return (
    e.response?.data?.detail ||
    e.response?.data?.content?.[0] ||
    e.message ||
    fallback
  );
}

export default function AgendaSection({
  projectId,
  meetingId,
  items,
  readOnly,
  onItemsChange,
}: Props) {
  const [newContent, setNewContent] = useState('');
  const [adding, setAdding] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex).map((it, idx) => ({
      ...it,
      order_index: idx,
    }));
    onItemsChange(reordered);
    try {
      const persisted = await MeetingsAPI.reorderAgendaItems(projectId, meetingId, {
        items: reordered.map((it) => ({ id: it.id, order_index: it.order_index })),
      });
      onItemsChange(persisted);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not reorder agenda.'));
      onItemsChange(items);
    }
  };

  const handleAdd = async () => {
    const content = newContent.trim();
    if (!content || adding) return;
    setAdding(true);
    try {
      const nextIndex = items.length
        ? Math.max(...items.map((i) => i.order_index)) + 1
        : 0;
      const created = await MeetingsAPI.createAgendaItem(projectId, meetingId, {
        content,
        order_index: nextIndex,
      });
      onItemsChange([...items, created]);
      setNewContent('');
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not add agenda item.'));
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = async (
    item: AgendaItem,
    patch: { content?: string; is_priority?: boolean },
  ) => {
    const optimistic = items.map((i) =>
      i.id === item.id ? { ...i, ...patch } : i,
    );
    onItemsChange(optimistic);
    try {
      const updated = await MeetingsAPI.patchAgendaItem(
        projectId,
        meetingId,
        item.id,
        patch,
      );
      onItemsChange(optimistic.map((i) => (i.id === item.id ? updated : i)));
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not update agenda item.'));
      onItemsChange(items);
    }
  };

  const handleDelete = async (item: AgendaItem) => {
    const optimistic = items.filter((i) => i.id !== item.id);
    onItemsChange(optimistic);
    try {
      await MeetingsAPI.deleteAgendaItem(projectId, meetingId, item.id);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not delete agenda item.'));
      onItemsChange(items);
    }
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
            Agenda
          </h2>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            {items.length}
          </span>
        </div>
      </header>

      {items.length === 0 && (
        <p className="mb-3 text-xs italic text-gray-400">No agenda items yet.</p>
      )}

      {items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => (
                <AgendaItemRow
                  key={item.id}
                  item={item}
                  readOnly={readOnly}
                  onEdit={(patch) => handleEdit(item, patch)}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {!readOnly && (
        <div className="mt-3 flex gap-2">
          <textarea
            rows={1}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Add a new agenda item…"
            className="min-w-0 flex-1 resize-none rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newContent.trim() || adding}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>
      )}
    </section>
  );
}
