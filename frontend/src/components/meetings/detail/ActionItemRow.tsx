'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Square, X, ArrowRight, ExternalLink } from 'lucide-react';
import type { MeetingActionItem } from '@/types/meeting';

interface Props {
  item: MeetingActionItem;
  selected: boolean;
  onToggleSelected: () => void;
  readOnly: boolean;
  onPatch: (patch: { title?: string; description?: string; is_resolved?: boolean }) => Promise<void>;
  onDelete: () => Promise<void>;
  onConvert: () => void;
  projectId: number;
}

export default function ActionItemRow({
  item,
  selected,
  onToggleSelected,
  readOnly,
  onPatch,
  onDelete,
  onConvert,
  projectId,
}: Props) {
  const [title, setTitle] = useState(item.title);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setTitle(item.title), [item.title]);

  const isConverted = item.converted_task_id != null;

  const handleTitleBlur = async () => {
    const next = title.trim();
    if (!next) {
      setTitle(item.title);
      return;
    }
    if (next !== item.title) {
      try {
        await onPatch({ title: next });
      } catch {
        setTitle(item.title);
      }
    }
  };

  const toggleResolved = () => onPatch({ is_resolved: !item.is_resolved });

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
      className={`group flex items-start gap-2 rounded-md p-2 transition ${
        selected ? 'bg-[#3CCED7]/10 ring-1 ring-[#3CCED7]/40' : 'hover:bg-gray-50/60'
      }`}
    >
      {!readOnly && !isConverted && (
        <button
          type="button"
          onClick={onToggleSelected}
          aria-label={selected ? 'Deselect action item' : 'Select action item'}
          className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 text-[#3CCED7] hover:border-[#3CCED7]"
        >
          {selected && <Check className="h-3 w-3" aria-hidden="true" />}
        </button>
      )}

      <button
        type="button"
        onClick={toggleResolved}
        disabled={readOnly}
        aria-label={item.is_resolved ? 'Mark unresolved' : 'Mark resolved'}
        className={`mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded transition ${
          item.is_resolved
            ? 'bg-emerald-500 text-white'
            : 'border border-gray-300 text-gray-300 hover:border-emerald-400'
        } disabled:cursor-not-allowed`}
      >
        {item.is_resolved ? (
          <Check className="h-3 w-3" aria-hidden="true" />
        ) : (
          <Square className="h-3 w-3 opacity-0" aria-hidden="true" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          disabled={readOnly || isConverted}
          className={`w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none transition hover:border-gray-200 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30 disabled:cursor-not-allowed ${
            item.is_resolved ? 'text-gray-400 line-through' : 'text-gray-900'
          }`}
        />
        {item.description && (
          <p className="mt-0.5 px-2 text-[11px] text-gray-500">{item.description}</p>
        )}
        {isConverted && (
          <Link
            href={`/tasks/${item.converted_task_id}?project_id=${projectId}`}
            className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
          >
            <span>Task #{item.converted_task_id}</span>
            <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
          </Link>
        )}
      </div>

      {!readOnly && !isConverted && (
        <>
          <button
            type="button"
            onClick={onConvert}
            aria-label="Convert to task"
            className="mt-1 inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-white px-2 text-[11px] font-medium text-gray-700 opacity-0 ring-1 ring-gray-200 transition hover:ring-gray-300 group-hover:opacity-100"
          >
            <span>Convert</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete action item"
            className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 disabled:opacity-40"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </>
      )}
    </li>
  );
}
