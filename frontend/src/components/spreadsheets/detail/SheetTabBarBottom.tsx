'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, List, Plus } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import SheetKindPill from '@/components/spreadsheets/pills/SheetKindPill';
import SheetTabContextMenu from './SheetTabContextMenu';
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
  loading?: boolean;
}

export default function SheetTabBarBottom({
  sheets,
  activeSheetId,
  onSelect,
  onCreate,
  onRename,
  onRequestDelete,
  canDelete,
  renaming = false,
  loading = false,
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

  const beginRename = (sheet: SheetData) => {
    setDraft(sheet.name);
    setEditingId(sheet.id);
  };

  return (
    <div className="flex h-10 items-center gap-1 border-t border-gray-200 bg-gray-50/80 px-2">
      <button
        type="button"
        onClick={onCreate}
        aria-label="Add sheet"
        title="Add sheet"
        disabled={loading}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-600 transition hover:bg-white hover:text-[#0E8A96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7]/30"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="All sheets"
            title="All sheets"
            disabled={loading}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-600 transition hover:bg-white hover:text-[#0E8A96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3CCED7]/30"
          >
            <List className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={6}
            align="start"
            side="top"
            className="z-50 min-w-[12rem] max-h-64 overflow-y-auto rounded-lg bg-white shadow-lg ring-1 ring-gray-100 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />
            <div className="py-1">
              {sheets.map((sheet) => {
                const selected = sheet.id === activeSheetId;
                return (
                  <DropdownMenu.Item
                    key={sheet.id}
                    onSelect={() => onSelect(sheet.id)}
                    className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-xs outline-none transition data-[highlighted]:bg-gray-50 ${
                      selected ? 'text-[#0E8A96]' : 'text-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate">{sheet.name}</span>
                      {sheet.kind === 'pivot' && <SheetKindPill kind="pivot" />}
                    </span>
                    {selected && <Check className="h-3 w-3 text-[#0E8A96]" aria-hidden="true" />}
                  </DropdownMenu.Item>
                );
              })}
            </div>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <div className="flex-1 overflow-x-auto">
        <div className="flex items-center gap-1">
          {loading &&
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`sheet-loading-tab-${index}`}
                className="inline-flex h-7 items-center rounded-md bg-white px-2.5 py-1 shadow-sm ring-1 ring-gray-200"
              >
                <Skeleton
                  className={`h-3.5 rounded-full ${
                    index % 3 === 0 ? 'w-16' : index % 2 === 0 ? 'w-20' : 'w-12'
                  }`}
                />
              </div>
            ))}
          {sheets.map((sheet) => {
            const active = sheet.id === activeSheetId;
            const editing = editingId === sheet.id;
            const deletable = canDelete ? canDelete(sheet) : true;
            if (editing) {
              return (
                <div
                  key={sheet.id}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-white px-2 ring-1 ring-[#3CCED7]/40"
                >
                  <input
                    autoFocus
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => void commitRename(sheet)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename(sheet);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    maxLength={200}
                    className="w-28 bg-transparent text-xs text-[#0E8A96] outline-none"
                  />
                </div>
              );
            }
            const wrapperCls = active
              ? 'bg-white text-[#0E8A96] ring-1 ring-[#3CCED7]/40 shadow-sm'
              : 'text-gray-600 hover:bg-white hover:text-gray-900';
            return (
              <div
                key={sheet.id}
                className={`inline-flex h-7 items-center gap-1 rounded-md pl-2.5 pr-1 text-xs font-medium transition ${wrapperCls}`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(sheet.id)}
                  onDoubleClick={() => beginRename(sheet)}
                  aria-pressed={active}
                  className="inline-flex h-full items-center gap-1.5 outline-none"
                >
                  <span className="line-clamp-1 max-w-[16ch]">{sheet.name}</span>
                  {sheet.kind === 'pivot' && <SheetKindPill kind="pivot" />}
                </button>
                <SheetTabContextMenu
                  onRename={() => beginRename(sheet)}
                  onDelete={() => onRequestDelete(sheet)}
                  canDelete={deletable}
                >
                  <button
                    type="button"
                    aria-label={`${sheet.name} actions`}
                    title="Sheet actions"
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                  >
                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </SheetTabContextMenu>
              </div>
            );
          })}
        </div>
      </div>

      {renaming && <span className="text-[10px] text-gray-400">Saving…</span>}
    </div>
  );
}
