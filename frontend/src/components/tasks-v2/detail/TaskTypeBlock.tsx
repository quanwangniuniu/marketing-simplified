'use client';

import type { TaskData } from '@/types/task';

function prettyLabel(type?: string): string {
  if (!type) return 'Work type';
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TaskTypeBlock({ task }: { task: TaskData }) {
  const linked = task.linked_object as Record<string, unknown> | null | undefined;
  if (!linked || typeof linked !== 'object') return null;

  const entries = Object.entries(linked)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .slice(0, 12);
  if (entries.length === 0) return null;

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-900">
        {prettyLabel(task.type)} details
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
        {entries.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              {k.replace(/_/g, ' ')}
            </dt>
            <dd className="mt-0.5 truncate text-sm text-gray-900">
              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
