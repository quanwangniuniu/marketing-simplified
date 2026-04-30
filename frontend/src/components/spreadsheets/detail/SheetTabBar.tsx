'use client';

import { useEffect, useState } from 'react';
import { Plus, X, Pencil, Check } from 'lucide-react';
import SheetKindPill from '@/components/spreadsheets/pills/SheetKindPill';
import type { SheetData } from '@/types/spreadsheet';

interface Props {
  sheets: SheetData[];
  activeSheetId: number | null;
  onSelect: (sheetId: number) => void;
  onCreate: () => void;
  onRename: (sheetId: number, newName: string) => Promise<void> | void;
  onRequestDelete: (sheet: SheetData) => void;
  canDelete?: (sheet: SheetData) => boolean;
  renaming?: boolean;
}

export default function SheetTabBar({
  sheets,
  activeSheetId,
  onSelect,
  onCreate,
  onRename,
  onRequestDelete,
  canDelete,
  renaming = false,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (editingId == null) return;
    const match = sheets.find((s) => s.id === editingId);
    if (!match) setEditingId(null);
  }, [sheets, editingId]);

  const commitRename = async (sheet: SheetData) => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === sheet.name) {
      setEditingId(null);
      return;
    }
    try {
      await onRename(sheet.id, trimmed);
    } finally {
      setEditingId(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sheets.map((sheet) => {
        const active = sheet.id === activeSheetId;
        const editing = editingId === sheet.id;
        const deletable = canDelete ? canDelete(sheet) : true;
        return (
          <div
            key={sheet.id}
            className={`group inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${
              active
                ? 'bg-[#3CCED7]/10 text-[#0E8A96] ring-1 ring-[#3CCED7]/40'
                : 'text-gray-600 ring-1 ring-transparent hover:bg-gray-100'
            }`}
          >
            {editing ? (
              <>
                <input
                  autoFocus
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitRename(sheet);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  maxLength={200}
                  className="w-28 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
                />
                <button
                  type="button"
                  aria-label="Save sheet name"
                  onClick={() => void commitRename(sheet)}
                  disabled={renaming}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-emerald-600 hover:bg-emerald-50"
                >
                  <Check className="h-3 w-3" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSelect(sheet.id)}
                  className="inline-flex items-center gap-1.5 outline-none"
                >
                  <span className="line-clamp-1 max-w-[14ch]">{sheet.name}</span>
                  {sheet.kind === 'pivot' && <SheetKindPill kind="pivot" />}
                </button>
                <button
                  type="button"
                  aria-label={`Rename ${sheet.name}`}
                  onClick={() => {
                    setDraft(sheet.name);
                    setEditingId(sheet.id);
                  }}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 opacity-0 transition hover:bg-white hover:text-gray-700 group-hover:opacity-100 focus:opacity-100"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                {deletable && (
                  <button
                    type="button"
                    aria-label={`Delete ${sheet.name}`}
                    onClick={() => onRequestDelete(sheet)}
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onCreate}
        aria-label="Create sheet"
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2.5 text-xs font-medium text-gray-600 transition hover:border-[#3CCED7] hover:bg-[#3CCED7]/5 hover:text-[#0E8A96]"
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
        <span>New sheet</span>
      </button>
    </div>
  );
}
