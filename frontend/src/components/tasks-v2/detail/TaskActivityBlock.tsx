'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { TaskAPI } from '@/lib/api/taskApi';
import type { TaskComment } from '@/types/task';

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-US');
}

function userName(u: TaskComment['user']): string {
  return u?.username || u?.email || `User ${u?.id ?? '?'}`;
}

function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('');
}

export default function TaskActivityBlock({
  taskId,
  readOnly,
  refreshKey,
}: {
  taskId: number;
  readOnly: boolean;
  refreshKey: number;
}) {
  const [items, setItems] = useState<TaskComment[] | null>(null);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [localKey, setLocalKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    TaskAPI.getComments(taskId)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, refreshKey, localKey]);

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    setPosting(true);
    try {
      await TaskAPI.createComment(taskId, { body: text });
      setBody('');
      setLocalKey((k) => k + 1);
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Comment failed');
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-900">
        Activity
      </h2>

      {items === null && <p className="text-xs text-gray-400">Loading…</p>}
      {items && items.length === 0 && (
        <p className="text-xs text-gray-400">No comments yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="space-y-4">
          {items.map((c) => {
            const name = userName(c.user);
            return (
              <li key={c.id} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-[11px] font-semibold text-white">
                  {initials(name) || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="font-semibold text-gray-900">{name}</span>
                    <span className="ml-2 text-gray-400">{fmtTime(c.created_at)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
                    {c.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <div className="mt-4 rounded-lg bg-gray-50 p-3 ring-1 ring-gray-100">
          <textarea
            className="w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#3CCED7]"
            rows={2}
            placeholder="Add a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            disabled={posting}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <span className="text-[11px] text-gray-400">⌘ + Enter to send</span>
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={submit}
              disabled={posting || !body.trim()}
            >
              {posting ? 'Posting…' : 'Comment'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
