'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import type { ArtifactLink } from '@/types/meeting';
import { DecisionAPI } from '@/lib/api/decisionApi';
import { TaskAPI } from '@/lib/api/taskApi';

type ArtifactKind = 'decision' | 'task';

interface PickerRow {
  id: number;
  title: string;
  hint?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  meetingId: number;
  existingArtifacts: { artifact_type: string; artifact_id: number }[];
  onCreated: (link: ArtifactLink) => void;
}

export default function AddArtifactDialog({
  open,
  onOpenChange,
  projectId,
  meetingId,
  existingArtifacts,
  onCreated,
}: Props) {
  const [kind, setKind] = useState<ArtifactKind>('decision');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<PickerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind('decision');
    setQuery('');
    setRows([]);
    setSelectedId(null);
    setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setRows([]);
    setSelectedId(null);
    (async () => {
      try {
        if (kind === 'decision') {
          const resp = await DecisionAPI.listDecisions(projectId);
          const items = (resp.items || []).map((d: any) => ({
            id: d.id,
            title: (d.title || d.contextSummary || `Decision ${d.id}`).slice(0, 160),
            hint: d.status ? String(d.status) : undefined,
          }));
          if (!cancelled) setRows(items);
        } else {
          const resp = await TaskAPI.getTasks({ project_id: projectId });
          const rawResults =
            Array.isArray(resp.data) ? resp.data :
            Array.isArray((resp.data as any)?.results) ? (resp.data as any).results :
            [];
          const items = rawResults.map((t: any) => ({
            id: Number(t.id),
            title: (t.summary || `Task ${t.id}`).slice(0, 160),
            hint: t.status ? String(t.status) : undefined,
          }));
          if (!cancelled) setRows(items);
        }
      } catch (e) {
        if (!cancelled) {
          const err = e as { message?: string };
          toast.error(err.message || 'Could not load picker options.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, kind, projectId]);

  const existingIdsForKind = useMemo(() => {
    const set = new Set<number>();
    for (const a of existingArtifacts) {
      if (a.artifact_type.toLowerCase() === kind) set.add(a.artifact_id);
    }
    return set;
  }, [existingArtifacts, kind]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = rows.filter((r) => !existingIdsForKind.has(r.id));
    if (!q) return base;
    return base.filter(
      (r) => r.title.toLowerCase().includes(q) || String(r.id).includes(q),
    );
  }, [rows, query, existingIdsForKind]);

  const submit = async () => {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    try {
      const link = await MeetingsAPI.addArtifact(projectId, meetingId, {
        artifact_type: kind,
        artifact_id: selectedId,
      });
      toast.success('Artifact linked');
      onCreated(link);
      onOpenChange(false);
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string; non_field_errors?: string[] } }; message?: string };
      toast.error(
        err.response?.data?.detail ||
          err.response?.data?.non_field_errors?.[0] ||
          err.message ||
          'Could not link artifact.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-gray-100 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />
          <div className="flex items-start justify-between px-5 pt-4">
            <div className="min-w-0">
              <Dialog.Title className="text-[15px] font-semibold text-gray-900">
                Link artifact
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-gray-500">
                Reference an existing decision or task without claiming it was generated here.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="-mr-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4 px-5 pb-5 pt-4">
            <div className="inline-flex overflow-hidden rounded-md ring-1 ring-gray-200">
              {(['decision', 'task'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`px-3 py-1 text-xs font-medium transition ${
                    k === kind
                      ? 'bg-gradient-to-r from-[#3CCED7] to-[#A6E661] text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {k === 'decision' ? 'Decision' : 'Task'}
                </button>
              ))}
            </div>

            <div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${kind === 'decision' ? 'decisions' : 'tasks'}…`}
                  className="w-full rounded-md border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
                />
              </div>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-md ring-1 ring-gray-100">
                {loading && (
                  <div className="flex items-center gap-2 px-3 py-3 text-xs text-gray-400">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    <span>Loading…</span>
                  </div>
                )}
                {!loading && filtered.length === 0 && (
                  <p className="px-3 py-3 text-xs text-gray-400">No matches.</p>
                )}
                {!loading && filtered.length > 0 && (
                  <ul>
                    {filtered.map((r) => {
                      const active = selectedId === r.id;
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(r.id)}
                            className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-gray-50 ${
                              active ? 'bg-[#3CCED7]/10' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-gray-900">{r.title}</p>
                              <p className="truncate text-[11px] text-gray-500">
                                #{r.id}
                                {r.hint ? ` · ${r.hint}` : ''}
                              </p>
                            </div>
                            {active && (
                              <span className="shrink-0 rounded-full bg-[#3CCED7]/20 px-2 py-0.5 text-[11px] font-medium text-[#0E8A96]">
                                Selected
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!selectedId || submitting}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Linking…' : 'Link artifact'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
