'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Loader2, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { TaskAPI } from '@/lib/api/taskApi';
import { useTaskStore } from '@/lib/taskStore';
import type { TaskData } from '@/types/task';
import { PRIORITY_OPTIONS, TASK_TYPES } from './TYPE_META';

interface QuickTaskCreateProps {
  projectId: number;
  open: boolean;
  onClose: () => void;
  onCreated?: (task: TaskData) => void;
}

export default function QuickTaskCreate({ projectId, open, onClose, onCreated }: QuickTaskCreateProps) {
  const addTask = useTaskStore((s) => s.addTask);

  const [type, setType] = useState(TASK_TYPES[0].value);
  const [summary, setSummary] = useState('');
  const [priority, setPriority] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [openAfter, setOpenAfter] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const summaryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setType(TASK_TYPES[0].value);
      setSummary('');
      setPriority('');
      setDueDate('');
      setOpenAfter(true);
      setTimeout(() => summaryRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const canSubmit = summary.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload: Parameters<typeof TaskAPI.createTask>[0] = {
        project_id: projectId,
        type,
        summary: summary.trim(),
        ...(priority ? { priority } : {}),
        ...(dueDate ? { due_date: dueDate } : {}),
        create_as_draft: true,
      };
      const res = await TaskAPI.createTask(payload);
      const created = res.data as TaskData;
      addTask(created);
      toast.success('Task created');
      onClose();
      if (openAfter) onCreated?.(created);
    } catch {
      toast.error('Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div data-testid="quick-task-create-modal" className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#7ee3e8] to-[#b9ee98]">
              <Plus className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900">New task</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
            >
              {TASK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">
              Summary <span className="text-rose-400">*</span>
            </label>
            <input
              ref={summaryRef}
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) handleSubmit(); }}
              placeholder="What needs to be done?"
              data-testid="quick-task-summary-input"
              className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
            />
          </div>

          {/* Priority + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
              >
                <option value="">No priority</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Due date</label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-2 text-sm text-gray-700 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20"
                />
              </div>
            </div>
          </div>

          {/* Open in drawer */}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={openAfter}
              onChange={(e) => setOpenAfter(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 accent-[#3CCED7]"
            />
            Open in drawer after creating
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            data-testid="quick-task-submit-button"
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
              canSubmit
                ? 'bg-gradient-to-r from-[#7ee3e8] to-[#b9ee98] text-white shadow-sm hover:brightness-95'
                : 'cursor-not-allowed bg-gray-100 text-gray-400'
            }`}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {submitting ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  );
}
