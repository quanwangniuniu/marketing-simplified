'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskData } from '@/types/task';

export default function TaskDescriptionBlock({
  task,
  readOnly,
  onUpdated,
}: {
  task: TaskData;
  readOnly: boolean;
  onUpdated: () => void | Promise<void>;
}) {
  const [value, setValue] = useState(task.description || '');
  const [saving, setSaving] = useState(false);
  const lastSaved = useRef(task.description || '');

  useEffect(() => {
    setValue(task.description || '');
    lastSaved.current = task.description || '';
  }, [task.description, task.id]);

  const commit = async () => {
    if (!task.id || value === lastSaved.current) return;
    setSaving(true);
    try {
      await TaskAPI.updateTask(task.id, { description: value });
      lastSaved.current = value;
      await onUpdated();
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Save failed');
      setValue(lastSaved.current);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
          Description
        </h2>
        {saving && <span className="text-[11px] text-gray-400">Saving…</span>}
      </div>
      <textarea
        className="min-h-[60px] w-full resize-y rounded-md bg-transparent px-0 py-1 text-sm leading-relaxed text-gray-900 outline-none transition placeholder:text-gray-300 focus:bg-gray-50 focus:px-2"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        disabled={readOnly}
        placeholder={readOnly ? 'No description.' : 'Describe what this task is about…'}
      />
    </section>
  );
}
