'use client';

import { CheckCircle2, Circle } from 'lucide-react';

export interface ChecklistItem {
  key: string;
  label: string;
  required: boolean;
  filled: boolean;
  /** Optional DOM id to scroll/focus on click. */
  anchorId?: string;
}

interface Props {
  items: ChecklistItem[];
  onJump?: (anchorId: string) => void;
}

export default function TaskCreateChecklistAside({ items, onJump }: Props) {
  const required = items.filter((i) => i.required);
  const readyCount = required.filter((i) => i.filled).length;
  const total = required.length;
  const allReady = total > 0 && readyCount === total;

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Commit readiness
        </h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            allReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {readyCount}/{total}
        </span>
      </div>

      <ul className="space-y-1.5">
        {items.map((item) => {
          const Icon = item.filled ? CheckCircle2 : Circle;
          const isJumpable = Boolean(item.anchorId && onJump);
          const content = (
            <>
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  item.filled ? 'text-emerald-500' : 'text-gray-300'
                }`}
              />
              <span
                className={`text-[13px] ${
                  item.filled ? 'text-gray-500 line-through' : 'text-gray-800'
                }`}
              >
                {item.label}
                {item.required && !item.filled && <span className="ml-0.5 text-rose-500">*</span>}
              </span>
            </>
          );
          return (
            <li key={item.key}>
              {isJumpable ? (
                <button
                  type="button"
                  onClick={() => onJump?.(item.anchorId!)}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-gray-50"
                >
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-1.5 py-1">{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      {allReady && (
        <p className="mt-3 rounded-md bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700">
          All required fields set. Ready to create.
        </p>
      )}
      {!allReady && (
        <p className="mt-3 text-[11px] text-gray-500">
          Click an item to jump to the field.
        </p>
      )}
    </section>
  );
}
