'use client';

import { useEffect, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Star, X } from 'lucide-react';
import type { AgendaItem } from '@/types/meeting';

interface Props {
  item: AgendaItem;
  readOnly: boolean;
  onEdit: (patch: { content?: string; is_priority?: boolean }) => Promise<void>;
  onDelete: () => Promise<void>;
}

export default function AgendaItemRow({ item, readOnly, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: readOnly });
  const [content, setContent] = useState(item.content);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setContent(item.content), [item.content]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const handleBlur = async () => {
    const next = content.trim();
    if (!next) {
      setContent(item.content);
      return;
    }
    if (next !== item.content) {
      try {
        await onEdit({ content: next });
      } catch {
        setContent(item.content);
      }
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-2 rounded-md p-2 transition ${
        isDragging ? 'bg-gray-50 ring-1 ring-[#3CCED7]/40' : 'hover:bg-gray-50/60'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={readOnly}
        aria-label="Drag to reorder agenda item"
        className="mt-1 inline-flex h-5 w-5 shrink-0 cursor-grab items-center justify-center rounded text-gray-300 opacity-0 transition hover:text-gray-500 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => onEdit({ is_priority: !item.is_priority })}
        disabled={readOnly}
        aria-label={item.is_priority ? 'Clear priority' : 'Mark as priority'}
        className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded transition ${
          item.is_priority ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'
        } disabled:cursor-not-allowed`}
      >
        <Star
          className="h-3.5 w-3.5"
          fill={item.is_priority ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      </button>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleBlur}
        disabled={readOnly}
        rows={1}
        className="min-w-0 flex-1 resize-none rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-gray-900 outline-none transition hover:border-gray-200 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30 disabled:text-gray-500"
      />

      {!readOnly && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Delete agenda item"
          className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 disabled:opacity-40"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
