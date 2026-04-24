'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Pencil } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import SpreadsheetBreadcrumb from './SpreadsheetBreadcrumb';

interface Props {
  projectId: number | null;
  projectName?: string | null;
  spreadsheetName: string;
  canRename?: boolean;
  saving?: boolean;
  onRename?: (newName: string) => Promise<void> | void;
  loading?: boolean;
}

export default function SpreadsheetDetailHeader({
  projectId,
  projectName,
  spreadsheetName,
  canRename = true,
  saving = false,
  onRename,
  loading = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(spreadsheetName);

  useEffect(() => {
    if (!editing) setDraft(spreadsheetName);
  }, [spreadsheetName, editing]);

  const commit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === spreadsheetName) {
      setEditing(false);
      setDraft(spreadsheetName);
      return;
    }
    if (onRename) {
      try {
        await onRename(trimmed);
      } finally {
        setEditing(false);
      }
    } else {
      setEditing(false);
    }
  };

  return (
    <header className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <SpreadsheetBreadcrumb
        projectId={projectId}
        projectName={projectName}
        spreadsheetName={spreadsheetName}
      />
      <div className="flex items-center gap-2">
        {loading ? (
          <div className="flex w-full max-w-xl items-center gap-2">
            <Skeleton className="h-9 w-full max-w-md rounded-md" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        ) : editing ? (
          <div className="flex w-full max-w-xl items-center gap-2">
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commit();
                if (e.key === 'Escape') {
                  setEditing(false);
                  setDraft(spreadsheetName);
                }
              }}
              className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-lg font-semibold text-gray-900 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
              maxLength={200}
            />
            <button
              type="button"
              onClick={() => void commit()}
              disabled={saving}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(spreadsheetName);
              }}
              className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="line-clamp-1 text-2xl font-semibold text-gray-900">
              {spreadsheetName || 'Untitled spreadsheet'}
            </h1>
            {canRename && onRename && (
              <button
                type="button"
                aria-label="Rename spreadsheet"
                onClick={() => setEditing(true)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
