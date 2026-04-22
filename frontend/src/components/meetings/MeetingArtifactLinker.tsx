'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import type { ArtifactLink } from '@/types/meeting';
import { Button } from '@/components/ui/button';
import {
  normalizeMeetingArtifactType,
  type MeetingArtifactKind,
  type MeetingArtifactResourceIndex,
} from '@/lib/meetings/artifactLinks';

function linkKey(artifactType: string, artifactId: number) {
  return `${normalizeMeetingArtifactType(artifactType)}:${artifactId}`;
}

type KindOption = MeetingArtifactKind | 'other';

export function MeetingArtifactLinker({
  resourceIndex,
  resourceLoading,
  existing,
  disabled,
  onLink,
}: {
  resourceIndex: MeetingArtifactResourceIndex;
  resourceLoading: boolean;
  existing: ArtifactLink[];
  disabled?: boolean;
  onLink: (artifact_type: string, artifact_id: number) => void | Promise<void>;
}) {
  const [kind, setKind] = useState<KindOption>('decision');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [otherType, setOtherType] = useState('');
  const [otherId, setOtherId] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const excluded = useMemo(() => {
    const s = new Set<string>();
    for (const a of existing) {
      s.add(linkKey(a.artifact_type, a.artifact_id));
    }
    return s;
  }, [existing]);

  const isTaken = (type: string, id: number) => excluded.has(linkKey(type, id));

  const decisionPool = useMemo(() => {
    return resourceIndex.decisions.filter((d) => !isTaken('decision', d.id));
  }, [resourceIndex.decisions, excluded]);

  const taskPool = useMemo(() => {
    return resourceIndex.tasks.filter((t) => t.id != null && !isTaken('task', t.id as number));
  }, [resourceIndex.tasks, excluded]);

  const spreadsheetPool = useMemo(() => {
    return resourceIndex.spreadsheets.filter((s) => !isTaken('spreadsheet', s.id));
  }, [resourceIndex.spreadsheets, excluded]);

  const filteredDecisions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = decisionPool;
    if (!q) return pool.slice(0, 25);
    return pool
      .filter((d) => {
        const title = (d.title ?? '').toLowerCase();
        const seq = d.projectSeq != null ? String(d.projectSeq) : '';
        return title.includes(q) || String(d.id).includes(q) || seq.includes(q);
      })
      .slice(0, 25);
  }, [decisionPool, query]);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = taskPool;
    if (!q) return pool.slice(0, 25);
    return pool
      .filter((t) => {
        const summary = (t.summary ?? '').toLowerCase();
        const id = t.id != null ? String(t.id) : '';
        return summary.includes(q) || id.includes(q);
      })
      .slice(0, 25);
  }, [taskPool, query]);

  const filteredSheets = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = spreadsheetPool;
    if (!q) return pool.slice(0, 25);
    return pool
      .filter((s) => {
        const name = (s.name ?? '').toLowerCase();
        return name.includes(q) || String(s.id).includes(q);
      })
      .slice(0, 25);
  }, [spreadsheetPool, query]);

  useEffect(() => {
    setQuery('');
    setOpen(false);
  }, [kind]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (type: string, id: number) => {
    void onLink(type, id);
    setQuery('');
    setOpen(false);
  };

  const submitOther = () => {
    const t = otherType.trim().slice(0, 50);
    const id = Number(otherId);
    if (!t) {
      return;
    }
    if (!Number.isFinite(id) || id < 1) return;
    void onLink(t, Math.trunc(id));
    setOtherType('');
    setOtherId('');
  };

  const showPicker = kind !== 'other';

  const listItems =
    kind === 'decision'
      ? filteredDecisions.map((d) => ({
          key: `d-${d.id}`,
          primary: d.title?.trim() || `Decision #${d.id}`,
          secondary: d.status ? `Status: ${d.status}` : `id ${d.id}`,
          onPick: () => pick('decision', d.id),
        }))
      : kind === 'task'
        ? filteredTasks
            .filter((t) => t.id != null)
            .map((t) => ({
              key: `t-${t.id}`,
              primary: (t.summary || `Task #${t.id}`).slice(0, 120),
              secondary: t.status ? String(t.status) : `id ${t.id}`,
              onPick: () => pick('task', t.id as number),
            }))
        : filteredSheets.map((s) => ({
            key: `s-${s.id}`,
            primary: s.name || `Spreadsheet #${s.id}`,
            secondary: `id ${s.id}`,
            onPick: () => pick('spreadsheet', s.id),
          }));

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="md:col-span-1">
        <label className="text-xs font-medium text-gray-700">Resource type</label>
        <select
          className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-[#3CCED7] focus:outline-none focus:ring-1 focus:ring-[#3CCED7]"
          value={kind}
          disabled={disabled || resourceLoading}
          onChange={(e) => setKind(e.target.value as KindOption)}
        >
          <option value="decision">Decision</option>
          <option value="task">Task</option>
          <option value="spreadsheet">Spreadsheet</option>
          <option value="other">Other (manual type &amp; id)</option>
        </select>
      </div>

      {showPicker ? (
        <div className="md:col-span-2" ref={rootRef}>
          <label className="text-xs font-medium text-gray-700">Search &amp; pick</label>
          <div className="relative mt-1">
            <input
              type="text"
              autoComplete="off"
              disabled={disabled || resourceLoading}
              placeholder={
                resourceLoading
                  ? 'Loading project resources…'
                  : 'Type to filter, then choose a row…'
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-[#3CCED7] focus:outline-none focus:ring-1 focus:ring-[#3CCED7] disabled:bg-gray-50"
              role="combobox"
              aria-expanded={open}
            />
            {resourceLoading ? (
              <Loader2 className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
            ) : null}
            {open && !disabled && !resourceLoading ? (
              <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                {listItems.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-500">No matches (or none left to link)</li>
                ) : (
                  listItems.map((row) => (
                    <li key={row.key}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[#3CCED7]/10 focus:bg-[#3CCED7]/10 focus:outline-none"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={row.onPick}
                      >
                        <span className="font-medium text-gray-900">{row.primary}</span>
                        <span className="mt-0.5 block text-xs text-gray-500">{row.secondary}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Only resources in this project are listed. Already linked items are hidden.
          </p>
        </div>
      ) : (
        <>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-gray-700">Custom type</label>
            <input
              value={otherType}
              onChange={(e) => setOtherType(e.target.value)}
              placeholder="e.g. tag, document"
              maxLength={50}
              disabled={disabled}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-[#3CCED7] focus:outline-none focus:ring-1 focus:ring-[#3CCED7]"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-gray-700">Numeric id</label>
            <input
              value={otherId}
              onChange={(e) => setOtherId(e.target.value)}
              placeholder="e.g. 42"
              inputMode="numeric"
              disabled={disabled}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-[#3CCED7] focus:outline-none focus:ring-1 focus:ring-[#3CCED7]"
            />
          </div>
        </>
      )}

      {kind === 'other' ? (
        <div className="col-span-full flex justify-end border-t border-gray-100 pt-3">
          <Button
            type="button"
            size="sm"
            disabled={
              disabled ||
              !otherType.trim() ||
              !Number.isFinite(Number(otherId)) ||
              Number(otherId) < 1
            }
            onClick={submitOther}
          >
            Link custom artifact
          </Button>
        </div>
      ) : null}
    </div>
  );
}
